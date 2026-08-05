import { Router } from 'express';
import { listarAuditLog } from '../controllers/auditLog.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AuditLogEntry:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         tabla:
 *           type: string
 *         registro_id:
 *           type: integer
 *         accion:
 *           type: string
 *           enum: [INSERT, UPDATE, SUSPEND, REACTIVATE]
 *         datos_anteriores:
 *           type: object
 *         datos_nuevos:
 *           type: object
 *         usuario:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/audit-log:
 *   get:
 *     summary: Historial de cambios de un registro (docente, programa, asignatura, encuesta, revision_asignacion)
 *     tags: [AuditLog]
 *     parameters:
 *       - in: query
 *         name: tabla
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: registro_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de cambios, más reciente primero
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AuditLogEntry'
 *       400:
 *         description: Faltan parámetros
 */
router.get('/', listarAuditLog);

export default router;
