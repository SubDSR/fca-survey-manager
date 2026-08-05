import { supabase } from '../config/supabase.js';
import { normalizarTexto } from '../utils/normalizar.js';
import { construirRespuestas } from './importarEncuestas.js';

// Pipeline de encuestas VIRTUALES: el CSV no trae Programa/Docente/Curso/
// Ciclo/Sección por fila (a diferencia del CSV presencial) — todo el
// archivo pertenece a UN solo curso_grupo_docente, elegido por el usuario
// en la UI antes de subir el archivo. Por eso este servicio es un pipeline
// propio, más simple que importarFilasCsv (sin resolver plan/grupo/
// asignatura/docente/curso_grupo_docente por fila), en vez de una rama
// condicional dentro de aquel.

// Mapeo columna CSV -> código de pregunta interno (P1-P9), verificado
// contra pregunta.enunciado/etiqueta_corta en la BD (cuestionario_id=1,
// única campaña/cuestionario vigente hoy). P1-P8 coinciden en significado
// con el enunciado real de su pregunta. P9 es la excepción documentada:
// el enunciado real de pregunta.id para P9 es "Disponibilidad anticipada
// del material del curso" (etiqueta_corta "Material"), que NO coincide en
// significado con esta columna del formulario virtual ("Entrega de
// notas"). Se mapea igual, posicionalmente (3ra pregunta DIM_II del
// formulario virtual), por decisión explícita del usuario — el "% Material"
// que resulte de encuestas virtuales en realidad refleja respuestas sobre
// entrega de notas, no disponibilidad de material.
const COLUMNA_A_CODIGO_PREGUNTA = {
  'Calidad expositiva del docente': 'P1',
  'Nivel de conocimiento del docente': 'P2',
  'Capacidad del profesor para relacionar los objetivos del curso ofrecido': 'P3',
  'Cumplimiento de los objetivos del curso ofrecido': 'P4',
  'Satisfacción con la metodología de enseñanza aplicada por el docente': 'P5',
  'Apreciación general del contenido en relación con sus expectativas': 'P6',
  'Puntualidad y Cumplimiento de Horario del Docente': 'P7',
  'Entrega del Sílabus en el Aula Virtual': 'P8',
  'Entrega de notas': 'P9',
};

const COLUMNA_RESPUESTA_NUMERO = 'Respuesta número';
const COLUMNA_COMENTARIOS = 'Comentarios adicionales u observaciones sobre el desempeño del docente';

// Orden real del CSV virtual (ver ejemplo del usuario) — usado para validar
// el encabezado subido y para generar la plantilla de ejemplo.
export const COLUMNAS_ESPERADAS_VIRTUAL = [
  COLUMNA_RESPUESTA_NUMERO,
  ...Object.keys(COLUMNA_A_CODIGO_PREGUNTA),
  COLUMNA_COMENTARIOS,
];

// Catálogos mínimos: a diferencia de cargarCatalogos() en
// importarEncuestas.js, acá no hace falta programa/modalidad/mapa de
// programas — el curso_grupo_docente ya viene fijo.
async function cargarCatalogosVirtual() {
  const resultados = await Promise.all([
    supabase.from('escala').select('id, tipo'),
    supabase.from('pregunta').select('id, codigo, escala_id'),
    supabase.from('opcion_escala').select('id, escala_id, codigo, etiqueta'),
  ]);
  const NOMBRES_CATALOGO = ['escala', 'pregunta', 'opcion_escala'];
  resultados.forEach((r, i) => {
    if (r.error) throw new Error(`No se pudo cargar el catálogo "${NOMBRES_CATALOGO[i]}": ${r.error.message}`);
  });

  const [{ data: escalas }, { data: preguntas }, { data: opciones }] = resultados;

  return {
    tipoPorEscalaId: new Map((escalas || []).map((e) => [e.id, e.tipo])),
    preguntaPorCodigo: new Map((preguntas || []).map((p) => [p.codigo, p])),
    opcionPorEtiqueta: new Map((opciones || []).map((o) => [normalizarTexto(o.etiqueta), o.id])),
  };
}

