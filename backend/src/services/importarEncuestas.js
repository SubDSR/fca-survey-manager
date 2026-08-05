import { supabase } from '../config/supabase.js';
import { normalizarTexto, claveCarga, cicloDesdeRomano } from '../utils/normalizar.js';
import { parsearNombreDocente } from '../utils/parsearNombre.js';

const MODALIDAD_DEFECTO = 'PRESENCIAL'; // ASUNCIÓN: el CSV no trae modalidad.

// Umbrales del árbol de decisión de fuzzy matching (ver
// docs/plans/2026-08-04-modulo-configuracion-design.md, sección 4.4):
//   0 candidatos (similitud < UMBRAL_MINIMO para todos) -> crear nuevo
//   1 candidato con similitud >= UMBRAL_AUTOACEPTAR -> usar ese id + advertencia
//   cualquier otro caso con >=1 candidato -> ambiguo, encolar en carga_pendiente
const UMBRAL_MINIMO = 0.6;
const UMBRAL_AUTOACEPTAR = 0.85;
const LIMITE_CANDIDATOS = 5;

// ============================================================
// Catálogos — se cargan una vez por carga de CSV, no por fila.
// ============================================================
async function cargarCatalogos() {
  const resultados = await Promise.all([
    supabase.schema('staging').from('map_programa').select('etiqueta_origen, programa_codigo'),
    supabase.from('programa').select('id, codigo').eq('activo', true),
    supabase.from('escala').select('id, tipo'),
    supabase.from('pregunta').select('id, codigo, escala_id'),
    supabase.from('opcion_escala').select('id, escala_id, codigo, etiqueta'),
    supabase.from('modalidad').select('id, codigo'),
  ]);

  const NOMBRES_CATALOGO = [
    'staging.map_programa',
    'programa',
    'escala',
    'pregunta',
    'opcion_escala',
    'modalidad',
  ];
  resultados.forEach((r, i) => {
    if (r.error) {
      throw new Error(`No se pudo cargar el catálogo "${NOMBRES_CATALOGO[i]}": ${r.error.message}`);
    }
  });

  const [
    { data: mapaProgramas },
    { data: programas },
    { data: escalas },
    { data: preguntas },
    { data: opciones },
    { data: modalidades },
  ] = resultados;

  const programaIdPorCodigo = new Map((programas || []).map((p) => [p.codigo, p.id]));
  const programaIdPorEtiqueta = new Map(
    (mapaProgramas || [])
      .map((m) => [normalizarTexto(m.etiqueta_origen), programaIdPorCodigo.get(m.programa_codigo)])
      .filter(([, id]) => id !== undefined)
  );

  // No hardcodeamos "escala_id === 1 => NUMERICA": los ids de escala son
  // datos, no contrato. Se resuelve el tipo real vía escala.tipo.
  const tipoPorEscalaId = new Map((escalas || []).map((e) => [e.id, e.tipo]));
  const preguntaPorCodigo = new Map((preguntas || []).map((p) => [p.codigo, p]));
  const opcionPorEtiqueta = new Map((opciones || []).map((o) => [normalizarTexto(o.etiqueta), o.id]));
  const modalidadDefectoId = (modalidades || []).find((m) => m.codigo === MODALIDAD_DEFECTO)?.id;
  if (!modalidadDefectoId) {
    throw new Error(`No se encontró la modalidad por defecto "${MODALIDAD_DEFECTO}"`);
  }

  return { programaIdPorEtiqueta, tipoPorEscalaId, preguntaPorCodigo, opcionPorEtiqueta, modalidadDefectoId };
}

// Arma el contexto compartido de una pasada de importación (catálogos +
// caches de resolución). Exportado: el endpoint de resolución de
// pendientes (POST /api/cargas/pendientes/:id/resolver) lo usa para volver
// a llamar procesarFila() días después de la carga original, con su propio
// contexto fresco (no hay caches que reusar entre requests HTTP distintos).
export async function crearContextoImportacion() {
  const catalogos = await cargarCatalogos();
  return {
    catalogos,
    cachePlanes: new Map(),
    cacheAsignaturas: new Map(),
    cacheDocentes: new Map(),
    cacheEncuestados: new Map(),
  };
}

