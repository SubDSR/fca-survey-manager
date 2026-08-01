import { Router } from 'express';
import {
  obtenerConsolidado,
  obtenerSeguimiento,
  obtenerCriterios,
  obtenerDirectivas,
  obtenerRespuestas,
} from '../controllers/encuestas.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     EncuestaConsolidada:
 *       type: object
 *       properties:
 *         docente_id:
 *           type: integer
 *         nombre_completo:
 *           type: string
 *         asignatura:
 *           type: string
 *         ciclo:
 *           type: string
 *         seccion:
 *           type: string
 *         n_encuestas:
 *           type: integer
 *         nota_promedio:
 *           type: number
 *         pct_si:
 *           type: number
 *         secciones_origen:
 *           type: array
 *           items:
 *             type: string
 *     Seguimiento:
 *       type: object
 *       properties:
 *         docente_id:
 *           type: integer
 *         nombre_completo:
 *           type: string
 *         nota_promedio:
 *           type: number
 *         pct_no:
 *           type: number
 *         nivel_alerta:
 *           type: string
 *           enum: [CRITICO, ADVERTENCIA]
 *     CriterioPromedio:
 *       type: object
 *       properties:
 *         docente_id:
 *           type: integer
 *         grupo_id:
 *           type: integer
 *         asignatura_id:
 *           type: integer
 *         pregunta_id:
 *           type: integer
 *         pregunta_codigo:
 *           type: string
 *         etiqueta_corta:
 *           type: string
 *         n:
 *           type: integer
 *         promedio_vigesimal:
 *           type: number
 *     EncuestaDirectiva:
 *       type: object
 *       properties:
 *         encuesta_id:
 *           type: integer
 *         total:
 *           type: integer
 *         n_si:
 *           type: integer
 *         n_no:
 *           type: integer
 *         n_a_veces:
 *           type: integer
 *         n_sin_responder:
 *           type: integer
 *     RespuestaDetalle:
 *       type: object
 *       properties:
 *         encuesta_id:
 *           type: integer
 *         codigo_encuestado:
 *           type: string
 *         secuencia:
 *           type: integer
 *         docente_id:
 *           type: integer
 *         asignatura_id:
 *           type: integer
 *         grupo_id:
 *           type: integer
 *         pregunta_codigo:
 *           type: string
 *         valor_numerico:
 *           type: number
 *         opcion_etiqueta:
 *           type: string
 *         respondida:
 *           type: boolean
 */

/**
 * @swagger
 * /api/encuestas/consolidado:
 *   get:
 *     summary: Resultados consolidados de todos los docentes agrupados por sección oficial
 *     description: Las encuestas de secciones dispersas ya están repartidas automáticamente.
 *     tags: [Encuestas]
 *     responses:
 *       200:
 *         description: Lista de resultados consolidados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EncuestaConsolidada'
 */
router.get('/consolidado', obtenerConsolidado);

/**
 * @swagger
 * /api/encuestas/seguimiento:
 *   get:
 *     summary: Docentes que requieren seguimiento (nota < 11 o % de "No" ≥ 30%)
 *     tags: [Encuestas]
 *     responses:
 *       200:
 *         description: Lista de docentes en seguimiento
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Seguimiento'
 */
router.get('/seguimiento', obtenerSeguimiento);

/**
 * @swagger
 * /api/encuestas/criterios:
 *   get:
 *     summary: Promedio vigesimal por pregunta (P1–P6) para cada combinación docente-curso-grupo
 *     tags: [Encuestas]
 *     responses:
 *       200:
 *         description: Lista de promedios por criterio
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CriterioPromedio'
 */
router.get('/criterios', obtenerCriterios);

/**
 * @swagger
 * /api/encuestas/directivas:
 *   get:
 *     summary: Detalle de cumplimiento de directivas por encuesta
 *     tags: [Encuestas]
 *     responses:
 *       200:
 *         description: Lista de conteos de cumplimiento por encuesta
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EncuestaDirectiva'
 */
router.get('/directivas', obtenerDirectivas);

/**
 * @swagger
 * /api/encuestas/respuestas:
 *   get:
 *     summary: Respuestas individuales por encuesta, pregunta y encuestado
 *     description: Detalle a nivel de respuesta (una fila por encuesta+pregunta+encuestado). Se puede acotar a una sección exacta con docente_id, asignatura_id y grupo_id.
 *     tags: [Encuestas]
 *     parameters:
 *       - in: query
 *         name: docente_id
 *         schema:
 *           type: integer
 *         description: Filtra por docente
 *       - in: query
 *         name: asignatura_id
 *         schema:
 *           type: integer
 *         description: Filtra por asignatura
 *       - in: query
 *         name: grupo_id
 *         schema:
 *           type: integer
 *         description: Filtra por grupo
 *     responses:
 *       200:
 *         description: Lista de respuestas individuales
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RespuestaDetalle'
 */
router.get('/respuestas', obtenerRespuestas);

export default router;
