import { Router } from 'express';
import {
  listarAsignaturas, crearAsignatura, actualizarAsignatura, cambiarActivoAsignatura,
} from '../controllers/asignaturas.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Asignatura:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nombre:
 *           type: string
 *         ciclo:
 *           type: integer
 *         creditos:
 *           type: integer
 *         es_electivo:
 *           type: boolean
 *         activo:
 *           type: boolean
 *         programa_id:
 *           type: integer
 *         programa:
 *           type: string
 */

/**
 * @swagger
 * /api/asignaturas:
 *   get:
 *     summary: Catálogo completo de cursos (asignaturas), con el programa resuelto
 *     tags: [Asignaturas]
 *     parameters:
 *       - in: query
 *         name: activo
 *         schema:
 *           type: string
 *           enum: [true, false]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: programa_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de asignaturas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Asignatura'
 */
router.get('/', listarAsignaturas);

/**
 * @swagger
 * /api/asignaturas:
 *   post:
 *     summary: Crea un nuevo curso (resuelve el plan de estudios activo del programa indicado)
 *     tags: [Asignaturas]
 *     responses:
 *       201:
 *         description: Curso creado
 *       400:
 *         description: Datos inválidos o el programa no tiene plan de estudios activo
 */
router.post('/', crearAsignatura);

/**
 * @swagger
 * /api/asignaturas/{id}:
 *   patch:
 *     summary: Edición de campos de un curso
 *     tags: [Asignaturas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Curso actualizado
 *       404:
 *         description: Curso no encontrado
 */
router.patch('/:id', actualizarAsignatura);

/**
 * @swagger
 * /api/asignaturas/{id}/activo:
 *   patch:
 *     summary: Suspende o reactiva un curso (soft delete)
 *     tags: [Asignaturas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Curso actualizado
 *       404:
 *         description: Curso no encontrado
 */
router.patch('/:id/activo', cambiarActivoAsignatura);

export default router;