async function resolverPlanEstudios(programaId, anioPeriodo) {
  const { data, error } = await supabase
    .from('plan_estudios')
    .select('id, anio')
    .eq('programa_id', programaId)
    .eq('activo', true)
    .order('anio', { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return null;

  // ASUNCIÓN: varios programas tienen 2+ planes "activos" simultáneos
  // (2023 y 2026). Preferimos el año exacto del período; si no existe, el
  // más reciente <= año del período; si tampoco, el más reciente de todos.
  return (
    data.find((p) => p.anio === anioPeriodo) ||
    data.find((p) => p.anio <= anioPeriodo) ||
    data[0]
  ).id;
}

// Devuelve { id, plan_estudios_id }. La clave real de "grupo" es
// uq_grupo = UNIQUE (periodo_academico_id, programa_id, ciclo, seccion) —
// plan_estudios_id NO forma parte de ella. Un programa puede tener 2+
// planes activos a la vez (p. ej. DOCTORADO con planes 2021 y 2025); si la
// búsqueda filtrara también por plan_estudios_id, un grupo ya creado con el
// plan viejo no se encontraría al resolver el plan nuevo, y el insert
// siguiente violaría uq_grupo igual, porque la BD sí lo trata como el mismo
// grupo. Por eso se devuelve el plan_estudios_id REAL del grupo existente,
// no el recién calculado.
async function resolverGrupo({ periodoId, programaId, planEstudiosIdCalculado, ciclo, seccion, modalidadDefectoId }) {
  const { data: existente, error: errorBusqueda } = await supabase
    .from('grupo')
    .select('id, plan_estudios_id')
    .eq('periodo_academico_id', periodoId)
    .eq('programa_id', programaId)
    .eq('ciclo', ciclo)
    .eq('seccion', seccion)
    .maybeSingle();
  if (errorBusqueda) throw errorBusqueda;
  if (existente) return existente;

  const { data: nuevo, error: errorInsert } = await supabase
    .from('grupo')
    .insert({
      periodo_academico_id: periodoId,
      programa_id: programaId,
      plan_estudios_id: planEstudiosIdCalculado,
      ciclo,
      seccion,
      modalidad_id: modalidadDefectoId,
    })
    .select('id, plan_estudios_id')
    .single();
  if (errorInsert) throw errorInsert;
  return nuevo;
}

// Árbol de decisión (sección 4.4 del diseño), común a docente/asignatura:
//   1. Match exacto por clave -> resuelto, sin llamar al fuzzy matcher.
//   2. MISS exacto -> fn_buscar_*_similar(clave, 0.6, 5):
//      a. 0 candidatos            -> null (el llamador crea uno nuevo)
//      b. 1 candidato, sim >= .85 -> resuelto + advertencia
//      c. cualquier otro caso     -> pendiente (ambiguo, no se crea nada)
function evaluarCandidatos(candidatos) {
  if (!candidatos || candidatos.length === 0) return { caso: 'sin_candidatos' };
  if (candidatos.length === 1 && candidatos[0].similitud >= UMBRAL_AUTOACEPTAR) {
    return { caso: 'autoaceptar', elegido: candidatos[0] };
  }
  return { caso: 'ambiguo', candidatos };
}

async function resolverAsignatura({ planEstudiosId, nombreCurso, cacheAsignaturas }) {
  const clave = normalizarTexto(nombreCurso);
  if (!cacheAsignaturas.has(planEstudiosId)) {
    // Se usa la columna generada clave_busqueda (ya calculada por la BD con
    // fn_normaliza_texto) en vez de recalcularla en JS: si la fórmula cambia
    // en el server, este matching no se desincroniza.
    const { data, error } = await supabase
      .from('asignatura')
      .select('id, clave_busqueda')
      .eq('plan_estudios_id', planEstudiosId);
    if (error) throw error;
    cacheAsignaturas.set(planEstudiosId, new Map((data || []).map((a) => [a.clave_busqueda, a.id])));
  }
  const mapa = cacheAsignaturas.get(planEstudiosId);
  if (mapa.has(clave)) return { estado: 'resuelto', id: mapa.get(clave) };

  const { data: candidatos, error: errorFuzzy } = await supabase.rpc('fn_buscar_asignatura_similar', {
    p_plan_estudios_id: planEstudiosId, p_clave: clave, p_umbral: UMBRAL_MINIMO, p_limite: LIMITE_CANDIDATOS,
  });
  if (errorFuzzy) throw errorFuzzy;

  const evaluacion = evaluarCandidatos(candidatos);

  if (evaluacion.caso === 'autoaceptar') {
    mapa.set(clave, evaluacion.elegido.id);
    return {
      estado: 'resuelto',
      id: evaluacion.elegido.id,
      advertencia:
        `Curso "${nombreCurso}" → matched como "${evaluacion.elegido.nombre}" ` +
        `con similitud ${evaluacion.elegido.similitud.toFixed(2)}`,
    };
  }

  if (evaluacion.caso === 'ambiguo') {
    return {
      estado: 'pendiente',
      candidatos: evaluacion.candidatos.map((c) => ({ id: c.id, nombre: c.nombre, similitud: c.similitud })),
    };
  }

  // sin_candidatos -> crear nuevo (comportamiento actual, sin cambios)
  const esElectivo = /electivo/i.test(nombreCurso);
  const { data: nueva, error } = await supabase
    .from('asignatura')
    .insert({ plan_estudios_id: planEstudiosId, nombre: nombreCurso.trim(), es_electivo: esElectivo })
    .select('id')
    .single();
  if (error) throw error;
  mapa.set(clave, nueva.id);
  return { estado: 'resuelto', id: nueva.id };
}

async function resolverDocente({ nombreCsv, cacheDocentes }) {
  if (!cacheDocentes.cargado) {
    // Igual que en asignatura: se usa clave_busqueda tal como la generó la
    // BD, en vez de reconstruir "paterno materno, nombres" en JS.
    const { data, error } = await supabase.from('docente').select('id, clave_busqueda');
    if (error) throw error;
    (data || []).forEach((d) => cacheDocentes.set(d.clave_busqueda, d.id));
    cacheDocentes.cargado = true;
  }

  const clave = claveCarga(nombreCsv);
  if (cacheDocentes.has(clave)) return { estado: 'resuelto', id: cacheDocentes.get(clave) };

  const { data: candidatos, error: errorFuzzy } = await supabase.rpc('fn_buscar_docente_similar', {
    p_clave: clave, p_umbral: UMBRAL_MINIMO, p_limite: LIMITE_CANDIDATOS,
  });
  if (errorFuzzy) throw errorFuzzy;

  const evaluacion = evaluarCandidatos(candidatos);

  if (evaluacion.caso === 'autoaceptar') {
    cacheDocentes.set(clave, evaluacion.elegido.id);
    return {
      estado: 'resuelto',
      id: evaluacion.elegido.id,
      advertencia:
        `Docente "${nombreCsv}" → matched como "${evaluacion.elegido.nombre_completo}" ` +
        `con similitud ${evaluacion.elegido.similitud.toFixed(2)}`,
    };
  }

  if (evaluacion.caso === 'ambiguo') {
    return {
      estado: 'pendiente',
      candidatos: evaluacion.candidatos.map((c) => ({ id: c.id, nombre: c.nombre_completo, similitud: c.similitud })),
    };
  }

  // sin_candidatos -> crear nuevo (comportamiento actual, sin cambios)
  const partes = parsearNombreDocente(nombreCsv);
  const { data: nuevo, error } = await supabase
    .from('docente')
    .insert({ ...partes, en_roster_encuestas: true })
    .select('id')
    .single();
  if (error) throw error;
  cacheDocentes.set(clave, nuevo.id);
  return { estado: 'resuelto', id: nuevo.id };
}

// Regla de es_carga_oficial (aprobada tras revisar fn_autoconsolidar_secciones,
// que exige >=1 fila oficial Y >=1 dispersa por (docente,asignatura) para
// actuar — nunca promueve una fila false a true, solo mapea):
//   - Si es la PRIMERA fila que existe para este (docente, asignatura) en
//     cualquier grupo/ciclo -> es_carga_oficial = true (alta legítima).
//   - Si ya existe alguna -> la nueva nace false (probable sección dispersa);
//     fn_autoconsolidar_secciones() la recogerá en su próxima corrida.
// Devuelve { id, advertencia? }.
async function resolverCursoGrupoDocente({ grupoId, asignaturaId, docenteId, nombreDocenteCsv, nombreCurso }) {
  const { data: cursoGrupo, error: errorCG } = await supabase
    .from('curso_grupo')
    .select('id')
    .eq('grupo_id', grupoId)
    .eq('asignatura_id', asignaturaId)
    .maybeSingle();
  if (errorCG) throw errorCG;

  let cursoGrupoId = cursoGrupo?.id;
  if (!cursoGrupoId) {
    const { data: nuevo, error } = await supabase
      .from('curso_grupo')
      .insert({ grupo_id: grupoId, asignatura_id: asignaturaId })
      .select('id')
      .single();
    if (error) throw error;
    cursoGrupoId = nuevo.id;
  }

  const { data: cgdExistente, error: errorCGD } = await supabase
    .from('curso_grupo_docente')
    .select('id')
    .eq('curso_grupo_id', cursoGrupoId)
    .eq('docente_id', docenteId)
    .maybeSingle();
  if (errorCGD) throw errorCGD;
  if (cgdExistente) return { id: cgdExistente.id };

  // Validado contra la BD real: el filtro sobre tabla embebida
  // (curso_grupo!inner) funciona correctamente vía PostgREST.
  const { count: otrasSecciones, error: errorConteo } = await supabase
    .from('curso_grupo_docente')
    .select('id, curso_grupo!inner(asignatura_id)', { count: 'exact', head: true })
    .eq('docente_id', docenteId)
    .eq('curso_grupo.asignatura_id', asignaturaId);
  if (errorConteo) throw errorConteo;

  const esOficial = !otrasSecciones || otrasSecciones === 0;

  const { data: nuevo, error } = await supabase
    .from('curso_grupo_docente')
    .insert({ curso_grupo_id: cursoGrupoId, docente_id: docenteId, es_carga_oficial: esOficial })
    .select('id')
    .single();
  if (error) throw error;

  if (!esOficial) {
    return {
      id: nuevo.id,
      advertencia:
        `Sección nueva marcada como dispersa (es_carga_oficial=false): docente "${nombreDocenteCsv}", ` +
        `curso "${nombreCurso}" — ya existía otra sección oficial para este mismo docente+curso. ` +
        'Revisar si fn_autoconsolidar_secciones() la consolidó correctamente.',
    };
  }
  return { id: nuevo.id };
}

// Cada carga "es dueña" de sus propios encuestados: dentro de la MISMA
// carga, mismo (grupo, codigo) -> mismo encuestado (un estudiante que
// evalúa varios cursos en una subida sigue usando un solo encuestado). Entre
// cargas distintas, SIEMPRE se crea uno nuevo — no se busca/reusa por
// código, porque el código de encuesta física no es un identificador
// confiable en encuestas virtuales.
//
// OJO: uq_encuestado_campania_codigo = UNIQUE (campania_id, codigo,
// secuencia) es una constraint GLOBAL a la campaña, no distingue carga_id.
// Si el mismo código ya apareció en una carga anterior de esta campaña, hay
// que insertar con la siguiente secuencia libre o el insert choca contra
// esa constraint.
async function resolverEncuestado({ campaniaId, grupoId, codigo, cargaId, cacheEncuestados }) {
  const clave = `${grupoId}|${codigo}`;
  if (cacheEncuestados.has(clave)) return cacheEncuestados.get(clave);

  const { data: existente, error: errorBusqueda } = await supabase
    .from('encuestado')
    .select('id')
    .eq('carga_id', cargaId)
    .eq('grupo_id', grupoId)
    .eq('codigo', codigo)
    .maybeSingle();
  if (errorBusqueda) throw errorBusqueda;
  if (existente) {
    cacheEncuestados.set(clave, existente.id);
    return existente.id;
  }

  // uq_encuestado_campania_codigo = UNIQUE(campania_id, codigo, secuencia)
  // — no distingue carga_id. Con el diseño anterior (encuestado compartido
  // por código entre archivos) esto nunca importaba, porque solo existía
  // una fila por (campania_id, codigo). Ahora que cada carga es dueña de
  // sus propios encuestados, el mismo código puede — y va a — repetirse
  // entre cargas de la misma campaña, así que hay que calcular la
  // siguiente secuencia libre antes de insertar: insertar siempre con
  // secuencia=1 (el default) rompería la constraint apenas una segunda
  // carga trajera un código ya usado.
  const { data: ultimo, error: errorSecuencia } = await supabase
    .from('encuestado')
    .select('secuencia')
    .eq('campania_id', campaniaId)
    .eq('codigo', codigo)
    .order('secuencia', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errorSecuencia) throw errorSecuencia;
  const siguienteSecuencia = (ultimo?.secuencia || 0) + 1;

  const { data: nuevo, error } = await supabase
    .from('encuestado')
    .insert({ campania_id: campaniaId, grupo_id: grupoId, codigo, carga_id: cargaId, secuencia: siguienteSecuencia })
    .select('id')
    .single();
  if (error) throw error;
  cacheEncuestados.set(clave, nuevo.id);
  return nuevo.id;
}

const CODIGOS_PREGUNTA = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];

// Construye las 9 filas de `respuesta` para una encuesta ya insertada.
// Lanza si algún valor numérico del CSV no es parseable (en vez de mandar
// NaN a la BD, que rompería el check constraint de forma menos legible).
// Exportada: la reutiliza también importarEncuestasVirtual.js (misma forma
// de fila {P1..P9} y de catálogos {preguntaPorCodigo, tipoPorEscalaId,
// opcionPorEtiqueta}), sin duplicar la lógica de NUMERICA vs. categórica.
export function construirRespuestas({ encuestaId, fila, catalogos }) {
  return CODIGOS_PREGUNTA.map((codigoPregunta) => {
    const pregunta = catalogos.preguntaPorCodigo.get(codigoPregunta);
    // tipoPorEscalaId viene de un SELECT real a escala.tipo (ver
    // cargarCatalogos). NO hardcodear "pregunta.escala_id === 1 => NUMERICA":
    // el id de escala es un dato, no un contrato — si algún día se reordenan
    // o agregan escalas, un hardcodeo así clasificaría preguntas mal en
    // silencio (mandaría valor_numerico donde va opcion_escala_id o
    // viceversa) sin que ningún error lo delate hasta romper un constraint.
    const tipo = catalogos.tipoPorEscalaId.get(pregunta.escala_id);
    const valorCsv = (fila[codigoPregunta] || '').trim();

    const filaRespuesta = {
      encuesta_id: encuestaId,
      pregunta_id: pregunta.id,
      escala_id: pregunta.escala_id,
      escala_tipo: tipo,
    };

    if (tipo === 'NUMERICA') {
      if (valorCsv) {
        const valor = Number(valorCsv);
        if (Number.isNaN(valor)) {
          throw new Error(`Valor no numérico en ${codigoPregunta}: "${fila[codigoPregunta]}"`);
        }
        filaRespuesta.valor_numerico = valor;
      } else {
        filaRespuesta.valor_numerico = null;
      }
    } else {
      filaRespuesta.opcion_escala_id = valorCsv
        ? catalogos.opcionPorEtiqueta.get(normalizarTexto(valorCsv)) || null
        : null;
    }
    return filaRespuesta;
  });
}

// ============================================================
// Procesa UNA fila del CSV presencial hasta insertarla (o hasta detectar
// que debe quedar pendiente/omitida). Extraída de importarFilasCsv para
// que el endpoint de resolución de pendientes pueda re-ejecutar exactamente
// el mismo camino de inserción sobre una fila guardada en
// carga_pendiente.fila_completa, sin duplicar esta lógica.
//
// overrides.docenteId / overrides.asignaturaId: cuando vienen seteados
// (resolución de un pendiente ya decidido por un humano), se SALTAN
// resolverDocente()/resolverAsignatura() para ese campo — no tiene sentido
// volver a correr el fuzzy matcher sobre un dato que ya se decidió.
//
// Devuelve:
//   { resultado: 'insertada', advertencias: string[] }
//   { resultado: 'omitida', mensaje }
//   { resultado: 'pendiente', pendientes: [{ tipo, valorCsv, candidatos }] }
// Lanza en caso de error real (fila descartable, ver caller).
export async function procesarFila({ fila, periodo, campaniaId, cargaId, contexto, overrides = {} }) {
  const { catalogos, cachePlanes, cacheAsignaturas, cacheDocentes, cacheEncuestados } = contexto;

  const claveProgramaCsv = normalizarTexto(fila.Programa);
  const programaId = catalogos.programaIdPorEtiqueta.get(claveProgramaCsv);
  if (!programaId) {
    throw new Error(`Programa no reconocido en staging.map_programa: "${fila.Programa}"`);
  }

  if (!cachePlanes.has(programaId)) {
    const planId = await resolverPlanEstudios(programaId, periodo.anio);
    if (!planId) throw new Error(`Sin plan de estudios activo para el programa "${fila.Programa}"`);
    cachePlanes.set(programaId, planId);
  }

  const ciclo = cicloDesdeRomano(fila.Ciclo);
  const seccion = parseInt(fila.Seccion, 10);
  if (!ciclo || Number.isNaN(seccion)) {
    throw new Error(`Ciclo/Sección inválidos: "${fila.Ciclo}" / "${fila.Seccion}"`);
  }

  const grupo = await resolverGrupo({
    periodoId: periodo.id,
    programaId,
    planEstudiosIdCalculado: cachePlanes.get(programaId),
    ciclo,
    seccion,
    modalidadDefectoId: catalogos.modalidadDefectoId,
  });

  // Se usa el plan_estudios_id real del grupo (no el recién calculado):
  // si el grupo ya existía, pudo haberse creado con un plan distinto.
  const asignaturaResultado = overrides.asignaturaId
    ? { estado: 'resuelto', id: overrides.asignaturaId }
    : await resolverAsignatura({ planEstudiosId: grupo.plan_estudios_id, nombreCurso: fila.Curso, cacheAsignaturas });

  const docenteResultado = overrides.docenteId
    ? { estado: 'resuelto', id: overrides.docenteId }
    : await resolverDocente({ nombreCsv: fila.Docente, cacheDocentes });

  const pendientes = [];
  if (asignaturaResultado.estado === 'pendiente') {
    pendientes.push({ tipo: 'asignatura', valorCsv: fila.Curso, candidatos: asignaturaResultado.candidatos });
  }
  if (docenteResultado.estado === 'pendiente') {
    pendientes.push({ tipo: 'docente', valorCsv: fila.Docente, candidatos: docenteResultado.candidatos });
  }
  if (pendientes.length > 0) {
    return { resultado: 'pendiente', pendientes };
  }

  const advertenciasFila = [];
  if (asignaturaResultado.advertencia) advertenciasFila.push(asignaturaResultado.advertencia);
  if (docenteResultado.advertencia) advertenciasFila.push(docenteResultado.advertencia);

  const cgd = await resolverCursoGrupoDocente({
    grupoId: grupo.id,
    asignaturaId: asignaturaResultado.id,
    docenteId: docenteResultado.id,
    nombreDocenteCsv: fila.Docente,
    nombreCurso: fila.Curso,
  });
  if (cgd.advertencia) advertenciasFila.push(cgd.advertencia);

  const encuestadoId = await resolverEncuestado({
    campaniaId,
    grupoId: grupo.id,
    codigo: fila.Codigo,
    cargaId,
    cacheEncuestados,
  });

  // Dentro del mismo archivo: si la fila está literalmente repetida
  // (mismo encuestado + mismo dictado), se omite en vez de duplicar.
  const { data: encuestaExistente, error: errorBusquedaEncuesta } = await supabase
    .from('encuesta')
    .select('id')
    .eq('encuestado_id', encuestadoId)
    .eq('curso_grupo_docente_id', cgd.id)
    .maybeSingle();
  if (errorBusquedaEncuesta) throw errorBusquedaEncuesta;
  if (encuestaExistente) {
    return { resultado: 'omitida', mensaje: 'Fila duplicada dentro del mismo archivo — omitida.' };
  }

  const { data: encuesta, error: errorEncuesta } = await supabase
    .from('encuesta')
    .insert({ encuestado_id: encuestadoId, curso_grupo_docente_id: cgd.id, carga_id: cargaId })
    .select('id')
    .single();
  if (errorEncuesta) throw errorEncuesta;

  // Insert atómico POR FILA (no un batch acumulado al final de todas
  // las filas del CSV): las 9 respuestas se insertan junto con su
  // encuesta, dentro del mismo try/catch, y si esto falla se hace
  // rollback manual de la encuesta recién creada. Si en cambio se
  // acumularan las respuestas de las N filas en un array y se
  // insertaran todas juntas al final, una fila con datos inválidos más
  // adelante en el archivo haría fallar el insert completo o dejaría
  // huérfanas (sin sus 9 respuestas) a todas las encuestas de filas
  // anteriores ya insertadas — rompiendo el invariante 1 encuesta = 9
  // respuestas para el resto del archivo, no solo para la fila mala.
  try {
    const filasRespuesta = construirRespuestas({ encuestaId: encuesta.id, fila, catalogos });
    const { error: errorRespuestas } = await supabase.from('respuesta').insert(filasRespuesta);
    if (errorRespuestas) throw errorRespuestas;
  } catch (errRespuestas) {
    await supabase.from('encuesta').delete().eq('id', encuesta.id);
    throw errRespuestas;
  }

  return { resultado: 'insertada', advertencias: advertenciasFila };
}

// ============================================================
// Punto de entrada: procesa todas las filas del CSV parseado.
// Devuelve { filasInsertadas, errores, omitidas, advertencias, filasPendientes }.
// ============================================================
export async function importarFilasCsv(filas, periodo, campaniaId, cargaId) {
  const contexto = await crearContextoImportacion();

  const errores = [];
  const omitidas = [];
  const advertencias = [];
  let filasInsertadas = 0;
  let filasPendientes = 0;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const numeroFila = i + 2;

    try {
      const resultado = await procesarFila({ fila, periodo, campaniaId, cargaId, contexto });

      if (resultado.resultado === 'pendiente') {
        for (const p of resultado.pendientes) {
          const { error: errorPendiente } = await supabase.from('carga_pendiente').insert({
            carga_id: cargaId,
            fila_numero: numeroFila,
            tipo: p.tipo,
            valor_csv: p.valorCsv,
            fila_completa: fila,
            candidatos: p.candidatos,
          });
          if (errorPendiente) throw errorPendiente;
        }
        filasPendientes++;
        continue;
      }

      if (resultado.resultado === 'omitida') {
        omitidas.push({ fila: numeroFila, mensaje: resultado.mensaje });
        continue;
      }

      resultado.advertencias.forEach((mensaje) => advertencias.push({ fila: numeroFila, mensaje }));
      filasInsertadas++;
    } catch (err) {
      errores.push({ fila: numeroFila, mensaje: err.message });
    }
  }

  return { filasInsertadas, errores, omitidas, advertencias, filasPendientes };
}

