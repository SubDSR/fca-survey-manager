import { supabase } from '../config/supabase.js';

const CAMPOS_FICHA =
  'id, nombre_completo, numero_documento, tipo_documento, condicion, facultad, grado_academico, correo_institucional, tiene_portafolio, registrado_sunedu';

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
  const { data: cursos, error: errorCursos } = await supabase
    .from('v_docente_seccion_consolidada')
    .select('*')
    .eq('docente_id', id);

  if (errorCursos) return res.status(500).json({ error: errorCursos.message });

  // Obtener datos para los gráficos
  const { data: evaluaciones } = await supabase
    .from('v_docente_promedio_historico')
    .select('periodo, promedio')
    .eq('docente_id', id)
    .order('periodo');

  const { data: evaluacionesCiclo } = await supabase
    .from('v_docente_promedio_diario')
    .select('periodo, promedio')
    .eq('docente_id', id); // Ya está ordenado por fecha en la vista

  // Calcular promedios actuales/históricos si existen, si no 0.00
  const promedioActual = evaluacionesCiclo && evaluacionesCiclo.length > 0 
    ? evaluacionesCiclo[evaluacionesCiclo.length - 1].promedio 
    : 0;
  
  const promedioHistorico = evaluaciones && evaluaciones.length > 0
    ? (evaluaciones.reduce((acc, curr) => acc + Number(curr.promedio), 0) / evaluaciones.length).toFixed(1)
    : 0;

  res.json({ 
    ...ficha, 
    cursos,
    promedioHistorico: promedioHistorico,
    promedioActual: promedioActual,
    evaluaciones: evaluaciones || [],
    evaluacionesCiclo: evaluacionesCiclo || []
  });
}
