import { Router } from 'express';
import { listarRevisiones, obtenerRevision, resolverRevision } from '../controllers/revisiones.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Incidencia:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         curso_grupo_docente_id:
 *           type: integer
 *         estado:
 *           type: string
 *           enum: [pendiente, reasignada, confirmada_correcta, descartada]
 *         docente:
 *           type: string
 *         curso:
 *           type: string
 *         programa:
 *           type: string
 *         ciclo:
 *           type: integer
 *         seccion:
 *           type: integer
 *         n_encuestas:
 *           type: integer
 *         encuesta_mas_antigua:
 *           type: string
 */

/**
 * @swagger
 * /api/revisiones:
 *   get:
 *     summary: Lista de incidencias de asignaciones sin respaldo oficial
 *     tags: [Revisiones]
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de incidencias
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Incidencia'
 */
router.get('/', listarRevisiones);

/**
 * @swagger
 * /api/revisiones/{id}:
 *   get:
 *     summary: Detalle de una incidencia, incluyendo cursos oficiales del docente para reasignar
 *     tags: [Revisiones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalle de la incidencia
 *       404:
 *         description: No encontrada
 */
router.get('/:id', obtenerRevision);

/**
 * @swagger
 * /api/revisiones/{id}/resolver:
 *   post:
 *     summary: Resuelve una incidencia (reasignar, confirmar o descartar)
 *     tags: [Revisiones]
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
 *             properties:
 *               accion:
 *                 type: string
 *                 enum: [reasignar, confirmar, descartar]
 *               curso_grupo_docente_destino_id:
 *                 type: integer
 *               notas:
 *                 type: string
 *     responses:
 *       200:
 *         description: Incidencia resuelta
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: No encontrada
 *       409:
 *         description: Ya estaba resuelta
 */
router.post('/:id/resolver', resolverRevision);

export default router;