// ============================================================
// Resolución de UN carga_pendiente (POST /api/cargas/pendientes/:id/resolver).
// Devuelve { estado, ... } — el controlador solo traduce a códigos HTTP.
// ============================================================
export async function resolverPendiente(pendienteId, { accion, docenteId, asignaturaId }) {
  const { data: pendiente, error: errorPendiente } = await supabase
    .from('carga_pendiente')
    .select('*')
    .eq('id', pendienteId)
    .maybeSingle();
  if (errorPendiente) throw errorPendiente;
  if (!pendiente) return { estado: 'no_encontrado' };
  if (pendiente.estado !== 'pendiente') return { estado: 'ya_resuelto', pendiente };

  let resueltoComoId = null;

  if (accion === 'usar_existente') {
    resueltoComoId = pendiente.tipo === 'docente' ? docenteId : asignaturaId;
    if (!resueltoComoId) return { estado: 'falta_id' };
    const tabla = pendiente.tipo === 'docente' ? 'docente' : 'asignatura';
    const { data: existe, error: errorExiste } = await supabase.from(tabla).select('id').eq('id', resueltoComoId).maybeSingle();
    if (errorExiste) throw errorExiste;
    if (!existe) return { estado: 'referencia_no_encontrada' };
  } else if (accion === 'crear_nuevo') {
    resueltoComoId = await crearDesdeCandidatoDescartado(pendiente);
  } else if (accion === 'descartar') {
    resueltoComoId = null;
  } else {
    return { estado: 'accion_invalida' };
  }

  const nuevoEstado = accion === 'descartar' ? 'descartada' : 'resuelta';
  const { error: errorUpdate } = await supabase
    .from('carga_pendiente')
    .update({ estado: nuevoEstado, resuelto_como_id: resueltoComoId, resuelto_en: new Date().toISOString() })
    .eq('id', pendienteId);
  if (errorUpdate) throw errorUpdate;

  await ajustarContadorPendientes(pendiente.carga_id, -1);

  // ¿Quedan otros pendientes (estado='pendiente') para esta misma fila?
  // Una fila puede tener 2 (docente Y asignatura ambiguos a la vez) — no se
  // inserta hasta que TODOS estén resueltos/descartados.
  const { data: otrosPendientes, error: errorOtros } = await supabase
    .from('carga_pendiente')
    .select('id')
    .eq('carga_id', pendiente.carga_id)
    .eq('fila_numero', pendiente.fila_numero)
    .eq('estado', 'pendiente');
  if (errorOtros) throw errorOtros;

  if (otrosPendientes && otrosPendientes.length > 0) {
    return { estado: 'resuelto_parcial', pendiente, resueltoComoId };
  }

  // Última pieza resuelta para esta fila -> reintentar la inserción.
  const { data: todosLosDeLaFila, error: errorTodos } = await supabase
    .from('carga_pendiente')
    .select('*')
    .eq('carga_id', pendiente.carga_id)
    .eq('fila_numero', pendiente.fila_numero);
  if (errorTodos) throw errorTodos;

  if (todosLosDeLaFila.some((p) => p.estado === 'descartada')) {
    // Al menos un dato de la fila se descartó -> nunca se puede insertar.
    return { estado: 'fila_descartada', pendiente, resueltoComoId };
  }

  const overrides = {};
  todosLosDeLaFila.forEach((p) => {
    if (p.tipo === 'docente') overrides.docenteId = p.resuelto_como_id;
    if (p.tipo === 'asignatura') overrides.asignaturaId = p.resuelto_como_id;
  });

  const { data: carga, error: errorCarga } = await supabase
    .from('carga_csv')
    .select('id, campania_id')
    .eq('id', pendiente.carga_id)
    .single();
  if (errorCarga) throw errorCarga;

  const { data: campania, error: errorCampania } = await supabase
    .from('campania_evaluacion')
    .select('periodo_academico_id')
    .eq('id', carga.campania_id)
    .single();
  if (errorCampania) throw errorCampania;

  const { data: periodo, error: errorPeriodo } = await supabase
    .from('periodo_academico')
    .select('id, anio')
    .eq('id', campania.periodo_academico_id)
    .single();
  if (errorPeriodo) throw errorPeriodo;

  const contexto = await crearContextoImportacion();

  try {
    const resultadoFila = await procesarFila({
      fila: pendiente.fila_completa,
      periodo,
      campaniaId: carga.campania_id,
      cargaId: carga.id,
      contexto,
      overrides,
    });

    if (resultadoFila.resultado === 'insertada') {
      await ajustarContadorInsertadas(carga.id, 1);
      return { estado: 'fila_insertada', pendiente, resueltoComoId };
    }
    // 'omitida' (duplicado dentro del archivo, detectado recién ahora)
    return { estado: 'fila_omitida', pendiente, resueltoComoId, mensaje: resultadoFila.mensaje };
  } catch (err) {
    return { estado: 'fila_error', pendiente, resueltoComoId, mensaje: err.message };
  }
}

