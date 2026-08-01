import { supabase } from '../config/supabase.js';

const CAMPOS_FICHA =
  'id, nombre_completo, condicion, facultad, grado_academico, correo_institucional, tiene_portafolio, registrado_sunedu';

export async function listarDocentes(req, res) {
  const { data, error } = await supabase
    .from('v_docente_ficha')
    .select(CAMPOS_FICHA);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function obtenerDocentePorId(req, res) {
  const { id } = req.params;

  const { data: ficha, error: errorFicha } = await supabase
    .from('v_docente_ficha')
    .select(CAMPOS_FICHA)
    .eq('id', id)
    .maybeSingle();

  if (errorFicha) return res.status(500).json({ error: errorFicha.message });
  if (!ficha) return res.status(404).json({ error: 'Docente no encontrado' });

  // Asume que v_docente_seccion_consolidada tiene una columna docente_id.
  // Ajustar el nombre de la columna si difiere en la vista real.
  const { data: cursos, error: errorCursos } = await supabase
    .from('v_docente_seccion_consolidada')
    .select('*')
    .eq('docente_id', id);

  if (errorCursos) return res.status(500).json({ error: errorCursos.message });

  res.json({ ...ficha, cursos });
}
