import { supabase } from '../config/supabase.js';

const VENTANA_CORRELACION_MS = 10 * 60 * 1000; // 10 minutos

// GET /api/catalogo/huerfanos — docente/asignatura sin ningún
// curso_grupo_docente asociado (herramienta de diagnóstico, NO borra nada).
//
// "carga_probable" es un INDICIO, no una prueba: no existe ninguna columna
// ni relación real que ligue un docente/asignatura a la carga_csv que lo
// creó (confirmado al investigar para esta tarea — ni resolverDocente() ni
// resolverAsignatura() en importarEncuestas.js guardan ese dato, y
// audit_log solo tiene created_at, sin carga_id ni usuario). Se calcula por
// cercanía de fecha_carga (la carga_csv más reciente cuya fecha_carga es
// anterior y está a menos de 10 minutos del created_at del registro) —
// puede estar equivocado, por ejemplo si alguien dio de alta un docente a
// mano justo mientras corría una carga. Úsalo solo para orientar la
// revisión manual, nunca para decidir automáticamente.
export async function listarCatalogoHuerfanos(req, res) {
  const [
    { data: docentes, error: errorDocentes },
    { data: asignaturas, error: errorAsignaturas },
    { data: cgdDocentes, error: errorCgdDocentes },
    { data: cgdAsignaturas, error: errorCgdAsignaturas },
    { data: cargas, error: errorCargas },
  ] = await Promise.all([
    supabase.from('docente').select('id, nombre_completo, created_at'),
    supabase.from('asignatura').select('id, nombre, created_at'),
    supabase.from('curso_grupo_docente').select('docente_id'),
    supabase.from('curso_grupo_docente').select('curso_grupo:curso_grupo_id(asignatura_id)'),
    supabase.from('carga_csv').select('id, archivo_nombre, fecha_carga').order('fecha_carga', { ascending: false }),
  ]);

  const errorEncontrado = [errorDocentes, errorAsignaturas, errorCgdDocentes, errorCgdAsignaturas, errorCargas].find(Boolean);
  if (errorEncontrado) return res.status(500).json({ error: errorEncontrado.message });

  const docenteIdsConCurso = new Set((cgdDocentes || []).map((c) => c.docente_id));
  const asignaturaIdsConCurso = new Set(
    (cgdAsignaturas || [])
      .map((c) => c.curso_grupo?.asignatura_id)
      .filter((id) => id !== undefined && id !== null)
  );

  const cargaProbable = (createdAt) => {
    const t = new Date(createdAt).getTime();
    let mejor = null;
    for (const c of cargas || []) {
      const tc = new Date(c.fecha_carga).getTime();
      if (tc <= t && t - tc < VENTANA_CORRELACION_MS && (!mejor || tc > new Date(mejor.fecha_carga).getTime())) {
        mejor = c;
      }
    }
    return mejor ? { id: mejor.id, archivo_nombre: mejor.archivo_nombre } : null;
  };

  const docentesHuerfanos = (docentes || [])
    .filter((d) => !docenteIdsConCurso.has(d.id))
    .map((d) => ({
      tipo: 'docente',
      id: d.id,
      nombre: d.nombre_completo,
      created_at: d.created_at,
      carga_probable: cargaProbable(d.created_at),
    }));

  const asignaturasHuerfanas = (asignaturas || [])
    .filter((a) => !asignaturaIdsConCurso.has(a.id))
    .map((a) => ({
      tipo: 'asignatura',
      id: a.id,
      nombre: a.nombre,
      created_at: a.created_at,
      carga_probable: cargaProbable(a.created_at),
    }));

  const resultado = [...docentesHuerfanos, ...asignaturasHuerfanas]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json(resultado);
}

