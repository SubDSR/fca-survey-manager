-- revision_asignacion.curso_grupo_docente_id ya tiene índice parcial
-- (ux_revision_asignacion_cgd_pendiente). curso_grupo_docente_destino_id
-- (la otra FK de la misma tabla, poblada al "reasignar") no tenía
-- ninguno -- inconsistente con el resto del esquema, donde toda FK tiene
-- su índice (ix_cgd_docente, ix_encuesta_cgd, ix_docente_contacto_docente,
-- etc.). Hallazgo de la auditoría de schema del 2026-08-06
-- (docs/db-schema-2026-08-06.md, Parte 3).
--
-- Parcial con WHERE ... IS NOT NULL porque la mayoría de filas hoy tienen
-- esta columna en NULL (solo se puebla cuando estado='reasignada') --
-- mismo criterio que ya usa el índice existente de la misma tabla.
--
-- Aplicada contra el proyecto real (tqhqizvfehatfvmvwtsb) vía MCP el
-- 2026-08-06. Este archivo la deja versionada en el repo.

create index ix_revision_asignacion_destino
  on revision_asignacion (curso_grupo_docente_destino_id)
  where curso_grupo_docente_destino_id is not null;
