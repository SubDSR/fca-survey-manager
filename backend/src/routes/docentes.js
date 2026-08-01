import { Router } from 'express';
import { listarDocentes, obtenerDocentePorId } from '../controllers/docentes.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     DocenteFicha:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nombre_completo:
 *           type: string
 *         condicion:
 *           type: string
 *         facultad:
 *           type: string
 *         grado_academico:
 *           type: string
 *         correo_institucional:
 *           type: string
 *         tiene_portafolio:
 *           type: boolean
 *         registrado_sunedu:
 *           type: boolean
 *     DocenteCurso:
 *       type: object
 *       properties:
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
 */

/**
 * @swagger
 * /api/docentes:
 *   get:
 *     summary: Lista todos los docentes evaluados con su ficha completa
 *     tags: [Docentes]
 *     responses:
 *       200:
 *         description: Lista de docentes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DocenteFicha'
 */
router.get('/', listarDocentes);

/**
 * @swagger
 * /api/docentes/{id}:
 *   get:
 *     summary: Ficha de un docente y sus cursos consolidados por sección oficial
 *     tags: [Docentes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del docente
 *     responses:
 *       200:
 *         description: Ficha del docente con sus cursos
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/DocenteFicha'
 *                 - type: object
 *                   properties:
 *                     cursos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DocenteCurso'
 *       404:
 *         description: Docente no encontrado
 */
router.get('/:id', obtenerDocentePorId);

export default router;
