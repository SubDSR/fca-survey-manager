import { parse } from 'csv-parse/sync';
import { supabase } from '../config/supabase.js';
import { importarFilasCsv } from '../services/importarEncuestas.js';

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
    .select('id, archivo_nombre, filas_leidas, filas_insertadas, filas_omitidas, filas_error, estado, mensaje_error, visible, errores, omitidas, advertencias, fecha_carga')
    .eq('campania_id', campania_id)
    .order('fecha_carga', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const total_acumulado = data
    .filter((c) => c.visible && (c.estado === 'completado' || c.estado === 'completado_con_errores'))
    .reduce((sum, c) => sum + c.filas_insertadas, 0);

  res.json({ cargas: data, total_acumulado });
}

// POST /api/cargas — multipart/form-data: file (csv) + periodo_id
export async function subirCarga(req, res) {
  const { periodo_id } = req.body;
  const archivo = req.file;

  if (!periodo_id) return res.status(400).json({ error: 'Falta el parámetro periodo_id' });
  if (!archivo) return res.status(400).json({ error: 'No se recibió ningún archivo CSV' });

  const { data: periodo, error: errorPeriodo } = await supabase
    .from('periodo_academico')
    .select('id, codigo, anio')
    .eq('id', periodo_id)
    .maybeSingle();
  if (errorPeriodo) return res.status(500).json({ error: errorPeriodo.message });
  if (!periodo) return res.status(404).json({ error: 'Período no encontrado' });

  const { data: campania, error: errorCampania } = await supabase
    .from('campania_evaluacion')
    .select('id')
    .eq('periodo_academico_id', periodo.id)
    .in('estado', ['BORRADOR', 'ABIERTA'])
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errorCampania) return res.status(500).json({ error: errorCampania.message });
  if (!campania) {
    return res.status(409).json({
      error: `No hay una campaña de evaluación abierta para el período "${periodo.codigo}". Ábrela antes de cargar encuestas.`,
    });
  }

  let filas;
  try {
    filas = parse(archivo.buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  } catch (err) {
    return res.status(400).json({ error: `CSV inválido: ${err.message}` });
  }
  if (filas.length === 0) {
    return res.status(400).json({ error: 'El archivo CSV no contiene filas.' });
  }
  const faltantes = COLUMNAS_ESPERADAS.filter((c) => !Object.keys(filas[0]).includes(c));
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
    })
    .select()
    .single();
  if (errorCarga) return res.status(500).json({ error: errorCarga.message });

  try {
    const { filasInsertadas, errores, omitidas, advertencias } = await importarFilasCsv(
      filas,
      periodo,
      campania.id,
      carga.id
    );

    const estadoFinal = errores.length === 0
      ? 'completado'
      : filasInsertadas === 0
        ? 'error'
        : 'completado_con_errores';

    const { data: cargaFinal, error: errorUpdate } = await supabase
      .from('carga_csv')
      .update({
        estado: estadoFinal,
        filas_insertadas: filasInsertadas,
        filas_omitidas: omitidas.length,
        filas_error: errores.length,
        errores: errores.length > 0 ? errores : null,
        omitidas: omitidas.length > 0 ? omitidas : null,
        advertencias: advertencias.length > 0 ? advertencias : null,
      })
      .eq('id', carga.id)
      .select()
      .single();
    if (errorUpdate) throw errorUpdate;

    const status = estadoFinal === 'error' ? 422 : 201;
    res.status(status).json(cargaFinal);
  } catch (err) {
    await supabase
      .from('carga_csv')
      .update({ estado: 'error', mensaje_error: err.message })
      .eq('id', carga.id);
    res.status(500).json({ error: `Error insertando datos: ${err.message}` });
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

// DELETE /api/cargas/:id — borra en cascada (respuesta -> encuesta ->
// encuestado -> carga_csv) vía fn_eliminar_carga, en una sola transacción.
export async function eliminarCarga(req, res) {
  const { id } = req.params;

  // fn_eliminar_carga() siempre devuelve una fila (aunque el id no exista,
  // sus DELETE simplemente no afectan nada), así que se verifica la
  // existencia antes para poder responder 404 correctamente.
  const { data: existente, error: errorExistente } = await supabase
    .from('carga_csv')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (errorExistente) return res.status(500).json({ error: errorExistente.message });
  if (!existente) return res.status(404).json({ error: 'Carga no encontrada' });

  const { data, error } = await supabase.rpc('fn_eliminar_carga', { p_carga_id: Number(id) });
  if (error) return res.status(500).json({ error: error.message });

  res.json({
    eliminado: true,
    respuestas_eliminadas: data[0].respuestas_eliminadas,
    encuestas_eliminadas: data[0].encuestas_eliminadas,
    encuestados_eliminados: data[0].encuestados_eliminados,
  });
}
