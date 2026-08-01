import { Router } from 'express';
import { listarProgramas } from '../controllers/programas.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Programa:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         codigo:
 *           type: string
 *         nombre_base:
 *           type: string
 *         mencion:
 *           type: string
 *         nombre_corto:
 *           type: string
 *         nivel_programa_id:
 *           type: integer
 */

/**
 * @swagger
 * /api/programas:
 *   get:
 *     summary: Lista de programas de posgrado
 *     tags: [Programas]
 *     responses:
 *       200:
 *         description: Lista de programas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Programa'
 */
router.get('/', listarProgramas);

export default router;
