import { supabase } from '../config/supabase.js';
import { normalizarTexto, claveCarga, cicloDesdeRomano } from '../utils/normalizar.js';

const MODALIDAD_DEFECTO = 'PRESENCIAL'; // ASUNCIÓN: el CSV no trae modalidad.

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
  if (mapa.has(clave)) return mapa.get(clave);

  const esElectivo = /electivo/i.test(nombreCurso);
  const { data: nueva, error } = await supabase
    .from('asignatura')
    .insert({ plan_estudios_id: planEstudiosId, nombre: nombreCurso.trim(), es_electivo: esElectivo })
    .select('id')
    .single();
  if (error) throw error;
  mapa.set(clave, nueva.id);
  return nueva.id;
}

// "Vargas Merino, Jorge Alberto" -> { apellido_paterno, apellido_materno, nombres }
function parsearNombreDocente(nombreCsv) {
  const [apellidos, nombres] = nombreCsv.split(',').map((s) => s.trim());
  const [apellidoPaterno, ...restoApellidos] = (apellidos || '').split(/\s+/);
  return {
    apellido_paterno: apellidoPaterno || '',
    apellido_materno: restoApellidos.length ? restoApellidos.join(' ') : null,
    nombres: nombres || '',
  };
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
  if (cacheDocentes.has(clave)) return cacheDocentes.get(clave);

  const partes = parsearNombreDocente(nombreCsv);
  const { data: nuevo, error } = await supabase
    .from('docente')
    .insert({ ...partes, en_roster_encuestas: true })
    .select('id')
    .single();
  if (error) throw error;
  cacheDocentes.set(clave, nuevo.id);
  return nuevo.id;
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
function construirRespuestas({ encuestaId, fila, catalogos }) {
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
// Punto de entrada: procesa todas las filas del CSV parseado.
// Devuelve { filasInsertadas, errores, omitidas, advertencias }.
// ============================================================
export async function importarFilasCsv(filas, periodo, campaniaId, cargaId) {
  const catalogos = await cargarCatalogos();

  const cachePlanes = new Map();
  const cacheAsignaturas = new Map();
  const cacheDocentes = new Map();
  const cacheEncuestados = new Map();

  const errores = [];
  const omitidas = [];
  const advertencias = [];
  let filasInsertadas = 0;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const numeroFila = i + 2;

    try {
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
      const asignaturaId = await resolverAsignatura({
        planEstudiosId: grupo.plan_estudios_id,
        nombreCurso: fila.Curso,
        cacheAsignaturas,
      });

      const docenteId = await resolverDocente({ nombreCsv: fila.Docente, cacheDocentes });

      const cgd = await resolverCursoGrupoDocente({
        grupoId: grupo.id,
        asignaturaId,
        docenteId,
        nombreDocenteCsv: fila.Docente,
        nombreCurso: fila.Curso,
      });
      if (cgd.advertencia) advertencias.push({ fila: numeroFila, mensaje: cgd.advertencia });

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
        omitidas.push({ fila: numeroFila, mensaje: 'Fila duplicada dentro del mismo archivo — omitida.' });
        continue;
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

      filasInsertadas++;
    } catch (err) {
      errores.push({ fila: numeroFila, mensaje: err.message });
    }
  }

  return { filasInsertadas, errores, omitidas, advertencias };
}
