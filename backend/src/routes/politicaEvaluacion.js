import { Router } from 'express';
import { obtenerPoliticaActiva } from '../controllers/politicaEvaluacion.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PoliticaEvaluacion:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         codigo:
 *           type: string
 *         nota_maxima:
 *           type: number
 *         factor_conversion:
 *           type: number
 *         umbral_aprobacion:
 *           type: number
 *           description: Nota mínima para "Aprobado" -- también el corte único de seguimiento por nota.
 *         umbral_seguimiento_pct_no:
 *           type: number
 *         umbral_critico_pct_no:
 *           type: number
 *         min_encuestas_validas:
 *           type: integer
 */

/**
 * @swagger
 * /api/politica-evaluacion:
 *   get:
 *     summary: Política de evaluación activa (umbrales de aprobación/seguimiento) -- fuente única para frontend y backend
 *     tags: [PoliticaEvaluacion]
 *     responses:
 *       200:
 *         description: Política activa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PoliticaEvaluacion'
 *       404:
 *         description: No hay ninguna política registrada
 */
router.get('/', obtenerPoliticaActiva);

export default router;
