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

// PROFILING TEMPORAL (ver tarea de investigación de lentitud) — acumula ms
// gastados por categoría de llamada a Supabase a lo largo de toda la carga,
// para saber dónde se va el tiempo sin instrumentar cada fila individualmente.
// TODO: quitar una vez terminada la optimización.
function crearMedidor() {
  const acumulado = {};
  return {
    async medir(nombre, fn) {
      const inicio = performance.now();
      try {
        return await fn();
      } finally {
        const ms = performance.now() - inicio;
        if (!acumulado[nombre]) acumulado[nombre] = { ms: 0, llamadas: 0 };
        acumulado[nombre].ms += ms;
        acumulado[nombre].llamadas += 1;
      }
    },
    resumen() {
      return Object.fromEntries(
        Object.entries(acumulado).map(([nombre, { ms, llamadas }]) => [
          nombre,
          { ms: Math.round(ms), llamadas, msPromedio: Number((ms / llamadas).toFixed(1)) },
        ])
      );
    },
  };
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
    cacheGrupos: new Map(),
    cacheCursoGrupoDocente: new Map(),
    // Claves `${encuestadoId}|${cgdId}` de encuestas ya insertadas en ESTA
    // corrida. Es la fuente de verdad para el chequeo de "fila duplicada
    // dentro del mismo archivo" SOLO cuando el encuestado también lo creó
    // esta misma corrida (origen 'nuevo'/'cache' en resolverEncuestado) —
    // si el encuestado ya existía de antes (origen 'db', típico al resolver
    // un pendiente días después con un contexto nuevo), este Set vacío no
    // es confiable y procesarFila cae de vuelta al SELECT real. Ver el uso
    // en procesarFila para el detalle de cuándo se puede confiar en él.
    encuestasInsertadas: new Set(),
    // Mapa codigo -> última secuencia usada, para no consultar la BD por
    // cada estudiante nuevo (ver cargarSecuenciasIniciales). Queda null
    // salvo que importarFilasCsv lo llene con una precarga por lote al
    // inicio de la corrida — resolverEncuestado cae de vuelta al SELECT por
    // fila cuando es null (caso de resolverPendiente, un contexto nuevo
    // para UNA fila, donde precargar no tiene sentido).
    siguienteSecuenciaPorCodigo: null,
    medidor: crearMedidor(),
  };
}

const TAMANO_LOTE_SECUENCIAS = 500;