async function resolverGrupoId(cursoGrupoDocenteId) {
  const { data, error } = await supabase
    .from('curso_grupo_docente')
    .select('id, curso_grupo:curso_grupo_id(grupo_id)')
    .eq('id', cursoGrupoDocenteId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`curso_grupo_docente ${cursoGrupoDocenteId} no encontrado`);
  return data.curso_grupo.grupo_id;
}

// A diferencia de resolverEncuestado() en importarEncuestas.js (que calcula
// la siguiente secuencia libre para poder reusar un mismo código entre
// cargas distintas), acá el código es sintético y único por carga
// ("V-{cargaId}-{respuestaNumero}") y la secuencia es literalmente el
// "Respuesta número" del CSV: no hay secuencia que calcular ni encuestado
// que buscar/reusar entre filas — cada fila crea el suyo directamente.
async function crearEncuestadoVirtual({ campaniaId, grupoId, codigo, secuencia, cargaId }) {
  const { data, error } = await supabase
    .from('encuestado')
    .insert({ campania_id: campaniaId, grupo_id: grupoId, codigo, secuencia, carga_id: cargaId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// ============================================================
// Punto de entrada: procesa todas las filas del CSV virtual ya parseado.
// Devuelve { filasInsertadas, errores, omitidas, advertencias } — misma
// forma que importarFilasCsv, para que subirCarga() no tenga que distinguir
// el resultado según el tipo de carga.
// ============================================================
export async function importarFilasCsvVirtual(filas, { campaniaId, cargaId, cursoGrupoDocenteId }) {
  const catalogos = await cargarCatalogosVirtual();
  const grupoId = await resolverGrupoId(cursoGrupoDocenteId);

  const errores = [];
  const omitidas = [];
  let filasInsertadas = 0;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const numeroFila = i + 2;

    try {
      const respuestaNumeroCsv = (fila[COLUMNA_RESPUESTA_NUMERO] || '').trim();
      const secuencia = parseInt(respuestaNumeroCsv, 10);
      if (!respuestaNumeroCsv || Number.isNaN(secuencia)) {
        throw new Error(`"${COLUMNA_RESPUESTA_NUMERO}" inválida: "${fila[COLUMNA_RESPUESTA_NUMERO]}"`);
      }
      const codigo = `V-${cargaId}-${respuestaNumeroCsv}`;

      const encuestadoId = await crearEncuestadoVirtual({
        campaniaId, grupoId, codigo, secuencia, cargaId,
      });

      const { data: encuesta, error: errorEncuesta } = await supabase
        .from('encuesta')
        .insert({
          encuestado_id: encuestadoId,
          curso_grupo_docente_id: cursoGrupoDocenteId,
          carga_id: cargaId,
          origen: 'WEB',
        })
        .select('id')
        .single();
      if (errorEncuesta) throw errorEncuesta;

      // Reindexa la fila del CSV virtual (encabezados = texto de la
      // pregunta) a la forma {P1..P9} que espera construirRespuestas(). La
      // columna de comentarios (texto libre) se descarta a propósito: no
      // existe columna en `respuesta` para guardarla — decisión confirmada.
      const filaPreguntas = {};
      for (const [columna, codigoPregunta] of Object.entries(COLUMNA_A_CODIGO_PREGUNTA)) {
        filaPreguntas[codigoPregunta] = fila[columna];
      }

      try {
        const filasRespuesta = construirRespuestas({ encuestaId: encuesta.id, fila: filaPreguntas, catalogos });
        const { error: errorRespuestas } = await supabase.from('respuesta').insert(filasRespuesta);
        if (errorRespuestas) throw errorRespuestas;
      } catch (errRespuestas) {
        await supabase.from('encuesta').delete().eq('id', encuesta.id);
        throw errRespuestas;
      }

      filasInsertadas++;
    } catch (err) {
      errores.push({ fila: numeroFila, mensaje: err.message });
    }
  }

  return { filasInsertadas, errores, omitidas, advertencias: [] };
}
