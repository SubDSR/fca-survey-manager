import { parse } from 'csv-parse/sync';
import { randomUUID } from 'crypto';
import { supabase } from '../config/supabase.js';
import { importarFilasCsv, resolverPendiente } from '../services/importarEncuestas.js';
import { importarFilasCsvVirtual, COLUMNAS_ESPERADAS_VIRTUAL } from '../services/importarEncuestasVirtual.js';
import { detectarContextoVirtual } from '../services/detectarContextoVirtual.js';
import { extraerCsvsDeZip, advertenciaProgramaZip } from '../utils/zipVirtual.js';

const COLUMNAS_ESPERADAS = [
  'Programa', 'Ciclo', 'Seccion', 'Aula', 'Codigo', 'Docente', 'Curso',
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9',
];

export async function listarCargasPorCampania(req, res) {
  const { campania_id } = req.query;
  if (!campania_id) {
    return res.status(400).json({ error: 'Falta el parámetro campania_id' });
  }

  const { data, error } = await supabase
    .from('carga_csv')
    .select('id, archivo_nombre, filas_leidas, filas_procesadas, filas_insertadas, filas_omitidas, filas_error, filas_pendientes, estado, mensaje_error, motivo_pendiente, visible, errores, omitidas, advertencias, fecha_carga, modalidad_carga, lote_id, nombre_lote')
    .eq('campania_id', campania_id)
    .order('fecha_carga', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const total_acumulado = data
    .filter((c) => c.visible && (c.estado === 'completado' || c.estado === 'completado_con_errores'))
    .reduce((sum, c) => sum + c.filas_insertadas, 0);

  res.json({ cargas: data, total_acumulado });
}

// Corre el import real (presencial o virtual) y deja el resultado final en
// carga_csv — se llama SIN await desde subirCarga, después de que la
// respuesta HTTP ya se envió. Cualquier error de acá (incluida una falla de
// red a mitad de una carga de miles de filas) NO tiene ya un cliente HTTP
// escuchando: por eso el propio catch deja constancia en carga_csv.estado en
// vez de propagar el error a una respuesta que nadie va a recibir.
async function procesarCargaEnBackground({ esVirtual, filas, periodo, campania, carga, cursoGrupoDocenteId }) {
  try {
    const resultado = esVirtual
      ? await importarFilasCsvVirtual(filas, { campaniaId: campania.id, cargaId: carga.id, cursoGrupoDocenteId })
      : await importarFilasCsv(filas, periodo, campania.id, carga.id);
    const { filasInsertadas, errores, omitidas, advertencias } = resultado;
    // Solo la rama presencial puede producir pendientes (fuzzy matching) —
    // importarFilasCsvVirtual no devuelve este campo, de ahí el default 0.
    const filasPendientes = resultado.filasPendientes || 0;

    const estadoFinal = errores.length === 0
      ? 'completado'
      : filasInsertadas === 0 && filasPendientes === 0
        ? 'error'
        : 'completado_con_errores';

    const { error: errorUpdate } = await supabase
      .from('carga_csv')
      .update({
        estado: estadoFinal,
        filas_insertadas: filasInsertadas,
        filas_procesadas: filas.length,
        filas_omitidas: omitidas.length,
        filas_error: errores.length,
        filas_pendientes: filasPendientes,
        errores: errores.length > 0 ? errores : null,
        omitidas: omitidas.length > 0 ? omitidas : null,
        advertencias: advertencias.length > 0 ? advertencias : null,
      })
      .eq('id', carga.id);
    if (errorUpdate) throw errorUpdate;
  } catch (err) {
    await supabase
      .from('carga_csv')
      .update({ estado: 'error', mensaje_error: `Error insertando datos: ${err.message}` })
      .eq('id', carga.id);
  }
}

// Resuelve periodo_academico + su campaña BORRADOR/ABIERTA más reciente --
// compartido por subirCarga (un archivo) y subirLoteVirtual (un ZIP con
// varios), que necesitan exactamente la misma validación antes de aceptar
// cualquier archivo. Devuelve { periodo, campania } o { error: { status,
// body } } para que el caller solo tenga que decidir si responder.
async function resolverPeriodoYCampaniaAbierta(periodoId) {
  const { data: periodo, error: errorPeriodo } = await supabase
    .from('periodo_academico')
    .select('id, codigo, anio')
    .eq('id', periodoId)
    .maybeSingle();
  if (errorPeriodo) return { error: { status: 500, body: { error: errorPeriodo.message } } };
  if (!periodo) return { error: { status: 404, body: { error: 'Período no encontrado' } } };

  const { data: campania, error: errorCampania } = await supabase
    .from('campania_evaluacion')
    .select('id')
    .eq('periodo_academico_id', periodo.id)
    .in('estado', ['BORRADOR', 'ABIERTA'])
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errorCampania) return { error: { status: 500, body: { error: errorCampania.message } } };
  if (!campania) {
    return {
      error: {
        status: 409,
        body: { error: `No hay una campaña de evaluación abierta para el período "${periodo.codigo}". Ábrela antes de cargar encuestas.` },
      },
    };
  }

  return { periodo, campania };
}

