
import { supabase } from '../config/supabase.js';

export async function listarAsignaciones(req, res) {
  try {
    const { periodo_id } = req.query;
    if (!periodo_id) {
      return res.status(400).json({ error: 'El parmetro periodo_id es obligatorio.' });
    }

    // Se asume que el inner join filtrar correctamente los grupos de este periodo.
    // Usamos el query sintax de Supabase. Note: !inner forces an inner join.
    const { data, error } = await supabase
      .from('curso_grupo_docente')
      .select(`
        id,
        es_carga_oficial,
        docente_id,
        docente:docente_id(id, nombre_completo),
        curso_grupo:curso_grupo_id(
          id,
          asignatura:asignatura_id(id, nombre),
          grupo:grupo_id!inner(
            id,
            ciclo,
            seccion,
            periodo_academico_id,
            programa:programa_id(id, nombre_corto)
          )
        )
      `)
      .eq('es_carga_oficial', true)
      .eq('curso_grupo.grupo.periodo_academico_id', periodo_id);

    if (error) {
      console.error('Error supabase listarAsignaciones:', error);
      return res.status(500).json({ error: error.message });
    }

    // Aplanar un poco la estructura para el frontend
    const flatData = data.map(item => ({
      id: item.id,
      docente: item.docente,
      curso_grupo_id: item.curso_grupo?.id,
      asignatura: item.curso_grupo?.asignatura,
      grupo: item.curso_grupo?.grupo,
    }));

    res.json(flatData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

export async function actualizarAsignacion(req, res) {
  try {
    const { id } = req.params;
    const { docente_id } = req.body;

    if (!docente_id) {
      return res.status(400).json({ error: 'docente_id es obligatorio' });
    }

    // 1. Obtener el registro actual
    const { data: cgd, error: errCgd } = await supabase
      .from('curso_grupo_docente')
      .select('*')
      .eq('id', id)
      .single();

    if (errCgd || !cgd) {
      return res.status(404).json({ error: 'Asignacin original no encontrada' });
    }

    // 2. Revisar si tiene encuestas
    const { count, error: errCount } = await supabase
      .from('encuesta')
      .select('*', { count: 'exact', head: true })
      .eq('curso_grupo_docente_id', id);

    if (errCount) {
      return res.status(500).json({ error: errCount.message });
    }

    if (count === 0) {
      // 3a. Update directo
      const { data: updated, error: errUpd } = await supabase
        .from('curso_grupo_docente')
        .update({ docente_id })
        .eq('id', id)
        .select()
        .single();
      
      if (errUpd) return res.status(500).json({ error: errUpd.message });
      return res.json(updated);
    } else {
      // 3b. Update a falso y crear nuevo
      const { error: errUpdFalse } = await supabase
        .from('curso_grupo_docente')
        .update({ es_carga_oficial: false })
        .eq('id', id);

      if (errUpdFalse) return res.status(500).json({ error: errUpdFalse.message });

      const { data: inserted, error: errIns } = await supabase
        .from('curso_grupo_docente')
        .insert({
          curso_grupo_id: cgd.curso_grupo_id,
          docente_id: docente_id,
          rol: cgd.rol,
          porcentaje_carga: cgd.porcentaje_carga,
          es_carga_oficial: true
        })
        .select()
        .single();

      if (errIns) return res.status(500).json({ error: errIns.message });
      return res.json(inserted);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
