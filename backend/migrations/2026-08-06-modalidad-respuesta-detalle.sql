-- Recreamos la vista v_respuesta_detalle para añadir la modalidad al final del SELECT
-- IMPORTANTE: La columna se añade estrictamente al final para no romper la estructura de la vista existente.
-- Se usa COALESCE para mapear modalidad_carga (si existe) y encuesta.origen (si es encuestas muy antiguas) a un valor por defecto 'presencial'.

create or replace view v_respuesta_detalle as
select e.id as encuesta_id,
    en.codigo as codigo_encuestado,
    en.secuencia,
    cgd.docente_id,
    cg.asignatura_id,
    cg.grupo_id,
    g.ciclo,
    g.seccion,
    p.codigo as pregunta_codigo,
    p.etiqueta_corta,
    r.valor_numerico,
    o.etiqueta as opcion_etiqueta,
    r.respondida,
    COALESCE(cc.modalidad_carga, CASE WHEN e.origen = 'WEB' THEN 'virtual' ELSE 'presencial' END) AS modalidad
from respuesta r
join encuesta e on e.id = r.encuesta_id
join encuestado en on en.id = e.encuestado_id
join curso_grupo_docente cgd on cgd.id = e.curso_grupo_docente_id
join curso_grupo cg on cg.id = cgd.curso_grupo_id
join grupo g on g.id = cg.grupo_id
join pregunta p on p.id = r.pregunta_id
left join opcion_escala o on o.id = r.opcion_escala_id
left join carga_csv cc on cc.id = e.carga_id
where (e.carga_id is null or cc.visible = true)
  and not exists (
    select 1 from revision_asignacion ra
    where ra.curso_grupo_docente_id = e.curso_grupo_docente_id
      and ra.estado in ('PENDIENTE', 'DESCARTADA')
  );