// POST /api/cargas — multipart/form-data: file (csv) + periodo_id
//   + tipo='virtual' + curso_grupo_docente_id, para cargas de encuestas
//   virtuales (CSV sin Programa/Docente/Curso por fila — ese contexto se
//   fija una sola vez para todo el archivo, elegido en la UI).
//
// Responde en cuanto el archivo quedó validado y registrado (202, estado
// 'procesando') — el procesamiento real (que para miles de filas puede
// tardar minutos, ver investigación de lentitud) sigue en background y el
// cliente debe hacer polling a GET /api/cargas/:id para conocer el
// resultado. Antes esta ruta esperaba el import completo antes de
// responder, lo que en cargas grandes chocaba con el timeout fijo de
// cualquier proxy/túnel intermedio (ej. Cloudflare, 100s) mucho antes de
// que el import terminara.
export async function subirCarga(req, res) {
  const { periodo_id, tipo } = req.body;
  const archivo = req.file;
  const esVirtual = tipo === 'virtual';

  if (!periodo_id) return res.status(400).json({ error: 'Falta el parámetro periodo_id' });
  if (!archivo) return res.status(400).json({ error: 'No se recibió ningún archivo CSV' });

  let cursoGrupoDocenteId = null;
  if (esVirtual) {
    cursoGrupoDocenteId = Number(req.body.curso_grupo_docente_id);
    if (!cursoGrupoDocenteId) return res.status(400).json({ error: 'Falta el parámetro curso_grupo_docente_id' });

    const { data: cgd, error: errorCgd } = await supabase
      .from('curso_grupo_docente')
      .select('id')
      .eq('id', cursoGrupoDocenteId)
      .maybeSingle();
    if (errorCgd) return res.status(500).json({ error: errorCgd.message });
    if (!cgd) return res.status(404).json({ error: 'curso_grupo_docente no encontrado' });
  }

  const { periodo, campania, error: errorPeriodoCampania } = await resolverPeriodoYCampaniaAbierta(periodo_id);
  if (errorPeriodoCampania) return res.status(errorPeriodoCampania.status).json(errorPeriodoCampania.body);

  let filas;
  try {
    filas = parse(archivo.buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  } catch (err) {
    return res.status(400).json({ error: `CSV inválido: ${err.message}` });
  }
  if (filas.length === 0) {
    return res.status(400).json({ error: 'El archivo CSV no contiene filas.' });
  }
  const columnasEsperadas = esVirtual ? COLUMNAS_ESPERADAS_VIRTUAL : COLUMNAS_ESPERADAS;
  const faltantes = columnasEsperadas.filter((c) => !Object.keys(filas[0]).includes(c));
  if (faltantes.length > 0) {
    return res.status(400).json({ error: `Faltan columnas requeridas en el CSV: ${faltantes.join(', ')}` });
  }

  const { data: carga, error: errorCarga } = await supabase
    .from('carga_csv')
    .insert({
      campania_id: campania.id,
      archivo_nombre: archivo.originalname,
      filas_leidas: filas.length,
      estado: 'procesando',
      modalidad_carga: esVirtual ? 'virtual' : 'presencial',
    })
    .select()
    .single();
  if (errorCarga) return res.status(500).json({ error: errorCarga.message });

  res.status(202).json(carga);

  procesarCargaEnBackground({ esVirtual, filas, periodo, campania, carga, cursoGrupoDocenteId }).catch((err) => {
    // No debería llegar acá: procesarCargaEnBackground ya atrapa sus propios
    // errores y los deja en carga_csv.estado. Esto es solo defensa en
    // profundidad para que un fallo inesperado no quede como una promesa
    // rechazada sin manejar.
    console.error(`[carga ${carga.id}] error no manejado en background:`, err);
  });
}

// POST /api/cargas/lote-virtual — multipart/form-data: file (.zip) + periodo_id.
// Carga por lote de encuestas virtuales: el ZIP trae varios CSV, cada uno
// con SU PROPIO docente/curso (detectado del nombre del archivo, igual que
// en la subida individual) -- a diferencia de subirCarga (tipo=virtual),
// acá NO se recibe curso_grupo_docente_id de antemano porque cada archivo
// puede resolver a uno distinto. Es un endpoint propio (no una rama más
// dentro de subirCarga) porque el contrato es genuinamente distinto: ahí
// el cliente ya resolvió el contexto ANTES de subir; acá el servidor lo
// resuelve por archivo, DESPUÉS de recibir el ZIP.
//
// Responde 202 apenas terminó de leer el ZIP y registrar una fila de
// carga_csv por cada CSV encontrado (todas comparten lote_id) -- el
// procesamiento real (detectar contexto + importar filas) sigue en
// background, un archivo a la vez. El cliente hace polling a
// GET /api/cargas/lote/:loteId para el progreso "archivo X de N".
export async function subirLoteVirtual(req, res) {
  const { periodo_id: periodoId } = req.body;
  const zip = req.file;

  if (!periodoId) return res.status(400).json({ error: 'Falta el parámetro periodo_id' });
  if (!zip) return res.status(400).json({ error: 'No se recibió ningún archivo ZIP' });

  const { periodo, campania, error: errorPeriodoCampania } = await resolverPeriodoYCampaniaAbierta(periodoId);
  if (errorPeriodoCampania) return res.status(errorPeriodoCampania.status).json(errorPeriodoCampania.body);

  let archivos;
  let ignorados;
  try {
    ({ archivos, ignorados } = extraerCsvsDeZip(zip.buffer));
  } catch (err) {
    return res.status(400).json({ error: `No se pudo leer el ZIP: ${err.message}` });
  }
  if (archivos.length === 0) {
    return res.status(400).json({ error: 'El ZIP no contiene ningún archivo .csv.' });
  }

  const loteId = randomUUID();
  const nombreLote = zip.originalname.replace(/\.zip$/i, '');

  // Primera pasada, sincrónica: parsear cada CSV y validar sus columnas. Un
  // archivo mal formado acá es un error real de ARCHIVO (no de contexto) --
  // se registra de una con estado='error' y nunca entra a la cola de
  // background: no tiene sentido gastar una consulta de detectarContextoVirtual
  // en un archivo que de todos modos no se puede procesar. "Si un archivo del
  // lote falla, el resto continúa" -- por eso este for nunca corta ni hace
  // return ante un archivo individual malo.
  const filasPorProcesar = []; // [{ carga, filas, nombreArchivo }] -- los que sí se pudieron leer
  const cargasCreadas = [];

  for (const archivo of archivos) {
    let filas = [];
    let errorLectura = null;
    try {
      filas = parse(archivo.contenido, { columns: true, skip_empty_lines: true, trim: true, bom: true });
      if (filas.length === 0) {
        errorLectura = 'El archivo CSV no contiene filas.';
      } else {
        const faltantes = COLUMNAS_ESPERADAS_VIRTUAL.filter((c) => !Object.keys(filas[0]).includes(c));
        if (faltantes.length > 0) errorLectura = `Faltan columnas requeridas en el CSV: ${faltantes.join(', ')}`;
      }
    } catch (err) {
      errorLectura = `CSV inválido: ${err.message}`;
    }

    const { data: carga, error: errorCarga } = await supabase
      .from('carga_csv')
      .insert({
        campania_id: campania.id,
        archivo_nombre: archivo.nombreArchivo,
        filas_leidas: errorLectura ? 0 : filas.length,
        estado: errorLectura ? 'error' : 'procesando',
        mensaje_error: errorLectura,
        modalidad_carga: 'virtual',
        lote_id: loteId,
        nombre_lote: nombreLote,
      })
      .select()
      .single();
    if (errorCarga) return res.status(500).json({ error: errorCarga.message });

    cargasCreadas.push(carga);
    if (!errorLectura) filasPorProcesar.push({ carga, filas, nombreArchivo: archivo.nombreArchivo });
  }

  res.status(202).json({
    lote_id: loteId,
    nombre_lote: nombreLote,
    total_archivos: cargasCreadas.length,
    ignorados,
    cargas: cargasCreadas,
  });

  procesarLoteVirtualEnBackground({ filasPorProcesar, periodo, campania, nombreLote }).catch((err) => {
    console.error(`[lote ${loteId}] error no manejado en background:`, err);
  });
}

// Procesa los CSV que sí se pudieron leer, UNO A LA VEZ (nunca en paralelo
// -- mismo espíritu que el for secuencial de importarFilasCsvVirtual dentro
// de un solo archivo, ahora un nivel más arriba). Por cada uno:
//
//   1. Detecta contexto (detectarContextoVirtual, SIN TOCAR esa función).
//   2. Si no alcanza confianza suficiente para un curso_grupo_docente único
//      -- el archivo queda 'pendiente_revision', SIN insertar ninguna fila,
//      y el loop sigue con el siguiente. Esto es DISTINTO de un error real
//      de archivo (ya filtrado antes, en subirLoteVirtual): acá el CSV está
//      bien, solo falta que un humano confirme el docente/curso -- igual
//      que ya pasa hoy en la subida individual ("Editar datos"). La vía
//      para resolverlo es volver a subir ESE archivo por separado en
//      /configuracion/carga/subir-virtual, no una confirmación a mitad del
//      lote (que rompería "si uno falla, el resto continúa" para bloquear
//      TODO el lote por una sola detección dudosa).
//   3. Si sí hay confianza, cruza el programa detectado contra el nombre
//      del lote (advertenciaProgramaZip) -- señal de alerta, nunca bloqueo
//      -- y reutiliza procesarCargaEnBackground TAL CUAL (misma función que
//      ya usa la subida individual) para insertar las filas.
async function procesarLoteVirtualEnBackground({ filasPorProcesar, periodo, campania, nombreLote }) {
  for (const { carga, filas, nombreArchivo } of filasPorProcesar) {
    let deteccion;
    try {
      deteccion = await detectarContextoVirtual(nombreArchivo);
    } catch (err) {
      await supabase
        .from('carga_csv')
        .update({ estado: 'error', mensaje_error: `Error detectando contexto: ${err.message}` })
        .eq('id', carga.id);
      continue;
    }

    if (deteccion.badge !== 'success' || !deteccion.curso_grupo_docente) {
      await supabase
        .from('carga_csv')
        .update({
          estado: 'pendiente_revision',
          motivo_pendiente: deteccion.motivos.join(' ') || 'La detección automática no alcanzó confianza suficiente.',
        })
        .eq('id', carga.id);
      continue;
    }

    await procesarCargaEnBackground({
      esVirtual: true,
      filas,
      periodo,
      campania,
      carga,
      cursoGrupoDocenteId: deteccion.curso_grupo_docente.curso_grupo_docente_id,
    });

    // Se escribe DESPUÉS de procesarCargaEnBackground a propósito: su propio
    // update final deja advertencias=null (importarFilasCsvVirtual siempre
    // devuelve advertencias: [] -- no hay otra clase de advertencia posible
    // en el pipeline virtual todavía), así que escribir esto antes quedaría
    // pisado por ese update.
    const advertenciaPrograma = advertenciaProgramaZip(nombreLote, deteccion.curso_grupo_docente.programa);
    if (advertenciaPrograma) {
      await supabase
        .from('carga_csv')
        .update({ advertencias: [{ fila: null, mensaje: advertenciaPrograma }] })
        .eq('id', carga.id);
    }
  }
}

// GET /api/cargas/lote/:loteId — todas las carga_csv de un lote (ZIP),
// mismo shape que listarCargasPorCampania -- el frontend calcula "archivo X
// de N" contando cuántas ya llegaron a un estado final, y arma el resumen
// (completados / con error / pendientes de revisión) sin necesitar un
// endpoint de agregación aparte.
export async function obtenerLote(req, res) {
  const { loteId } = req.params;

  const { data, error } = await supabase
    .from('carga_csv')
    .select('id, archivo_nombre, filas_leidas, filas_procesadas, filas_insertadas, filas_omitidas, filas_error, filas_pendientes, estado, mensaje_error, motivo_pendiente, visible, errores, omitidas, advertencias, fecha_carga, modalidad_carga, lote_id, nombre_lote')
    .eq('lote_id', loteId)
    .order('id', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Lote no encontrado' });

  res.json({ lote_id: loteId, nombre_lote: data[0].nombre_lote, cargas: data });
}

// GET /api/cargas/:id — estado y progreso de UNA carga puntual. Pensado
// para el polling del frontend mientras estado='procesando' (ver
// subirCarga): misma forma que las filas de listarCargasPorCampania, más
// filas_procesadas para la barra de progreso.
export async function obtenerCarga(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('carga_csv')
    .select('id, campania_id, archivo_nombre, filas_leidas, filas_procesadas, filas_insertadas, filas_omitidas, filas_error, filas_pendientes, estado, mensaje_error, visible, errores, omitidas, advertencias, fecha_carga, modalidad_carga')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Carga no encontrada' });

  res.json(data);
}

// GET /api/cargas/detectar-contexto-virtual?nombre_archivo=... — sugiere
// Docente/Curso/Ciclo/Sección/Programa a partir del nombre del archivo
// virtual (ver services/detectarContextoVirtual.js). Solo lectura, no
// dispara ninguna carga -- el usuario siempre confirma o corrige antes de
// que se inserte una sola fila.
export async function detectarContextoVirtualHandler(req, res) {
  const { nombre_archivo: nombreArchivo } = req.query;
  if (!nombreArchivo) return res.status(400).json({ error: 'Falta el parámetro nombre_archivo' });

  try {
    const resultado = await detectarContextoVirtual(nombreArchivo);
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/cargas/:id/pendientes — filas de una carga presencial que
// quedaron ambiguas (fuzzy matching, ver importarEncuestas.js) sin resolver
// todavía. Cada una trae sus candidatos sugeridos para que la UI arme los
// botones [Usar "X" (N%)] inline.
export async function listarPendientesDeCarga(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('carga_pendiente')
    .select('id, carga_id, fila_numero, tipo, valor_csv, candidatos, estado, created_at')
    .eq('carga_id', id)
    .eq('estado', 'pendiente')
    .order('fila_numero', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
}

// POST /api/cargas/pendientes/:pendienteId/resolver
// body: { accion: 'usar_existente'|'crear_nuevo'|'descartar', docente_id?, asignatura_id? }
export async function resolverPendienteCarga(req, res) {
  const { pendienteId } = req.params;
  const { accion, docente_id, asignatura_id } = req.body || {};

  if (!['usar_existente', 'crear_nuevo', 'descartar'].includes(accion)) {
    return res.status(400).json({ error: 'El campo "accion" debe ser usar_existente, crear_nuevo o descartar.' });
  }

  try {
    const resultado = await resolverPendiente(pendienteId, {
      accion,
      docenteId: docente_id ? Number(docente_id) : null,
      asignaturaId: asignatura_id ? Number(asignatura_id) : null,
    });

    switch (resultado.estado) {
      case 'no_encontrado':
        return res.status(404).json({ error: 'Pendiente no encontrado' });
      case 'ya_resuelto':
        return res.status(409).json({ error: `Este pendiente ya fue ${resultado.pendiente.estado}.` });
      case 'falta_id':
        return res.status(400).json({ error: 'Falta el id del docente/asignatura elegido.' });
      case 'referencia_no_encontrada':
        return res.status(404).json({ error: 'El docente/asignatura elegido no existe.' });
      case 'accion_invalida':
        return res.status(400).json({ error: 'Acción inválida.' });
      case 'resuelto_parcial':
        return res.json({ estado: 'resuelto_parcial', mensaje: 'Resuelto — esta fila todavía tiene otra ambigüedad pendiente.' });
      case 'fila_descartada':
        return res.json({ estado: 'fila_descartada', mensaje: 'Resuelto — la fila no se insertará (se descartó uno de sus datos ambiguos).' });
      case 'fila_insertada':
        return res.json({ estado: 'fila_insertada', mensaje: 'Fila insertada correctamente.' });
      case 'fila_omitida':
        return res.json({ estado: 'fila_omitida', mensaje: resultado.mensaje });
      case 'fila_error':
        return res.status(422).json({ estado: 'fila_error', error: resultado.mensaje });
      default:
        return res.status(500).json({ error: 'Estado de resolución no reconocido.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/cargas/:id/visibilidad — { visible: true|false }. Reversible,
// no borra nada: solo afecta si las vistas de reportes la incluyen.
export async function cambiarVisibilidad(req, res) {
  const { id } = req.params;
  const { visible } = req.body;
  if (typeof visible !== 'boolean') {
    return res.status(400).json({ error: 'El campo "visible" debe ser true o false' });
  }

  const { data, error } = await supabase.from('carga_csv').update({ visible }).eq('id', id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Carga no encontrada' });
  res.json(data);
}

const PLAZO_ELIMINACION_DIAS = 7;
const PLAZO_ELIMINACION_MS = PLAZO_ELIMINACION_DIAS * 24 * 60 * 60 * 1000;

// DELETE /api/cargas/:id — borra en cascada (respuesta -> encuesta ->
// encuestado -> carga_csv) vía fn_eliminar_carga, en una sola transacción.
//
// Pasados PLAZO_ELIMINACION_DIAS desde carga_csv.fecha_carga (la misma
// columna que ya se usa como fecha de referencia en todo el sistema para
// esta tabla — historial, orden, etc.), se bloquea el borrado: una carga
// vieja probablemente ya tiene reportes/decisiones tomadas sobre ella, y
// borrarla sin darse cuenta del tiempo transcurrido es más fácil de lo
// que parece (ver toda esta conversación: DELETE directo por curl varias
// veces durante pruebas). La validación real vive acá, no solo en el
// frontend -- deshabilitar el botón es cosmético, cualquiera con acceso a
// la API puede saltárselo.
export async function eliminarCarga(req, res) {
  const { id } = req.params;

  // fn_eliminar_carga() siempre devuelve una fila (aunque el id no exista,
  // sus DELETE simplemente no afectan nada), así que se verifica la
  // existencia antes para poder responder 404 correctamente.
  const { data: existente, error: errorExistente } = await supabase
    .from('carga_csv')
    .select('id, fecha_carga')
    .eq('id', id)
    .maybeSingle();
  if (errorExistente) return res.status(500).json({ error: errorExistente.message });
  if (!existente) return res.status(404).json({ error: 'Carga no encontrada' });

  const antiguedadMs = Date.now() - new Date(existente.fecha_carga).getTime();
  if (antiguedadMs > PLAZO_ELIMINACION_MS) {
    return res.status(403).json({
      error: `No se puede eliminar: han pasado más de ${PLAZO_ELIMINACION_DIAS} días desde la carga (fecha_carga: ${existente.fecha_carga}).`,
    });
  }

  const { data, error } = await supabase.rpc('fn_eliminar_carga', { p_carga_id: Number(id) });
  if (error) {
    // fn_eliminar_carga también valida el plazo (defensa en profundidad,
    // ver 2026-08-06-plazo-eliminar-carga.sql) -- si esta excepción
    // puntual llega hasta acá es porque algo saltó el chequeo de arriba
    // (condición de carrera con el reloj justo en el borde del plazo, o
    // una llamada a la función que no pasó por este controlador), así que
    // se traduce al mismo 403 con el mismo mensaje en vez de un 500
    // genérico.
    if (error.message && error.message.includes('No se puede eliminar')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }

  res.json({
    eliminado: true,
    respuestas_eliminadas: data[0].respuestas_eliminadas,
    encuestas_eliminadas: data[0].encuestas_eliminadas,
    encuestados_eliminados: data[0].encuestados_eliminados,
  });
}
