-- Vista para agrupar los promedios por periodo académico (Histórico).
-- Es la única vista de este archivo: el gráfico "Ciclo Actual"
-- (v_docente_promedio_diario) se decidió eliminar por completo — ver nota
-- en backend/src/controllers/docentes.js sobre promedioActual, que ahora
-- se calcula con una consulta directa en vez de una segunda vista.
CREATE OR REPLACE VIEW v_docente_promedio_historico AS
SELECT
    cgd.docente_id,
    p.codigo AS periodo,
    ROUND((AVG(r.valor_numerico) * 2)::numeric, 1) AS promedio
FROM encuesta e
JOIN curso_grupo_docente cgd ON e.curso_grupo_docente_id = cgd.id
JOIN curso_grupo cg ON cgd.curso_grupo_id = cg.id
JOIN grupo g ON cg.grupo_id = g.id
JOIN periodo_academico p ON g.periodo_academico_id = p.id
JOIN respuesta r ON e.id = r.encuesta_id
LEFT JOIN carga_csv cc ON cc.id = e.carga_id
WHERE r.respondida = true
  AND r.escala_tipo = 'NUMERICA'
  AND (e.carga_id IS NULL OR cc.visible = true)
GROUP BY cgd.docente_id, p.codigo;

-- Sin GRANT a anon/authenticated: el frontend nunca habla directo con
-- Supabase, todo pasa por el backend con SUPABASE_SERVICE_ROLE_KEY (ver
-- backend/src/controllers/docentes.js). service_role ya tiene SELECT
-- automáticamente sobre vistas nuevas gracias al
-- "alter default privileges in schema public grant all on tables to
-- service_role" de 2026-08-02-grants-service-role.sql — verificado vía
-- MCP contra el proyecto real: pg_default_acl para el rol que crea estas
-- vistas (postgres, igual que el resto de migraciones aplicadas por este
-- mecanismo) ya incluye SELECT para service_role, sin necesidad de un
-- GRANT adicional aquí.
