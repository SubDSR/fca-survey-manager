-- Excluye de las vistas de reportes las encuestas cuya carga fue marcada
-- visible=false (ver 2026-08-02-visibilidad-cargas.sql). Las encuestas
-- heredadas (carga_id IS NULL, las 1841 de dataset.csv) siempre se
-- muestran.
--
-- Solo se tocan las vistas que referencian "encuesta" DIRECTAMENTE:
--   v_encuesta_nota, v_encuesta_directivas, v_encuesta_seccion_efectiva,
--   v_respuesta_detalle, v_tasa_respuesta_pregunta, v_promedio_por_criterio,
--   v_docente_curso_consolidado.
-- v_docente_seccion_consolidada NO se toca: se construye enteramente sobre
-- v_encuesta_seccion_efectiva (join interno), así que hereda el filtro
-- automáticamente en cuanto esa vista base lo tiene.
-- v_docente_ficha y v_grupo_aula no referencian "encuesta", no aplica.
--
-- Ya aplicada contra el proyecto real (tqhqizvfehatfvmvwtsb) vía MCP el
-- 2026-08-02. Este archivo la deja versionada en el repo.

create or replace view v_encuesta_nota as
 SELECT e.id AS encuesta_id,
    e.encuestado_id,
    e.curso_grupo_docente_id,
    en.grupo_id AS grupo_estudiante_id,
    count(*) FILTER (WHERE r.respondida) AS criterios_respondidos,
    count(*) AS criterios_totales,
    round((avg(r.valor_numerico) * pol.factor_conversion), 1) AS nota_final,
    (round((avg(r.valor_numerico) * pol.factor_conversion), 1) >= pol.umbral_aprobacion) AS aprobado
   FROM encuesta e
     JOIN encuestado en ON en.id = e.encuestado_id
     JOIN campania_evaluacion c ON c.id = en.campania_id
     JOIN politica_evaluacion pol ON pol.id = c.politica_evaluacion_id
     JOIN respuesta r ON r.encuesta_id = e.id
     JOIN pregunta p ON p.id = r.pregunta_id
     JOIN dimension d ON d.id = p.dimension_id
     LEFT JOIN carga_csv cc ON cc.id = e.carga_id
  WHERE d.codigo = 'DIM_I'::text
    AND (e.carga_id IS NULL OR cc.visible = true)
  GROUP BY e.id, e.encuestado_id, e.curso_grupo_docente_id, en.grupo_id, pol.factor_conversion, pol.umbral_aprobacion;

create or replace view v_encuesta_directivas as
 SELECT e.id AS encuesta_id,
    cgd.docente_id,
    cg.asignatura_id,
    cg.grupo_id,
    g.programa_id,
    g.ciclo,
    g.seccion,
    p.codigo AS pregunta_codigo,
    p.etiqueta_corta,
    count(*) FILTER (WHERE r.respondida) AS total,
    count(*) FILTER (WHERE o.codigo = 'SI'::text) AS n_si,
    count(*) FILTER (WHERE o.codigo = 'NO'::text) AS n_no,
    count(*) FILTER (WHERE o.codigo = 'A_VECES'::text) AS n_a_veces,
    count(*) FILTER (WHERE NOT r.respondida) AS n_sin_responder
   FROM encuesta e
     JOIN encuestado en ON en.id = e.encuestado_id
     JOIN grupo g ON g.id = en.grupo_id
     JOIN curso_grupo_docente cgd ON cgd.id = e.curso_grupo_docente_id
     JOIN curso_grupo cg ON cg.id = cgd.curso_grupo_id
     JOIN respuesta r ON r.encuesta_id = e.id
     JOIN pregunta p ON p.id = r.pregunta_id
     JOIN dimension d ON d.id = p.dimension_id AND d.codigo = 'DIM_II'::text
     LEFT JOIN opcion_escala o ON o.id = r.opcion_escala_id
     LEFT JOIN carga_csv cc ON cc.id = e.carga_id
  WHERE (e.carga_id IS NULL OR cc.visible = true)
  GROUP BY e.id, cgd.docente_id, cg.asignatura_id, cg.grupo_id, g.programa_id, g.ciclo, g.seccion, p.codigo, p.etiqueta_corta, p.orden
  ORDER BY p.orden;

create or replace view v_encuesta_seccion_efectiva as
 SELECT e.id AS encuesta_id,
    cgd.id AS cgd_original,
    COALESCE(con.cgd_destino_id, cgd.id) AS cgd_efectivo
   FROM encuesta e
     JOIN curso_grupo_docente cgd ON cgd.id = e.curso_grupo_docente_id
     LEFT JOIN curso_grupo_docente_consolidacion con ON con.cgd_origen_id = cgd.id
     LEFT JOIN carga_csv cc ON cc.id = e.carga_id
  WHERE (e.carga_id IS NULL OR cc.visible = true);

