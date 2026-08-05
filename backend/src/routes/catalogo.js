import { Router } from 'express';
import { listarCatalogoHuerfanos, listarCursoGrupoDocenteResidual } from '../controllers/catalogo.js';

const router = Router();

/**
 * @swagger
 * /api/catalogo/huerfanos:
 *   get:
 *     summary: Docente/asignatura sin ningún curso_grupo_docente asociado (diagnóstico, no borra nada)
 *     tags: [Catalogo]
 *     description: >
 *       "carga_probable" es un indicio por cercanía de fecha, no una prueba —
 *       no existe ninguna relación real entre docente/asignatura y la
 *       carga_csv que los creó. Úsalo solo para orientar limpieza manual.
 *     responses:
 *       200:
 *         description: Lista de docente/asignatura huérfanos, más reciente primero
 */
router.get('/huerfanos', listarCatalogoHuerfanos);

/**
 * @swagger
 * /api/catalogo/curso-grupo-docente-residual:
 *   get:
 *     summary: curso_grupo_docente dispersos (es_carga_oficial=false) sin encuestas (diagnóstico, no borra nada)
 *     tags: [Catalogo]
 *     description: >
 *       Excluye explícitamente cualquier curso_grupo_docente referenciado por
 *       revision_asignacion (como origen o destino, en cualquier estado) —
 *       ese es el rastro de una incidencia ya resuelta, no basura de pruebas.
 *     responses:
 *       200:
 *         description: Lista de curso_grupo_docente residuales, más reciente primero
 */
router.get('/curso-grupo-docente-residual', listarCursoGrupoDocenteResidual);

export default router;