// "Crear como nuevo" desde un pendiente: mismo alta que el camino "sin
// candidatos" de resolverDocente()/resolverAsignatura(), pero forzado por
// decisión humana en vez de automático. Para asignatura hace falta
// re-derivar plan_estudios_id desde fila_completa (Programa/Ciclo/Sección):
// el grupo ya existe a esta altura (se creó en la corrida original, ANTES
// de llegar a resolver docente/asignatura), así que resolverGrupo() solo lo
// encuentra, no lo duplica.
async function crearDesdeCandidatoDescartado(pendiente) {
  if (pendiente.tipo === 'docente') {
    const partes = parsearNombreDocente(pendiente.valor_csv);
    const { data: nuevo, error } = await supabase
      .from('docente')
      .insert({ ...partes, en_roster_encuestas: true })
      .select('id')
      .single();
    if (error) throw error;
    return nuevo.id;
  }

  const fila = pendiente.fila_completa;
  const claveProgramaCsv = normalizarTexto(fila.Programa);
  const { data: mapaPrograma, error: errorMapa } = await supabase
    .schema('staging')
    .from('map_programa')
    .select('programa_codigo')
    .eq('etiqueta_origen', fila.Programa)
    .maybeSingle();
  if (errorMapa) throw errorMapa;
  if (!mapaPrograma) throw new Error(`Programa no reconocido en staging.map_programa: "${fila.Programa}" (clave normalizada "${claveProgramaCsv}")`);

  const { data: programa, error: errorPrograma } = await supabase
    .from('programa')
    .select('id')
    .eq('codigo', mapaPrograma.programa_codigo)
    .single();
  if (errorPrograma) throw errorPrograma;

  const ciclo = cicloDesdeRomano(fila.Ciclo);
  const seccion = parseInt(fila.Seccion, 10);
  const { data: grupo, error: errorGrupo } = await supabase
    .from('grupo')
    .select('plan_estudios_id')
    .eq('programa_id', programa.id)
    .eq('ciclo', ciclo)
    .eq('seccion', seccion)
    .single();
  if (errorGrupo) throw errorGrupo;

  const esElectivo = /electivo/i.test(pendiente.valor_csv);
  const { data: nueva, error } = await supabase
    .from('asignatura')
    .insert({ plan_estudios_id: grupo.plan_estudios_id, nombre: pendiente.valor_csv.trim(), es_electivo: esElectivo })
    .select('id')
    .single();
  if (error) throw error;
  return nueva.id;
}

async function ajustarContadorPendientes(cargaId, delta) {
  const { data: carga, error } = await supabase.from('carga_csv').select('filas_pendientes').eq('id', cargaId).single();
  if (error) throw error;
  await supabase.from('carga_csv').update({ filas_pendientes: Math.max(0, carga.filas_pendientes + delta) }).eq('id', cargaId);
}

async function ajustarContadorInsertadas(cargaId, delta) {
  const { data: carga, error } = await supabase.from('carga_csv').select('filas_insertadas').eq('id', cargaId).single();
  if (error) throw error;
  await supabase.from('carga_csv').update({ filas_insertadas: carga.filas_insertadas + delta }).eq('id', cargaId);
}
