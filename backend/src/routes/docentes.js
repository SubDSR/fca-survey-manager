import { Router } from 'express';
import {
  listarDocentes,
  obtenerDocentePorId,
  crearDocente,
  actualizarDocente,
  cambiarActivoDocente,
  listarCatalogosDocente,
} from '../controllers/docentes.js';

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
 *         activo:
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
 *     summary: Lista docentes (ficha completa), con filtros opcionales de estado y búsqueda
 *     tags: [Docentes]
 *     parameters:
 *       - in: query
 *         name: activo
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filtra por estado activo/suspendido. Sin este parámetro, devuelve todos.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nombre completo o número de documento (case-insensitive, parcial).
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
 * /api/docentes/catalogos:
 *   get:
 *     summary: Catálogos (tipo de documento, facultad, condición, categoría, grado, país) para los formularios de alta/edición
 *     tags: [Docentes]
 *     responses:
 *       200:
 *         description: Un array [{id, nombre}] por catálogo
 */
router.get('/catalogos', listarCatalogosDocente);

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

/**
 * @swagger
 * /api/docentes:
 *   post:
 *     summary: Alta manual de un docente
 *     tags: [Docentes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre_completo]
 *             properties:
 *               nombre_completo:
 *                 type: string
 *                 description: Formato "Apellidos, Nombres" (igual que en el CSV de carga).
 *               numero_documento:
 *                 type: string
 *               tipo_documento_id:
 *                 type: integer
 *               correo_institucional:
 *                 type: string
 *               facultad_id:
 *                 type: integer
 *               condicion_docente_id:
 *                 type: integer
 *               categoria_docente_id:
 *                 type: integer
 *               grado_academico_id:
 *                 type: integer
 *               pais_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Docente creado
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: Conflicto con un docente ya existente (DNI/correo duplicado)
 */
router.post('/', crearDocente);

/**
 * @swagger
 * /api/docentes/{id}:
 *   patch:
 *     summary: Edición de campos de un docente
 *     tags: [Docentes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Docente actualizado
 *       404:
 *         description: Docente no encontrado
 */
router.patch('/:id', actualizarDocente);

/**
 * @swagger
 * /api/docentes/{id}/activo:
 *   patch:
 *     summary: Suspende o reactiva un docente (soft delete — nunca borra la fila)
 *     tags: [Docentes]
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
 *             required: [activo]
 *             properties:
 *               activo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Docente actualizado
 *       404:
 *         description: Docente no encontrado
 */
router.patch('/:id/activo', cambiarActivoDocente);

export default router;
