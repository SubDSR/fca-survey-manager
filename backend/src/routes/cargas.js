import { Router } from 'express';
import multer from 'multer';
import { listarCargasPorCampania, subirCarga, cambiarVisibilidad, eliminarCarga } from '../controllers/cargas.js';

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
 *     responses:
 *       201:
 *         description: Carga procesada sin errores
 *       422:
 *         description: Carga procesada pero todas las filas fallaron
 *       400:
 *         description: Archivo o columnas inválidas
 *       404:
 *         description: Período no encontrado
 *       409:
 *         description: No hay campaña abierta para ese período
 */
router.post('/', upload.single('file'), subirCarga);

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
