import { Router } from 'express';
import {
  listarProgramas, crearPrograma, actualizarPrograma, cambiarActivoPrograma, listarCatalogosPrograma,
} from '../controllers/programas.js';

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
 *         activo:
 *           type: boolean
 */

/**
 * @swagger
 * /api/programas:
 *   get:
 *     summary: Lista de programas de posgrado
 *     tags: [Programas]
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

/**
 * @swagger
 * /api/programas/catalogos:
 *   get:
 *     summary: Catálogos (nivel de programa) para el formulario de alta/edición
 *     tags: [Programas]
 *     responses:
 *       200:
 *         description: '{ nivel_programa: [{id, codigo, nombre}] }'
 */
router.get('/catalogos', listarCatalogosPrograma);

/**
 * @swagger
 * /api/programas:
 *   post:
 *     summary: Crea un nuevo programa
 *     tags: [Programas]
 *     responses:
 *       201:
 *         description: Programa creado
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Ya existe un programa con ese código
 */
router.post('/', crearPrograma);

/**
 * @swagger
 * /api/programas/{id}:
 *   patch:
 *     summary: Edición de campos de un programa
 *     tags: [Programas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Programa actualizado
 *       404:
 *         description: Programa no encontrado
 */
router.patch('/:id', actualizarPrograma);

/**
 * @swagger
 * /api/programas/{id}/activo:
 *   patch:
 *     summary: Suspende o reactiva un programa (soft delete)
 *     tags: [Programas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Programa actualizado
 *       404:
 *         description: Programa no encontrado
 */
router.patch('/:id/activo', cambiarActivoPrograma);

export default router;