// uq_encuestado_campania_codigo = UNIQUE(campania_id, codigo, secuencia) es
// GLOBAL a la campaña (no distingue carga_id): si el mismo código ya
// apareció en una carga anterior de esta campaña, la siguiente fila con ese
// código debe insertarse con secuencia = MAX(secuencia previa) + 1, no con
// el default 1. Antes esto se resolvía con un SELECT ORDER BY secuencia
// DESC LIMIT 1 POR FILA (no hay una sola secuencia de Postgres detrás: es
// lógica de aplicación porque en realidad son N contadores independientes,
// uno por código, y una SEQUENCE de Postgres es un contador único global —
// no hay forma de pedirle "el siguiente valor para el código X" sin crear
// una secuencia real por código, que sería peor: miles de objetos SEQUENCE
// efímeros solo para esto). Acá se reserva el punto de partida de esos
// contadores de una sola vez, con 1 query por lote de hasta 500 códigos
// distintos del archivo (en vez de 1 por fila) — de ahí en más,
// resolverEncuestado incrementa el contador en memoria sin volver a la BD.
// Se pagina en lotes (no un solo IN() con todos los códigos) para no armar
// una URL gigante si el archivo trae miles de códigos distintos.
async function cargarSecuenciasIniciales(campaniaId, codigos) {
  const distintos = [...new Set(codigos)];
  const maxPorCodigo = new Map();

  for (let i = 0; i < distintos.length; i += TAMANO_LOTE_SECUENCIAS) {
    const lote = distintos.slice(i, i + TAMANO_LOTE_SECUENCIAS);
    const { data, error } = await supabase
      .from('encuestado')
      .select('codigo, secuencia')
      .eq('campania_id', campaniaId)
      .in('codigo', lote);
    if (error) throw error;
    for (const fila of data || []) {
      const actual = maxPorCodigo.get(fila.codigo) || 0;
      if (fila.secuencia > actual) maxPorCodigo.set(fila.codigo, fila.secuencia);
    }
  }
  return maxPorCodigo;
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
//
// Cacheado en memoria por (periodoId,programaId,ciclo,seccion): en un CSV
// real la misma sección se repite una vez por cada estudiante que la evaluó
// (decenas de filas), y sin cache cada una de esas filas repetía el mismo
// SELECT a Supabase — confirmado por perfilado como ~11% del tiempo total
// de importación, 100% evitable.
async function resolverGrupo({ periodoId, programaId, planEstudiosIdCalculado, ciclo, seccion, modalidadDefectoId, cacheGrupos }) {
  const clave = `${periodoId}|${programaId}|${ciclo}|${seccion}`;
  if (cacheGrupos.has(clave)) return cacheGrupos.get(clave);

  const { data: existente, error: errorBusqueda } = await supabase
    .from('grupo')
    .select('id, plan_estudios_id')
    .eq('periodo_academico_id', periodoId)
    .eq('programa_id', programaId)
    .eq('ciclo', ciclo)
    .eq('seccion', seccion)
    .maybeSingle();
  if (errorBusqueda) throw errorBusqueda;
  if (existente) {
    cacheGrupos.set(clave, existente);
    return existente;
  }

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
  cacheGrupos.set(clave, nuevo);
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
//
// Cacheado en memoria por (grupoId,asignaturaId,docenteId): esta tupla es
// exactamente "una sección dictada por un docente" y se repite una vez por
// cada estudiante que la evaluó — sin cache, cada fila repetía 2 SELECTs
// (curso_grupo + curso_grupo_docente) a Supabase. Perfilado: ~22% del
// tiempo total de importación, el mayor contribuyente evitable sin tocar
// fuzzy matching. La advertencia de "sección dispersa" solo se genera la
// PRIMERA vez que se crea el registro (igual que antes de cachear: el
// camino de "ya existía" nunca la generó), así que cachear el resultado
// completo no cambia cuántas veces se reporta.
async function resolverCursoGrupoDocente({ grupoId, asignaturaId, docenteId, nombreDocenteCsv, nombreCurso, cacheCursoGrupoDocente }) {
  const clave = `${grupoId}|${asignaturaId}|${docenteId}`;
  if (cacheCursoGrupoDocente.has(clave)) return cacheCursoGrupoDocente.get(clave);

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
  if (cgdExistente) {
    const resultado = { id: cgdExistente.id };
    cacheCursoGrupoDocente.set(clave, resultado);
    return resultado;
  }

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
    const resultado = {
      id: nuevo.id,
      advertencia:
        `Sección nueva marcada como dispersa (es_carga_oficial=false): docente "${nombreDocenteCsv}", ` +
        `curso "${nombreCurso}" — ya existía otra sección oficial para este mismo docente+curso. ` +
        'Revisar si fn_autoconsolidar_secciones() la consolidó correctamente.',
    };
    cacheCursoGrupoDocente.set(clave, resultado);
    return resultado;
  }
  const resultado = { id: nuevo.id };
  cacheCursoGrupoDocente.set(clave, resultado);
  return resultado;
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
// Devuelve { id, origen }. `origen` le dice al llamador si hace falta ir a
// la BD a chequear duplicados de `encuesta` para este encuestado, o si es
// seguro saltarse esa consulta (ver comentario en procesarFila):
//   'nuevo'  -> se acaba de insertar en ESTE llamado: es imposible que ya
//               tenga una encuesta, en cualquier contexto (corrida masiva
//               o resolución aislada de un pendiente).
//   'cache'  -> ya resuelto antes en ESTA MISMA corrida (mismo contexto):
//               cualquier encuesta que ya tenga solo pudo haberla insertado
//               esta misma corrida, así que el Set en memoria es confiable.
//   'db'     -> existía de ANTES de este llamado (encontrado por SELECT):
//               puede tener encuestas de una corrida anterior que este
//               contexto no conoce — no hay forma de saltarse la consulta.
// `cargaEsNueva`: true cuando el llamador SABE que cargaId se acaba de
// crear en esta misma request (importarFilasCsv, recién insertada por el
// controlador segundos antes) — en ese caso es matemáticamente imposible
// que ya exista un encuestado con ese carga_id (nadie más pudo haberlo
// insertado todavía), así que se salta el SELECT de existencia. Al resolver
// un carga_pendiente días después (procesarFila desde resolverPendiente),
// cargaId es una carga VIEJA que sí pudo haber creado ya este encuestado
// (otra fila del mismo estudiante ya insertada normalmente) — ahí el
// default `false` mantiene el SELECT real.
async function resolverEncuestado({ campaniaId, grupoId, codigo, cargaId, cacheEncuestados, cargaEsNueva = false, siguienteSecuenciaPorCodigo = null }) {
  const clave = `${grupoId}|${codigo}`;
  if (cacheEncuestados.has(clave)) return { id: cacheEncuestados.get(clave), origen: 'cache' };

  if (!cargaEsNueva) {
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
      return { id: existente.id, origen: 'db' };
    }
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
  //
  // Si el llamador precargó siguienteSecuenciaPorCodigo (ver
  // cargarSecuenciasIniciales), el contador vive en memoria y no hace falta
  // ir a la BD; si no (resolverPendiente, contexto nuevo para una sola
  // fila), se cae de vuelta al SELECT de siempre.
  let siguienteSecuencia;
  if (siguienteSecuenciaPorCodigo) {
    siguienteSecuencia = (siguienteSecuenciaPorCodigo.get(codigo) || 0) + 1;
    siguienteSecuenciaPorCodigo.set(codigo, siguienteSecuencia);
  } else {
    const { data: ultimo, error: errorSecuencia } = await supabase
      .from('encuestado')
      .select('secuencia')
      .eq('campania_id', campaniaId)
      .eq('codigo', codigo)
      .order('secuencia', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (errorSecuencia) throw errorSecuencia;
    siguienteSecuencia = (ultimo?.secuencia || 0) + 1;
  }

  const { data: nuevo, error } = await supabase
    .from('encuestado')
    .insert({ campania_id: campaniaId, grupo_id: grupoId, codigo, carga_id: cargaId, secuencia: siguienteSecuencia })
    .select('id')
    .single();

  if (error) {
    // 23505 = unique_violation. Con siguienteSecuenciaPorCodigo precargado
    // UNA vez al inicio de la corrida (ver cargarSecuenciasIniciales), dos
    // cargas subidas casi al mismo tiempo con códigos en común pueden
    // calcular la MISMA "siguiente secuencia" (ambas leyeron el máximo
    // ANTES de que la otra insertara) — confirmado con una prueba real
    // (dos cargas del mismo CSV subidas con ~1s de diferencia: la segunda
    // falló sus 5 filas con este mismo error). No es corrupción de datos —
    // la constraint lo bloqueó como debía — pero sí una regresión real
    // frente al SELECT por fila de antes, que tenía una ventana de carrera
    // mucho más angosta. Se recalcula la secuencia real desde la BD
    // (ignorando el mapa en memoria, que quedó desactualizado) y se
    // reintenta UNA vez antes de darlo por error de verdad.
    // Se matchea por el nombre de la constraint en el mensaje (Postgres
    // siempre lo incluye en un unique_violation) en vez de solo por
    // error.code: más confiable que asumir que PostgREST siempre propaga
    // el SQLSTATE tal cual en ese campo.
    const esConflictoSecuencia = /uq_encuestado_campania_codigo/.test(error.message || '');
    if (!esConflictoSecuencia) throw error;

    const { data: ultimoReal, error: errorUltimoReal } = await supabase
      .from('encuestado')
      .select('secuencia')
      .eq('campania_id', campaniaId)
      .eq('codigo', codigo)
      .order('secuencia', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (errorUltimoReal) throw errorUltimoReal;
    const secuenciaReintento = (ultimoReal?.secuencia || 0) + 1;

    const { data: reintento, error: errorReintento } = await supabase
      .from('encuestado')
      .insert({ campania_id: campaniaId, grupo_id: grupoId, codigo, carga_id: cargaId, secuencia: secuenciaReintento })
      .select('id')
      .single();
    if (errorReintento) throw errorReintento;

    if (siguienteSecuenciaPorCodigo) siguienteSecuenciaPorCodigo.set(codigo, secuenciaReintento);
    cacheEncuestados.set(clave, reintento.id);
    return { id: reintento.id, origen: 'nuevo' };
  }

  cacheEncuestados.set(clave, nuevo.id);
  return { id: nuevo.id, origen: 'nuevo' };
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
//   { resultado: 'lista', encuestadoId, cgdId, advertenciasFila }
//   { resultado: 'omitida', mensaje }
//   { resultado: 'pendiente', pendientes: [{ tipo, valorCsv, candidatos }] }
// Lanza en caso de error real (fila descartable, ver caller).
//
// NO inserta encuesta/respuesta — solo resuelve y deja la fila lista. Eso
// lo decide el llamador: procesarFila() inserta de inmediato fila por fila
// (usado al resolver un carga_pendiente individual, aislado); el loop
// principal de importarFilasCsv() acumula el resultado 'lista' en un chunk
// e inserta en batch junto con otras filas (ver insertarChunkPorLotes) —
// perfilado real: insertEncuesta+insertRespuestas eran ~40% del tiempo
// total por fila, con un round trip a Supabase cada una.
async function resolverFilaParaInsercion({ fila, periodo, campaniaId, cargaId, contexto, overrides = {}, cargaEsNueva = false }) {
  const { catalogos, cachePlanes, cacheAsignaturas, cacheDocentes, cacheEncuestados, cacheGrupos, cacheCursoGrupoDocente, encuestasInsertadas, siguienteSecuenciaPorCodigo, medidor } = contexto;

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

  const grupo = await medidor.medir('resolverGrupo', () => resolverGrupo({
    periodoId: periodo.id,
    programaId,
    planEstudiosIdCalculado: cachePlanes.get(programaId),
    ciclo,
    seccion,
    modalidadDefectoId: catalogos.modalidadDefectoId,
    cacheGrupos,
  }));

  // Se usa el plan_estudios_id real del grupo (no el recién calculado):
  // si el grupo ya existía, pudo haberse creado con un plan distinto.
  const asignaturaResultado = overrides.asignaturaId
    ? { estado: 'resuelto', id: overrides.asignaturaId }
    : await medidor.medir('resolverAsignatura', () => resolverAsignatura({ planEstudiosId: grupo.plan_estudios_id, nombreCurso: fila.Curso, cacheAsignaturas }));

  const docenteResultado = overrides.docenteId
    ? { estado: 'resuelto', id: overrides.docenteId }
    : await medidor.medir('resolverDocente', () => resolverDocente({ nombreCsv: fila.Docente, cacheDocentes }));

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

  const cgd = await medidor.medir('resolverCursoGrupoDocente', () => resolverCursoGrupoDocente({
    grupoId: grupo.id,
    asignaturaId: asignaturaResultado.id,
    docenteId: docenteResultado.id,
    nombreDocenteCsv: fila.Docente,
    nombreCurso: fila.Curso,
    cacheCursoGrupoDocente,
  }));
  if (cgd.advertencia) advertenciasFila.push(cgd.advertencia);

  const encuestadoResultado = await medidor.medir('resolverEncuestado', () => resolverEncuestado({
    campaniaId,
    grupoId: grupo.id,
    codigo: fila.Codigo,
    cargaId,
    cacheEncuestados,
    cargaEsNueva,
    siguienteSecuenciaPorCodigo,
  }));
  const encuestadoId = encuestadoResultado.id;
  const claveEncuesta = `${encuestadoId}|${cgd.id}`;

  // Dentro del mismo archivo: si la fila está literalmente repetida
  // (mismo encuestado + mismo dictado), se omite en vez de duplicar.
  //
  // Se evita el SELECT a Supabase cuando ya sabemos la respuesta sin
  // consultar (perfilado: ~11% del tiempo total, ver resolverEncuestado):
  //   - origen 'nuevo': el encuestado se acaba de crear, no puede tener
  //     ninguna encuesta todavía.
  //   - origen 'cache': el encuestado lo creó ESTA MISMA corrida — el Set
  //     `encuestasInsertadas` (poblado por esta corrida) es la fuente de
  //     verdad completa para él, no hace falta preguntarle a la BD.
  //   - origen 'db': el encuestado ya existía ANTES de este llamado (típico
  //     al resolver un pendiente días después, con un contexto/Set nuevo y
  //     vacío) — puede tener encuestas de una corrida anterior que este Set
  //     no conoce, así que ahí sí hace falta el SELECT real.
  let duplicada;
  if (encuestadoResultado.origen === 'nuevo') {
    duplicada = false;
  } else if (encuestadoResultado.origen === 'cache') {
    duplicada = encuestasInsertadas.has(claveEncuesta);
  } else {
    const { data: encuestaExistente, error: errorBusquedaEncuesta } = await medidor.medir('checkEncuestaDuplicada', () => supabase
      .from('encuesta')
      .select('id')
      .eq('encuestado_id', encuestadoId)
      .eq('curso_grupo_docente_id', cgd.id)
      .maybeSingle());
    if (errorBusquedaEncuesta) throw errorBusquedaEncuesta;
    duplicada = !!encuestaExistente;
  }
  if (duplicada) {
    return { resultado: 'omitida', mensaje: 'Fila duplicada dentro del mismo archivo — omitida.' };
  }

  // OJO: NO se marca `encuestasInsertadas.add(claveEncuesta)` aquí — todavía
  // no se insertó nada. Lo hace quien efectivamente inserte (procesarFila o
  // insertarChunkPorLotes), recién cuando el insert ya fue exitoso.
  return { resultado: 'lista', encuestadoId, cgdId: cgd.id, advertenciasFila };
}

// Inserta la encuesta + sus 9 respuestas para UNA fila ya resuelta por
// resolverFilaParaInsercion(). Atómico por fila: si el insert de respuestas
// falla, se hace rollback manual de la encuesta recién creada — así una
// fila con datos inválidos nunca deja una encuesta huérfana (sin sus 9
// respuestas). Compartido por procesarFila() y por el fallback fila-a-fila
// de insertarChunkPorLotes() cuando el insert en batch de todo el chunk
// falla y hay que aislar cuál fila específica es la mala.
async function insertarFila({ encuestadoId, cgdId, fila, cargaId, catalogos, medidor, encuestasInsertadas }) {
  const { data: encuesta, error: errorEncuesta } = await medidor.medir('insertEncuesta', () => supabase
    .from('encuesta')
    .insert({ encuestado_id: encuestadoId, curso_grupo_docente_id: cgdId, carga_id: cargaId })
    .select('id')
    .single());
  if (errorEncuesta) throw errorEncuesta;

  try {
    const filasRespuesta = construirRespuestas({ encuestaId: encuesta.id, fila, catalogos });
    const { error: errorRespuestas } = await medidor.medir('insertRespuestas', () => supabase.from('respuesta').insert(filasRespuesta));
    if (errorRespuestas) throw errorRespuestas;
  } catch (errRespuestas) {
    await supabase.from('encuesta').delete().eq('id', encuesta.id);
    throw errRespuestas;
  }

  encuestasInsertadas.add(`${encuestadoId}|${cgdId}`);
}

// Devuelve:
//   { resultado: 'insertada', advertencias: string[] }
//   { resultado: 'omitida', mensaje }
//   { resultado: 'pendiente', pendientes: [{ tipo, valorCsv, candidatos }] }
// Lanza en caso de error real (fila descartable, ver caller).
//
// Usado por el endpoint de resolución de pendientes (un pendiente a la vez,
// días después de la carga original) — inserta de inmediato, sin batch: no
// hay otras filas con las que agrupar el insert.
export async function procesarFila({ fila, periodo, campaniaId, cargaId, contexto, overrides = {} }) {
  const { catalogos, encuestasInsertadas, medidor } = contexto;
  const resuelto = await resolverFilaParaInsercion({ fila, periodo, campaniaId, cargaId, contexto, overrides });
  if (resuelto.resultado !== 'lista') return resuelto;

  await insertarFila({
    encuestadoId: resuelto.encuestadoId,
    cgdId: resuelto.cgdId,
    fila,
    cargaId,
    catalogos,
    medidor,
    encuestasInsertadas,
  });

  return { resultado: 'insertada', advertencias: resuelto.advertenciasFila };
}

const TAMANO_CHUNK = 150;

// Inserta un chunk de filas ya resueltas ('lista') en batch: 1 INSERT para
// todas las `encuesta` del chunk + 1 INSERT para todas sus `respuesta`
// (chunk × 9 filas), en vez de 2 round trips a Supabase POR FILA. Perfilado
// real: ese era ~40% del tiempo total de una importación.
//
// El id de encuesta recién creada se vuelve a mapear por (encuestado_id,
// curso_grupo_docente_id) devueltos por el propio INSERT ... RETURNING, en
// vez de asumir que el orden de las filas devueltas coincide con el orden
// de inserción — Postgres/PostgREST no lo garantiza para un insert
// multi-fila, y encuestado_id+curso_grupo_docente_id es única dentro del
// chunk (las duplicadas ya se filtraron en resolverFilaParaInsercion).
//
// Si el batch falla en cualquier punto (una fila con dato inválido, un
// trigger que aborta el INSERT completo, etc.), se hace rollback de lo que
// sí se haya alcanzado a insertar y se reintenta EL CHUNK fila por fila —
// misma garantía de aislamiento que tenía el insert individual original:
// una fila mala nunca tumba a las demás, solo hace más lento ese chunk
// puntual en el caso raro de que falle.
async function insertarChunkPorLotes({ chunk, cargaId, catalogos, medidor, encuestasInsertadas }) {
  const resultado = { insertadas: [], errores: [] };
  let encuestasCreadas = null;

  try {
    const payloadEncuestas = chunk.map((item) => ({
      encuestado_id: item.encuestadoId,
      curso_grupo_docente_id: item.cgdId,
      carga_id: cargaId,
    }));

    const { data, error: errorEncuestas } = await medidor.medir('insertEncuestaChunk', () => supabase
      .from('encuesta')
      .insert(payloadEncuestas)
      .select('id, encuestado_id, curso_grupo_docente_id'));
    if (errorEncuestas) throw errorEncuestas;
    encuestasCreadas = data;

    const idPorPar = new Map(encuestasCreadas.map((e) => [`${e.encuestado_id}|${e.curso_grupo_docente_id}`, e.id]));

    const filasRespuesta = [];
    for (const item of chunk) {
      const encuestaId = idPorPar.get(`${item.encuestadoId}|${item.cgdId}`);
      if (encuestaId === undefined) {
        throw new Error(`No se encontró la encuesta recién insertada para encuestado ${item.encuestadoId} / curso_grupo_docente ${item.cgdId}`);
      }
      filasRespuesta.push(...construirRespuestas({ encuestaId, fila: item.fila, catalogos }));
    }

    const { error: errorRespuestas } = await medidor.medir('insertRespuestasChunk', () => supabase.from('respuesta').insert(filasRespuesta));
    if (errorRespuestas) throw errorRespuestas;

    for (const item of chunk) {
      encuestasInsertadas.add(`${item.encuestadoId}|${item.cgdId}`);
      resultado.insertadas.push({ numeroFila: item.numeroFila, advertencias: item.advertenciasFila });
    }
    return resultado;
  } catch (errChunk) {
    // El batch de encuestas sí llegó a insertarse pero algo después falló
    // (respuestas, o el mapeo de ids) -> esas encuestas quedarían huérfanas
    // (sin sus 9 respuestas) si no se deshacen antes de reintentar fila por
    // fila, y el reintento las duplicaría.
    if (encuestasCreadas && encuestasCreadas.length > 0) {
      await supabase.from('encuesta').delete().in('id', encuestasCreadas.map((e) => e.id));
    }

    for (const item of chunk) {
      try {
        await insertarFila({
          encuestadoId: item.encuestadoId,
          cgdId: item.cgdId,
          fila: item.fila,
          cargaId,
          catalogos,
          medidor,
          encuestasInsertadas,
        });
        resultado.insertadas.push({ numeroFila: item.numeroFila, advertencias: item.advertenciasFila });
      } catch (errFila) {
        resultado.errores.push({ numeroFila: item.numeroFila, mensaje: errFila.message });
      }
    }
    return resultado;
  }
}

// No se aborta la carga si esto falla (no es crítico para la corrección de
// los datos, solo para que la UI muestre el avance) — se loguea y se sigue.
async function actualizarProgreso(cargaId, filasProcesadas) {
  const { error } = await supabase.from('carga_csv').update({ filas_procesadas: filasProcesadas }).eq('id', cargaId);
  if (error) console.error(`[carga ${cargaId}] no se pudo actualizar filas_procesadas:`, error.message);
}

// ============================================================
// Punto de entrada: procesa todas las filas del CSV parseado. Se ejecuta en
// background (ver subirCarga en el controlador) — el cliente HTTP que
// disparó la carga ya recibió su respuesta antes de que esto termine.
// Devuelve { filasInsertadas, errores, omitidas, advertencias, filasPendientes }.
// ============================================================
export async function importarFilasCsv(filas, periodo, campaniaId, cargaId) {
  const inicioTotal = performance.now();
  const contexto = await crearContextoImportacion();
  const { catalogos, medidor, encuestasInsertadas } = contexto;

  // Precarga en batch (ver cargarSecuenciasIniciales) — de acá en más,
  // resolverEncuestado calcula la siguiente secuencia en memoria, sin ir a
  // la BD por cada estudiante nuevo.
  contexto.siguienteSecuenciaPorCodigo = await medidor.medir('cargarSecuenciasIniciales', () => cargarSecuenciasIniciales(campaniaId, filas.map((f) => f.Codigo)));

  const errores = [];
  const omitidas = [];
  const advertencias = [];
  let filasInsertadas = 0;
  let filasPendientes = 0;

  let chunk = [];
  const vaciarChunk = async () => {
    if (chunk.length === 0) return;
    const resultadoChunk = await insertarChunkPorLotes({ chunk, cargaId, catalogos, medidor, encuestasInsertadas });
    for (const ok of resultadoChunk.insertadas) {
      ok.advertencias.forEach((mensaje) => advertencias.push({ fila: ok.numeroFila, mensaje }));
      filasInsertadas++;
    }
    for (const err of resultadoChunk.errores) {
      errores.push({ fila: err.numeroFila, mensaje: err.mensaje });
    }
    chunk = [];
  };

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const numeroFila = i + 2;

    try {
      const resultado = await resolverFilaParaInsercion({ fila, periodo, campaniaId, cargaId, contexto, cargaEsNueva: true });

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

      // 'lista' -> se acumula para insertar en batch, no se inserta todavía.
      chunk.push({
        numeroFila,
        fila,
        encuestadoId: resultado.encuestadoId,
        cgdId: resultado.cgdId,
        advertenciasFila: resultado.advertenciasFila,
      });
    } catch (err) {
      errores.push({ fila: numeroFila, mensaje: err.message });
    }

    // Progreso + flush del chunk cada TAMANO_CHUNK filas (no fila por fila:
    // sería el mismo problema de N+1 que se corrigió arriba, aplicado ahora
    // al UPDATE de progreso). GET /api/cargas/:id lee filas_procesadas para
    // que la UI muestre "X de Y filas procesadas" mientras esto corre en
    // background (ver subirCarga en el controlador).
    const esUltimaFila = i === filas.length - 1;
    if (chunk.length >= TAMANO_CHUNK || esUltimaFila) {
      await vaciarChunk();
    }
    if ((i + 1) % TAMANO_CHUNK === 0 || esUltimaFila) {
      await actualizarProgreso(cargaId, i + 1);
    }
  }

  const totalMs = Math.round(performance.now() - inicioTotal);
  console.log(`[PROFILING importarFilasCsv] ${filas.length} filas en ${totalMs}ms (${(totalMs / filas.length).toFixed(1)}ms/fila)`);
  console.log('[PROFILING importarFilasCsv] desglose por categoría:', JSON.stringify(contexto.medidor.resumen(), null, 2));

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
