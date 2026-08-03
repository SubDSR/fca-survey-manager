import { supabase } from '../config/supabase.js';

const CAMPOS_FICHA_LISTADO =
  'id, nombre_completo, condicion, facultad, grado_academico, correo_institucional, tiene_portafolio, registrado_sunedu';

// TODO: numero_documento/tipo_documento (DNI) no deberían exponerse sin
// control de acceso. Sin autenticación todavía en el proyecto, se acepta
// el riesgo acotado a un docente a la vez (perfil individual, uso
// intencional en el frontend para el campo "N° Doc."), pero NO en el
// listado completo — proteger ambos endpoints cuando se agregue auth.
const CAMPOS_FICHA_DETALLE = `${CAMPOS_FICHA_LISTADO}, numero_documento, tipo_documento`;

export async function listarDocentes(req, res) {
  const { data, error } = await supabase
    .from('v_docente_ficha')
    .select(CAMPOS_FICHA_LISTADO);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function obtenerDocentePorId(req, res) {
  const { id } = req.params;

  const { data: ficha, error: errorFicha } = await supabase
    .from('v_docente_ficha')
    .select(CAMPOS_FICHA_DETALLE)
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

  // Obtener datos para el gráfico histórico
  const { data: evaluaciones } = await supabase
    .from('v_docente_promedio_historico')
    .select('periodo, promedio')
    .eq('docente_id', id)
    .order('periodo');

  const promedioHistorico = evaluaciones && evaluaciones.length > 0
    ? (evaluaciones.reduce((acc, curr) => acc + Number(curr.promedio), 0) / evaluaciones.length).toFixed(1)
    : 0;

  const promedioActual = await calcularPromedioActual(id);

  res.json({
    ...ficha,
    cursos,
    promedioHistorico: promedioHistorico,
    promedioActual: promedioActual,
    evaluaciones: evaluaciones || [],
  });
}

// Promedio de TODAS las respuestas numéricas del docente en el período
// académico EN_CURSO (no la última carga ni el último día — el período
// activo completo). Consulta directa en vez de una vista: es un solo
// número, no hace falta materializarlo como vista de reportes.
async function calcularPromedioActual(docenteId) {
  const { data, error } = await supabase
    .from('respuesta')
    .select(`
      valor_numerico,
      encuesta:encuesta_id!inner(
        carga_id,
        carga_csv:carga_id(visible),
        curso_grupo_docente:curso_grupo_docente_id!inner(
          docente_id,
          curso_grupo:curso_grupo_id!inner(
            grupo:grupo_id!inner(
              periodo_academico:periodo_academico_id!inner(estado)
            )
          )
        )
      )
    `)
    .eq('respondida', true)
    .eq('escala_tipo', 'NUMERICA')
    .eq('encuesta.curso_grupo_docente.docente_id', docenteId)
    .eq('encuesta.curso_grupo_docente.curso_grupo.grupo.periodo_academico.estado', 'EN_CURSO');

  if (error || !data) return 0;

  // Respeta cargas ocultas igual que las vistas de reportes: carga_id NULL
  // (heredada) siempre cuenta; con carga_id, solo si esa carga es visible.
  const respuestas = data.filter((r) => {
    const carga = r.encuesta?.carga_id;
    return carga === null || r.encuesta?.carga_csv?.visible === true;
  });

  if (respuestas.length === 0) return 0;

  const promedio = respuestas.reduce((acc, r) => acc + Number(r.valor_numerico), 0) / respuestas.length;
  return Number((promedio * 2).toFixed(1));
}
