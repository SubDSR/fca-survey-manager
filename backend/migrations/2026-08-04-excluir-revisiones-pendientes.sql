-- Las vistas/consultas que agregan sobre `encuesta` para nota/cumplimiento
-- excluyen las encuestas cuyo curso_grupo_docente tiene una incidencia
-- 'pendiente' o 'descartada' en revision_asignacion. 'confirmada_correcta' y
-- 'reasignada' NO se excluyen: la primera vuelve a contar tal cual estaba
-- (el mismo curso_grupo_docente_id de siempre), la segunda ya no aplica
-- porque el UPDATE de encuesta.curso_grupo_docente_id (ver POST
-- /api/revisiones/:id/resolver) ya movió esas filas al destino oficial.
--
-- v_docente_seccion_consolidada y v_seguimiento NO se tocan en esta
-- migración: heredan la exclusión transitivamente (la primera se arma FROM
-- v_encuesta_seccion_efectiva + JOIN v_encuesta_nota/v_encuesta_directivas;
-- la segunda, de v_encuesta_nota/v_encuesta_directivas), sin agregar nada
-- nuevo directamente sobre `encuesta`.

create or replace view v_encuesta_seccion_efectiva as
select e.id as encuesta_id,
    cgd.id as cgd_original,
    coalesce(con.cgd_destino_id, cgd.id) as cgd_efectivo
from encuesta e
join curso_grupo_docente cgd on cgd.id = e.curso_grupo_docente_id
left join curso_grupo_docente_consolidacion con on con.cgd_origen_id = cgd.id
left join carga_csv cc on cc.id = e.carga_id
where (e.carga_id is null or cc.visible = true)
  and not exists (
    select 1 from revision_asignacion ra
    where ra.curso_grupo_docente_id = e.curso_grupo_docente_id
      and ra.estado in ('pendiente','descartada')
  );

create or replace view v_docente_promedio_historico as
select cgd.docente_id,
    p.codigo as periodo,
    round(avg(r.valor_numerico) * 2, 1) as promedio
from encuesta e
join curso_grupo_docente cgd on e.curso_grupo_docente_id = cgd.id
join curso_grupo cg on cgd.curso_grupo_id = cg.id
join grupo g on cg.grupo_id = g.id
join periodo_academico p on g.periodo_academico_id = p.id
join respuesta r on e.id = r.encuesta_id
left join carga_csv cc on cc.id = e.carga_id
where r.respondida = true and r.escala_tipo = 'NUMERICA'
  and (e.carga_id is null or cc.visible = true)
  and not exists (
    select 1 from revision_asignacion ra
    where ra.curso_grupo_docente_id = e.curso_grupo_docente_id
      and ra.estado in ('pendiente','descartada')
  )
group by cgd.docente_id, p.codigo;

create or replace view v_encuesta_directivas as
select e.id as encuesta_id,
    cgd.docente_id,
    cg.asignatura_id,
    cg.grupo_id,
    g.programa_id,
    g.ciclo,
    g.seccion,
    p.codigo as pregunta_codigo,
    p.etiqueta_corta,
    count(*) filter (where r.respondida) as total,
    count(*) filter (where o.codigo = 'SI') as n_si,
    count(*) filter (where o.codigo = 'NO') as n_no,
    count(*) filter (where o.codigo = 'A_VECES') as n_a_veces,
    count(*) filter (where not r.respondida) as n_sin_responder
from encuesta e
join encuestado en on en.id = e.encuestado_id
join grupo g on g.id = en.grupo_id
join curso_grupo_docente cgd on cgd.id = e.curso_grupo_docente_id
join curso_grupo cg on cg.id = cgd.curso_grupo_id
join respuesta r on r.encuesta_id = e.id
join pregunta p on p.id = r.pregunta_id
join dimension d on d.id = p.dimension_id and d.codigo = 'DIM_II'
left join opcion_escala o on o.id = r.opcion_escala_id
left join carga_csv cc on cc.id = e.carga_id
where (e.carga_id is null or cc.visible = true)
  and not exists (
    select 1 from revision_asignacion ra
    where ra.curso_grupo_docente_id = e.curso_grupo_docente_id
      and ra.estado in ('pendiente','descartada')
  )
group by e.id, cgd.docente_id, cg.asignatura_id, cg.grupo_id, g.programa_id, g.ciclo, g.seccion, p.codigo, p.etiqueta_corta, p.orden
order by p.orden;

create or replace view v_encuesta_nota as
select e.id as encuesta_id,
    e.encuestado_id,
    e.curso_grupo_docente_id,
    en.grupo_id as grupo_estudiante_id,
    count(*) filter (where r.respondida) as criterios_respondidos,
    count(*) as criterios_totales,
    round(avg(r.valor_numerico) * pol.factor_conversion, 1) as nota_final,
    round(avg(r.valor_numerico) * pol.factor_conversion, 1) >= pol.umbral_aprobacion as aprobado
from encuesta e
join encuestado en on en.id = e.encuestado_id
join campania_evaluacion c on c.id = en.campania_id
join politica_evaluacion pol on pol.id = c.politica_evaluacion_id
join respuesta r on r.encuesta_id = e.id
join pregunta p on p.id = r.pregunta_id
join dimension d on d.id = p.dimension_id
left join carga_csv cc on cc.id = e.carga_id
where d.codigo = 'DIM_I' and (e.carga_id is null or cc.visible = true)
  and not exists (
    select 1 from revision_asignacion ra
    where ra.curso_grupo_docente_id = e.curso_grupo_docente_id
      and ra.estado in ('pendiente','descartada')
  )
group by e.id, e.encuestado_id, e.curso_grupo_docente_id, en.grupo_id, pol.factor_conversion, pol.umbral_aprobacion;

create or replace view v_promedio_por_criterio as
select cgd.docente_id,
    cg.grupo_id,
    cg.asignatura_id,
    g.programa_id,
    g.ciclo,
    g.seccion,
    p.id as pregunta_id,
    p.codigo as pregunta_codigo,
    p.etiqueta_corta,
    count(*) filter (where r.respondida) as n,
    round(avg(r.valor_numerico) * pol.factor_conversion, 2) as promedio_vigesimal
from respuesta r
join pregunta p on p.id = r.pregunta_id
join dimension d on d.id = p.dimension_id and d.codigo = 'DIM_I'
join encuesta e on e.id = r.encuesta_id
join encuestado en on en.id = e.encuestado_id
join grupo g on g.id = en.grupo_id
join campania_evaluacion ca on ca.id = en.campania_id
join politica_evaluacion pol on pol.id = ca.politica_evaluacion_id
join curso_grupo_docente cgd on cgd.id = e.curso_grupo_docente_id
join curso_grupo cg on cg.id = cgd.curso_grupo_id
left join carga_csv cc on cc.id = e.carga_id
where (e.carga_id is null or cc.visible = true)
  and not exists (
    select 1 from revision_asignacion ra
    where ra.curso_grupo_docente_id = e.curso_grupo_docente_id
      and ra.estado in ('pendiente','descartada')
  )
group by cgd.docente_id, cg.grupo_id, cg.asignatura_id, g.programa_id, g.ciclo, g.seccion, p.id, p.codigo, p.etiqueta_corta, p.orden, pol.factor_conversion
order by p.orden;

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
    r.respondida
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
      and ra.estado in ('pendiente','descartada')
  );
