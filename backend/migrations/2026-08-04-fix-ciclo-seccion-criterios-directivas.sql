-- Fix: v_promedio_por_criterio y v_encuesta_directivas derivaban
-- programa_id/ciclo/seccion de `encuestado.grupo_id` (el grupo del
-- ESTUDIANTE, fijado al importar el CSV y que nunca cambia), mientras que
-- v_docente_seccion_consolidada / v_respuesta_detalle ya los derivaban de
-- curso_grupo_docente -> curso_grupo -> grupo (el grupo real del DICTADO,
-- vía `cg.grupo_id`). En el flujo de import normal ambos coinciden siempre
-- (resolverEncuestado y resolverCursoGrupoDocente en importarEncuestas.js
-- reciben el mismo `grupo.id` de la misma fila del CSV), pero divergen en
-- cuanto `POST /api/revisiones/:id/resolver` (accion=reasignar) mueve
-- encuesta.curso_grupo_docente_id a un destino con otro ciclo/sección --
-- el `matchKey(docente,asignatura,ciclo,seccion)` de
-- frontend/src/lib/seccionesOrigen.js (usado por RadarPanel.jsx /
-- DirectivesChecklist.jsx) deja de encontrar coincidencias contra
-- v_docente_seccion_consolidada, y el radar/cumplimiento de directivas
-- queda vacío aunque la nota (que no depende de este cruce) sí se calcule.
--
-- v_respuesta_detalle ya usaba el patrón correcto (cg.grupo_id) -- este fix
-- solo alinea las otras dos vistas con ese mismo patrón, no introduce un
-- concepto nuevo.

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
join campania_evaluacion ca on ca.id = en.campania_id
join politica_evaluacion pol on pol.id = ca.politica_evaluacion_id
join curso_grupo_docente cgd on cgd.id = e.curso_grupo_docente_id
join curso_grupo cg on cg.id = cgd.curso_grupo_id
join grupo g on g.id = cg.grupo_id
left join carga_csv cc on cc.id = e.carga_id
where (e.carga_id is null or cc.visible = true)
  and not exists (
    select 1 from revision_asignacion ra
    where ra.curso_grupo_docente_id = e.curso_grupo_docente_id
      and ra.estado in ('pendiente','descartada')
  )
group by cgd.docente_id, cg.grupo_id, cg.asignatura_id, g.programa_id, g.ciclo, g.seccion, p.id, p.codigo, p.etiqueta_corta, p.orden, pol.factor_conversion
order by p.orden;

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
join curso_grupo_docente cgd on cgd.id = e.curso_grupo_docente_id
join curso_grupo cg on cg.id = cgd.curso_grupo_id
join grupo g on g.id = cg.grupo_id
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
