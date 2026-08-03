-- Vista para agrupar los promedios por periodo académico (Histórico)
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
WHERE r.respondida = true 
  AND r.escala_tipo = 'NUMERICA'
GROUP BY cgd.docente_id, p.codigo;

-- Vista para agrupar los promedios por fecha de respuesta (Ciclo Actual)
CREATE OR REPLACE VIEW v_docente_promedio_diario AS
SELECT 
    cgd.docente_id,
    p.codigo AS periodo_academico,
    TO_CHAR(e.fecha_respuesta, 'DD Mon') AS periodo,
    ROUND((AVG(r.valor_numerico) * 2)::numeric, 1) AS promedio
FROM encuesta e
JOIN curso_grupo_docente cgd ON e.curso_grupo_docente_id = cgd.id
JOIN curso_grupo cg ON cgd.curso_grupo_id = cg.id
JOIN grupo g ON cg.grupo_id = g.id
JOIN periodo_academico p ON g.periodo_academico_id = p.id
JOIN respuesta r ON e.id = r.encuesta_id
WHERE r.respondida = true 
  AND r.escala_tipo = 'NUMERICA'
GROUP BY cgd.docente_id, p.codigo, DATE(e.fecha_respuesta), TO_CHAR(e.fecha_respuesta, 'DD Mon')
ORDER BY DATE(e.fecha_respuesta);

-- Permisos (Asegurar que el API anónimo / autenticado pueda leer estas vistas si es necesario)
GRANT SELECT ON v_docente_promedio_historico TO anon, authenticated;
GRANT SELECT ON v_docente_promedio_diario TO anon, authenticated;