create or replace view v_respuesta_detalle as
 SELECT e.id AS encuesta_id,
    en.codigo AS codigo_encuestado,
    en.secuencia,
    cgd.docente_id,
    cg.asignatura_id,
    cg.grupo_id,
    g.ciclo,
    g.seccion,
    p.codigo AS pregunta_codigo,
    p.etiqueta_corta,
    r.valor_numerico,
    o.etiqueta AS opcion_etiqueta,
    r.respondida
   FROM respuesta r
     JOIN encuesta e ON e.id = r.encuesta_id
     JOIN encuestado en ON en.id = e.encuestado_id
     JOIN curso_grupo_docente cgd ON cgd.id = e.curso_grupo_docente_id
     JOIN curso_grupo cg ON cg.id = cgd.curso_grupo_id
     JOIN grupo g ON g.id = cg.grupo_id
     JOIN pregunta p ON p.id = r.pregunta_id
     LEFT JOIN opcion_escala o ON o.id = r.opcion_escala_id
     LEFT JOIN carga_csv cc ON cc.id = e.carga_id
  WHERE (e.carga_id IS NULL OR cc.visible = true);

create or replace view v_tasa_respuesta_pregunta as
 SELECT ca.id AS campania_id,
    p.id AS pregunta_id,
    p.codigo AS pregunta,
    p.etiqueta_corta,
    d.codigo AS dimension,
    count(*) AS n_encuestas,
    count(*) FILTER (WHERE r.respondida) AS n_respondidas,
    round(((100.0 * (count(*) FILTER (WHERE r.respondida))::numeric) / (NULLIF(count(*), 0))::numeric), 1) AS pct_respuesta
   FROM respuesta r
     JOIN pregunta p ON p.id = r.pregunta_id
     JOIN dimension d ON d.id = p.dimension_id
     JOIN encuesta e ON e.id = r.encuesta_id
     JOIN encuestado en ON en.id = e.encuestado_id
     JOIN campania_evaluacion ca ON ca.id = en.campania_id
     LEFT JOIN carga_csv cc ON cc.id = e.carga_id
  WHERE (e.carga_id IS NULL OR cc.visible = true)
  GROUP BY ca.id, p.id, p.codigo, p.etiqueta_corta, d.codigo, p.orden
  ORDER BY ca.id, p.orden;

create or replace view v_promedio_por_criterio as
 SELECT cgd.docente_id,
    cg.grupo_id,
    cg.asignatura_id,
    g.programa_id,
    g.ciclo,
    g.seccion,
    p.id AS pregunta_id,
    p.codigo AS pregunta_codigo,
    p.etiqueta_corta,
    count(*) FILTER (WHERE r.respondida) AS n,
    round((avg(r.valor_numerico) * pol.factor_conversion), 2) AS promedio_vigesimal
   FROM respuesta r
     JOIN pregunta p ON p.id = r.pregunta_id
     JOIN dimension d ON d.id = p.dimension_id AND d.codigo = 'DIM_I'::text
     JOIN encuesta e ON e.id = r.encuesta_id
     JOIN encuestado en ON en.id = e.encuestado_id
     JOIN grupo g ON g.id = en.grupo_id
     JOIN campania_evaluacion ca ON ca.id = en.campania_id
     JOIN politica_evaluacion pol ON pol.id = ca.politica_evaluacion_id
     JOIN curso_grupo_docente cgd ON cgd.id = e.curso_grupo_docente_id
     JOIN curso_grupo cg ON cg.id = cgd.curso_grupo_id
     LEFT JOIN carga_csv cc ON cc.id = e.carga_id
  WHERE (e.carga_id IS NULL OR cc.visible = true)
  GROUP BY cgd.docente_id, cg.grupo_id, cg.asignatura_id, g.programa_id, g.ciclo, g.seccion, p.id, p.codigo, p.etiqueta_corta, p.orden, pol.factor_conversion
  ORDER BY p.orden;

create or replace view v_docente_curso_consolidado as
 SELECT cgd.docente_id,
    d.nombre_completo,
    cg.asignatura_id,
    a.nombre AS asignatura,
    pr.nombre_corto AS programa,
    count(DISTINCT e.id) AS n_encuestas,
    round(avg(vn.nota_final), 1) AS nota_promedio,
    round(((100.0 * sum(vd2.n_si)) / NULLIF(sum(vd2.total), (0)::numeric)), 0) AS pct_si,
    string_agg(DISTINCT ((g.ciclo || '-'::text) || g.seccion), ', '::text ORDER BY ((g.ciclo || '-'::text) || g.seccion)) AS origen_encuestas
   FROM encuesta e
     JOIN encuestado en ON en.id = e.encuestado_id
     JOIN grupo g ON g.id = en.grupo_id
     JOIN curso_grupo_docente cgd ON cgd.id = e.curso_grupo_docente_id
     JOIN curso_grupo cg ON cg.id = cgd.curso_grupo_id
     JOIN asignatura a ON a.id = cg.asignatura_id
     JOIN programa pr ON pr.id = g.programa_id
     JOIN docente d ON d.id = cgd.docente_id
     LEFT JOIN v_encuesta_nota vn ON vn.encuesta_id = e.id
     LEFT JOIN ( SELECT v_encuesta_directivas.encuesta_id,
            sum(v_encuesta_directivas.total) AS total,
            sum(v_encuesta_directivas.n_si) AS n_si
           FROM v_encuesta_directivas
          GROUP BY v_encuesta_directivas.encuesta_id) vd2 ON vd2.encuesta_id = e.id
     LEFT JOIN carga_csv cc ON cc.id = e.carga_id
  WHERE (e.carga_id IS NULL OR cc.visible = true)
  GROUP BY cgd.docente_id, d.nombre_completo, cg.asignatura_id, a.nombre, pr.nombre_corto;
