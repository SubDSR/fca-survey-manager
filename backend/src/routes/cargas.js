import { Router } from 'express';
import multer from 'multer';
import {
  listarCargasPorCampania, subirCarga, obtenerCarga, cambiarVisibilidad, eliminarCarga,
  listarPendientesDeCarga, resolverPendienteCarga, detectarContextoVirtualHandler,
} from '../controllers/cargas.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

/**
 * @swagger
 * /api/cargas:
 *   get:
 *     summary: Historial de cargas de una campaña (incluye ocultas, marcadas con "visible")
 *     tags: [Cargas]
 *     parameters:
 *       - in: query
 *         name: campania_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Historial y total acumulado (solo cuenta cargas visibles)
 */
router.get('/', listarCargasPorCampania);

/**
 * @swagger
 * /api/cargas:
 *   post:
 *     summary: Sube un CSV de encuestas (cada carga es dueña de sus propios encuestados)
 *     tags: [Cargas]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [periodo_id, file]
 *             properties:
 *               periodo_id:
 *                 type: integer
 *               file:
 *                 type: string
 *                 format: binary
 *               tipo:
 *                 type: string
 *                 enum: [presencial, virtual]
 *                 description: >
 *                   'virtual' activa el pipeline de encuestas virtuales (CSV sin
 *                   Programa/Docente/Curso por fila; requiere curso_grupo_docente_id).
 *                   Por defecto 'presencial'.
 *               curso_grupo_docente_id:
 *                 type: integer
 *                 description: Requerido cuando tipo=virtual — fija el contexto de todo el archivo.
 *     responses:
 *       202:
 *         description: >
 *           Archivo validado y carga registrada con estado='procesando' — el
 *           procesamiento real sigue en background. Hacer polling a
 *           GET /api/cargas/{id} hasta que estado sea 'completado',
 *           'completado_con_errores' o 'error'.
 *       400:
 *         description: Archivo o columnas inválidas
 *       404:
 *         description: Período (o curso_grupo_docente, si tipo=virtual) no encontrado
 *       409:
 *         description: No hay campaña abierta para ese período
 */
router.post('/', upload.single('file'), subirCarga);

/**
 * @swagger
 * /api/cargas/detectar-contexto-virtual:
 *   get:
 *     summary: Sugiere Docente/Curso/Ciclo/Sección/Programa a partir del nombre de un archivo virtual
 *     tags: [Cargas]
 *     parameters:
 *       - in: query
 *         name: nombre_archivo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: >
 *           { badge: 'success'|'warning', motivos: string[], docente, curso,
 *           ciclo_detectado, seccion_detectada, curso_grupo_docente }. Solo
 *           lectura, no dispara ninguna carga.
 *       400:
 *         description: Falta nombre_archivo
 */
router.get('/detectar-contexto-virtual', detectarContextoVirtualHandler);

/**
 * @swagger
 * /api/cargas/{id}:
 *   get:
 *     summary: Estado y progreso de una carga puntual (para hacer polling mientras estado='procesando')
 *     tags: [Cargas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Carga con filas_procesadas y estado actualizados
 *       404:
 *         description: Carga no encontrada
 */
router.get('/:id', obtenerCarga);

/**
 * @swagger
 * /api/cargas/{id}/pendientes:
 *   get:
 *     summary: Filas de una carga presencial ambiguas por fuzzy matching, aún sin resolver
 *     tags: [Cargas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de pendientes (estado='pendiente'), con sus candidatos sugeridos
 */
router.get('/:id/pendientes', listarPendientesDeCarga);

/**
 * @swagger
 * /api/cargas/pendientes/{pendienteId}/resolver:
 *   post:
 *     summary: Resuelve una fila ambigua (usar un candidato existente, crear nuevo, o descartar)
 *     tags: [Cargas]
 *     parameters:
 *       - in: path
 *         name: pendienteId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accion]
 *             properties:
 *               accion:
 *                 type: string
 *                 enum: [usar_existente, crear_nuevo, descartar]
 *               docente_id:
 *                 type: integer
 *                 description: Requerido si accion=usar_existente y el pendiente es de tipo docente.
 *               asignatura_id:
 *                 type: integer
 *                 description: Requerido si accion=usar_existente y el pendiente es de tipo asignatura.
 *     responses:
 *       200:
 *         description: Resuelto (puede que la fila aún no se inserte si tiene otra ambigüedad pendiente)
 *       400:
 *         description: Acción o parámetros inválidos
 *       404:
 *         description: Pendiente no encontrado
 *       409:
 *         description: El pendiente ya fue resuelto/descartado antes
 *       422:
 *         description: Se resolvió la ambigüedad pero la fila falló al insertarse por otro motivo
 */
router.post('/pendientes/:pendienteId/resolver', resolverPendienteCarga);

/**
 * @swagger
 * /api/cargas/{id}/visibilidad:
 *   patch:
 *     summary: Oculta o muestra una carga (reversible, no borra datos)
 *     tags: [Cargas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [visible]
 *             properties:
 *               visible:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Carga actualizada
 *       404:
 *         description: Carga no encontrada
 */
router.patch('/:id/visibilidad', cambiarVisibilidad);

/**
 * @swagger
 * /api/cargas/{id}:
 *   delete:
 *     summary: Elimina una carga y todo lo que insertó (permanente, en cascada)
 *     tags: [Cargas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Eliminada, con conteo de filas borradas por tabla
 *       404:
 *         description: Carga no encontrada
 */
router.delete('/:id', eliminarCarga);

export default router;