// GET /api/catalogo/curso-grupo-docente-residual — curso_grupo_docente
// creados como sección "dispersa" (es_carga_oficial=false, ver
// resolverCursoGrupoDocente en importarEncuestas.js) que quedaron sin
// ninguna encuesta -- típicamente basura de pruebas de fuzzy matching
// ("Crear como nuevo") revertidas con fn_eliminar_carga, que borra
// encuesta/respuesta/encuestado pero nunca curso_grupo_docente.
// Diagnóstico, NO borra nada.
//
// EXCLUSIÓN OBLIGATORIA: cualquier curso_grupo_docente referenciado por
// revision_asignacion (como origen O como destino, en cualquier estado)
// queda fuera del reporte, aunque cumpla el mismo patrón de "0 encuestas +
// no oficial" -- es el rastro real de una incidencia YA RESUELTA (p. ej. el
// caso Tassara: su curso_grupo_docente_id original sigue en 0 encuestas
// porque la encuesta se reasignó a otro destino, pero revision_asignacion
// lo referencia como origen del caso resuelto). Borrar esa fila rompería
// la trazabilidad de auditoría -- no es un residuo de prueba.
export async function listarCursoGrupoDocenteResidual(req, res) {
  const [
    { data: candidatos, error: errorCandidatos },
    { data: revisiones, error: errorRevisiones },
  ] = await Promise.all([
    supabase
      .from('curso_grupo_docente')
      .select(`
        id, created_at,
        docente:docente_id(nombre_completo),
        curso_grupo:curso_grupo_id(
          asignatura:asignatura_id(nombre),
          grupo:grupo_id(ciclo, seccion, programa:programa_id(nombre_corto))
        )
      `)
      .eq('es_carga_oficial', false),
    supabase.from('revision_asignacion').select('curso_grupo_docente_id, curso_grupo_docente_destino_id'),
  ]);

  const errorInicial = [errorCandidatos, errorRevisiones].find(Boolean);
  if (errorInicial) return res.status(500).json({ error: errorInicial.message });

  // `encuesta` tiene miles de filas -- traerla entera y cruzar en JS
  // corre el riesgo real de toparse con el límite por defecto de filas de
  // PostgREST (1000) y perder encuestas de candidatos que sí están en uso,
  // generando falsos positivos. Se acota la consulta a los ids candidatos
  // (es_carga_oficial=false, típicamente unas pocas decenas) en vez de
  // traer toda la tabla.
  const idsCandidatos = (candidatos || []).map((c) => c.id);
  const { data: encuestas, error: errorEncuestas } = idsCandidatos.length > 0
    ? await supabase.from('encuesta').select('curso_grupo_docente_id').in('curso_grupo_docente_id', idsCandidatos)
    : { data: [], error: null };
  if (errorEncuestas) return res.status(500).json({ error: errorEncuestas.message });

  const idsConEncuesta = new Set((encuestas || []).map((e) => e.curso_grupo_docente_id));

  const idsEnRevision = new Set();
  (revisiones || []).forEach((r) => {
    if (r.curso_grupo_docente_id !== null) idsEnRevision.add(r.curso_grupo_docente_id);
    if (r.curso_grupo_docente_destino_id !== null) idsEnRevision.add(r.curso_grupo_docente_destino_id);
  });

  const residuales = (candidatos || [])
    .filter((c) => !idsConEncuesta.has(c.id) && !idsEnRevision.has(c.id))
    .map((c) => ({
      curso_grupo_docente_id: c.id,
      docente: c.docente?.nombre_completo,
      curso: c.curso_grupo?.asignatura?.nombre,
      programa: c.curso_grupo?.grupo?.programa?.nombre_corto,
      ciclo: c.curso_grupo?.grupo?.ciclo,
      seccion: c.curso_grupo?.grupo?.seccion,
      created_at: c.created_at,
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json(residuales);
}

// POST /api/catalogo/consolidar-secciones — corre fn_autoconsolidar_secciones()
// bajo demanda (p_solo_faltantes=true siempre: solo mapea secciones
// dispersas que TODAVÍA no tienen fila en curso_grupo_docente_consolidacion,
// nunca reescribe ni borra un mapeo ya existente, automático o manual).
//
// LO QUE ESTO NO HACE (investigado antes de decidir si automatizarla —
// ver docs/plans/, tarea de integración de fn_autoconsolidar_secciones):
// no toca revision_asignacion para nada, ni la lee ni la actualiza. Son
// dos mecanismos independientes que resultan mirar el mismo problema
// (secciones dispersas) desde ángulos distintos:
//   - curso_grupo_docente_consolidacion / esta función: redirect NO
//     destructivo solo para las vistas de reporte (v_encuesta_seccion_efectiva
//     y lo que se arma sobre ella) -- no mueve ninguna encuesta real, elige
//     el destino con una heurística ciega ("bucket con menos encuestas").
//   - revision_asignacion: cola de revisión HUMANA -- "reasignar" sí mueve
//     encuesta.curso_grupo_docente_id de verdad, "confirmar"/"descartar"
//     son decisiones explícitas de una persona.
// Confirmado contra la BD real: las 34 filas que ya dejó la única corrida
// histórica de esta función (2026-07-31, antes de que existiera
// revision_asignacion) siguen TODAS con su incidencia en estado 'pendiente'
// en revision_asignacion -- correr esta función no las resuelve, ni las
// toca. Por eso NO se invoca automáticamente en importarFilasCsv: hacerlo
// aplicaría un redirect silencioso de reportes a una sección que un humano
// todavía no revisó por el canal que sí importa (revision_asignacion),
// pudiendo dar la impresión de que "ya se resolvió" cuando nadie decidió
// nada. Se deja solo como acción manual explícita.
export async function consolidarSecciones(req, res) {
  const { data, error } = await supabase.rpc('fn_autoconsolidar_secciones', { p_solo_faltantes: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({
    nuevas_consolidaciones: data,
    nota: 'Esto solo actualiza redirects de reportes (curso_grupo_docente_consolidacion). '
      + 'No resuelve ni modifica ninguna incidencia de revision_asignacion -- '
      + 'esas siguen requiriendo revisión manual vía GET /api/revisiones.',
  });
}
