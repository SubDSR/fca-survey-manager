import { supabase } from '../config/supabase.js';

export async function listarPeriodos(req, res) {
  const { data, error } = await supabase
    .from('periodo_academico')
    .select('id, codigo, anio, semestre, fecha_inicio, fecha_fin, estado')
    .order('anio', { ascending: true })
    .order('semestre', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function crearPeriodo(req, res) {
  const { anio, semestre, fecha_inicio, fecha_fin, activar } = req.body || {};

  const anioNum = Number(anio);
  const semestreNum = Number(semestre);
  if (!anioNum || anioNum < 1990 || anioNum > 2100) {
    return res.status(400).json({ error: 'Año inválido (debe estar entre 1990 y 2100).' });
  }
  if (![1, 2, 3].includes(semestreNum)) {
    return res.status(400).json({ error: 'Semestre inválido (debe ser 1, 2 o 3).' });
  }

  const numeroRomano = semestreNum === 1 ? 'I' : semestreNum === 2 ? 'II' : 'III';
  const codigo = `${anioNum}-${numeroRomano}`;

  if (activar) {
    const { error: errorDesactivar } = await supabase
      .from('periodo_academico')
      .update({ estado: 'CERRADO' })
      .eq('estado', 'EN_CURSO');
    if (errorDesactivar) return res.status(500).json({ error: errorDesactivar.message });
  }

  const { data, error } = await supabase
    .from('periodo_academico')
    .insert({
      codigo,
      anio: anioNum,
      semestre: semestreNum,
      fecha_inicio: fecha_inicio || null,
      fecha_fin: fecha_fin || null,
      estado: activar ? 'EN_CURSO' : 'PLANIFICADO',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `El período "${codigo}" ya existe.` });
    }
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
}

// Marca un período como EN_CURSO y cierra el que estaba EN_CURSO antes (si había).
export async function activarPeriodo(req, res) {
  const { id } = req.params;

  const { data: periodo, error: errorBusqueda } = await supabase
    .from('periodo_academico')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (errorBusqueda) return res.status(500).json({ error: errorBusqueda.message });
  if (!periodo) return res.status(404).json({ error: 'Período no encontrado' });

  const { error: errorCerrar } = await supabase
    .from('periodo_academico')
    .update({ estado: 'CERRADO' })
    .eq('estado', 'EN_CURSO')
    .neq('id', id);
  if (errorCerrar) return res.status(500).json({ error: errorCerrar.message });

  const { data, error } = await supabase
    .from('periodo_academico')
    .update({ estado: 'EN_CURSO' })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

// PATCH /api/periodos/:id — edita fecha_inicio/fecha_fin/anio/semestre. El
// codigo se recalcula si cambian anio/semestre, pero se bloquea si el
// período ya tiene alguna campania_evaluacion (para no desincronizar el
// histórico: cargas/encuestas ya guardadas referencian el período por su
// codigo en reportes/exports, no solo por id).
export async function actualizarPeriodo(req, res) {
  const { id } = req.params;
  const { anio, semestre, fecha_inicio, fecha_fin } = req.body || {};

  const { data: existente, error: errorExistente } = await supabase
    .from('periodo_academico')
    .select('id, anio, semestre')
    .eq('id', id)
    .maybeSingle();
  if (errorExistente) return res.status(500).json({ error: errorExistente.message });
  if (!existente) return res.status(404).json({ error: 'Período no encontrado' });

  const payload = {};

  const cambiaAnio = anio !== undefined && Number(anio) !== existente.anio;
  const cambiaSemestre = semestre !== undefined && Number(semestre) !== existente.semestre;
  if (cambiaAnio || cambiaSemestre) {
    const { count, error: errorCampanias } = await supabase
      .from('campania_evaluacion')
      .select('id', { count: 'exact', head: true })
      .eq('periodo_academico_id', id);
    if (errorCampanias) return res.status(500).json({ error: errorCampanias.message });
    if (count > 0) {
      return res.status(409).json({
        error: 'No se puede cambiar el año/semestre de un período que ya tiene campañas de evaluación asociadas.',
      });
    }

    const anioNum = Number(anio ?? existente.anio);
    const semestreNum = Number(semestre ?? existente.semestre);
    if (!anioNum || anioNum < 1990 || anioNum > 2100) {
      return res.status(400).json({ error: 'Año inválido (debe estar entre 1990 y 2100).' });
    }
    if (![1, 2, 3].includes(semestreNum)) {
      return res.status(400).json({ error: 'Semestre inválido (debe ser 1, 2 o 3).' });
    }
    const numeroRomano = semestreNum === 1 ? 'I' : semestreNum === 2 ? 'II' : 'III';
    payload.anio = anioNum;
    payload.semestre = semestreNum;
    payload.codigo = `${anioNum}-${numeroRomano}`;
  }

  if (fecha_inicio !== undefined) payload.fecha_inicio = fecha_inicio || null;
  if (fecha_fin !== undefined) payload.fecha_fin = fecha_fin || null;

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'No se recibió ningún campo para actualizar.' });
  }

  const { data, error } = await supabase
    .from('periodo_academico')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `El período "${payload.codigo}" ya existe.` });
    }
    if (error.code === '23514') {
      return res.status(400).json({ error: `Datos inválidos: ${error.message}` });
    }
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
}

