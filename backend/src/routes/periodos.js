import { Router } from 'express';
import { listarPeriodos, crearPeriodo, activarPeriodo, campaniaActivaDePeriodo } from '../controllers/periodos.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PeriodoAcademico:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         codigo:
 *           type: string
 *           example: "2026-I"
 *         anio:
 *           type: integer
 *         semestre:
 *           type: integer
 *           enum: [1, 2, 3]
 *         fecha_inicio:
 *           type: string
 *           format: date
 *         fecha_fin:
 *           type: string
 *           format: date
 *         estado:
 *           type: string
 *           enum: [PLANIFICADO, EN_CURSO, CERRADO]
 */

/**
 * @swagger
 * /api/periodos:
 *   get:
 *     summary: Lista todos los períodos académicos
 *     tags: [Periodos]
 *     responses:
 *       200:
 *         description: Lista de períodos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PeriodoAcademico'
 */
router.get('/', listarPeriodos);

/**
 * @swagger
 * /api/periodos:
 *   post:
 *     summary: Crea un nuevo período académico
 *     tags: [Periodos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [anio, semestre]
 *             properties:
 *               anio:
 *                 type: integer
 *                 example: 2026
 *               semestre:
 *                 type: integer
 *                 enum: [1, 2, 3]
 *                 example: 2
 *               fecha_inicio:
 *                 type: string
 *                 format: date
 *               fecha_fin:
 *                 type: string
 *                 format: date
 *               activar:
 *                 type: boolean
 *                 description: Si es true, cierra el período EN_CURSO anterior y activa este.
 *     responses:
 *       201:
 *         description: Período creado
 *       400:
 *         description: Código inválido
 *       409:
 *         description: El período ya existe
 */
router.post('/', crearPeriodo);

/**
 * @swagger
 * /api/periodos/{id}/activar:
 *   patch:
 *     summary: Marca un período como EN_CURSO (cierra el que estaba EN_CURSO)
 *     tags: [Periodos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Período activado
 *       404:
 *         description: Período no encontrado
 */
router.patch('/:id/activar', activarPeriodo);

/**
 * @swagger
 * /api/periodos/{id}/campania-activa:
 *   get:
 *     summary: Devuelve la campaña ABIERTA/BORRADOR de un período (para consultar su historial de cargas)
 *     tags: [Periodos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Campaña activa
 *       404:
 *         description: No hay campaña abierta para este período
 */
router.get('/:id/campania-activa', campaniaActivaDePeriodo);

export default router;