// DELETE /api/periodos/:id — solo si no tiene ninguna carga ni encuesta
// asociada (nunca borrado en cascada). Un período puede tener campañas
// vacías (creadas pero sin ninguna carga/encuesta todavía) -- esas sí se
// eliminan junto con el período, ya que no representan datos reales.
export async function eliminarPeriodo(req, res) {
  const { id } = req.params;

  const { data: periodo, error: errorPeriodo } = await supabase
    .from('periodo_academico')
    .select('id, codigo')
    .eq('id', id)
    .maybeSingle();
  if (errorPeriodo) return res.status(500).json({ error: errorPeriodo.message });
  if (!periodo) return res.status(404).json({ error: 'Período no encontrado' });

  const { data: campanias, error: errorCampanias } = await supabase
    .from('campania_evaluacion')
    .select('id')
    .eq('periodo_academico_id', id);
  if (errorCampanias) return res.status(500).json({ error: errorCampanias.message });

  if (campanias.length > 0) {
    const campaniaIds = campanias.map((c) => c.id);

    const { count: cargasCount, error: errorCargas } = await supabase
      .from('carga_csv')
      .select('id', { count: 'exact', head: true })
      .in('campania_id', campaniaIds);
    if (errorCargas) return res.status(500).json({ error: errorCargas.message });

    const { data: encuestados, error: errorEncuestados } = await supabase
      .from('encuestado')
      .select('id')
      .in('campania_id', campaniaIds);
    if (errorEncuestados) return res.status(500).json({ error: errorEncuestados.message });

    let encuestasCount = 0;
    if (encuestados.length > 0) {
      const { count, error: errorEncuestas } = await supabase
        .from('encuesta')
        .select('id', { count: 'exact', head: true })
        .in('encuestado_id', encuestados.map((e) => e.id));
      if (errorEncuestas) return res.status(500).json({ error: errorEncuestas.message });
      encuestasCount = count;
    }

    if (cargasCount > 0 || encuestasCount > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: el período "${periodo.codigo}" tiene ${cargasCount} carga(s) y ${encuestasCount} encuesta(s) asociadas.`,
      });
    }

    // Campañas vacías (sin cargas ni encuestas) -- se eliminan junto con el
    // período, no son "datos" en el sentido que protege esta regla.
    const { error: errorDeleteCampanias } = await supabase
      .from('campania_evaluacion')
      .delete()
      .in('id', campaniaIds);
    if (errorDeleteCampanias) return res.status(500).json({ error: errorDeleteCampanias.message });
  }

  const { error: errorDelete } = await supabase.from('periodo_academico').delete().eq('id', id);
  if (errorDelete) return res.status(500).json({ error: errorDelete.message });

  res.json({ eliminado: true });
}

// GET /api/periodos/:id/campania-activa — el frontend necesita el campania_id
// para GET /api/cargas (el historial se consulta por campaña, no por período).
export async function campaniaActivaDePeriodo(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('campania_evaluacion')
    .select('id, codigo, estado')
    .eq('periodo_academico_id', id)
    .in('estado', ['BORRADOR', 'ABIERTA'])
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) {
    return res.status(404).json({ error: 'No hay campaña abierta/en borrador para este período.' });
  }
  res.json(data);
}
