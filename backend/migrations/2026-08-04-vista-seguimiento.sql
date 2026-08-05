-- backend/src/controllers/encuestas.js -> obtenerSeguimiento hace
-- fetchAllRows('v_seguimiento'), enrutado como GET /encuestas/seguimiento
-- (backend/src/routes/encuestas.js). Esa vista nunca se creó: el endpoint
-- respondía 500 con "relation v_seguimiento does not exist" en cualquier
-- llamada. El contrato de columnas es el que ya documenta el swagger de la
-- ruta (schema "Seguimiento"): docente_id, nombre_completo, nota_promedio,
-- pct_no, nivel_alerta ('CRITICO' | 'ADVERTENCIA').
--
-- No reinventa el cálculo de nota/% de "No": se apoya en v_encuesta_nota
-- (nota DIM_I por encuesta, ya pondera por politica_evaluacion.factor_conversion)
-- y v_encuesta_directivas (conteo Sí/No/A veces de DIM_II por encuesta),
-- las mismas vistas base que usan v_docente_promedio_historico y
-- v_docente_seccion_consolidada. Ambas ya filtran carga_csv.visible
-- internamente, así que v_seguimiento lo hereda sin repetir el filtro.
--
-- Alcance de campaña: a diferencia de v_promedio_por_criterio o
-- v_encuesta_directivas (que no filtran por campaña porque hoy solo existe
-- una), aquí SÍ se restringe explícitamente a la campaña con
-- estado = 'ABIERTA' -- "seguimiento" es por definición un monitoreo de la
-- evaluación en curso, no un acumulado histórico entre campañas cerradas.
-- Los umbrales (politica_evaluacion) se toman de la política ligada a esa
-- misma campaña abierta; si no hay ninguna campaña abierta, la vista queda
-- vacía en vez de fallar (comportamiento razonable: nada que seguir si no
-- hay evaluación en curso).
--
-- Ya aplicada contra el proyecto real (tqhqizvfehatfvmvwtsb) vía MCP el
-- 2026-08-04. Este archivo la deja versionada en el repo.

create or replace view v_seguimiento as
with campania_abierta as (
    select ca.id as campania_id, ca.politica_evaluacion_id
    from campania_evaluacion ca
    where ca.estado = 'ABIERTA'
),
politica_activa as (
    select pol.*
    from politica_evaluacion pol
    join campania_abierta cab on cab.politica_evaluacion_id = pol.id
    limit 1
),
nota_docente as (
    select cgd.docente_id,
        avg(vn.nota_final) as nota_promedio,
        count(distinct vn.encuesta_id) as n_encuestas_validas
    from v_encuesta_nota vn
    join encuestado en on en.id = vn.encuestado_id
    join campania_abierta cab on cab.campania_id = en.campania_id
    join curso_grupo_docente cgd on cgd.id = vn.curso_grupo_docente_id
    group by cgd.docente_id
),
directivas_docente as (
    select vd.docente_id,
        sum(vd.n_no) as n_no,
        sum(vd.total) as total
    from v_encuesta_directivas vd
    join encuesta e on e.id = vd.encuesta_id
    join encuestado en on en.id = e.encuestado_id
    join campania_abierta cab on cab.campania_id = en.campania_id
    group by vd.docente_id
)
select
    d.id as docente_id,
    d.nombre_completo,
    round(nd.nota_promedio, 1) as nota_promedio,
    round((100.0 * coalesce(dd.n_no, 0)) / nullif(dd.total, 0), 0) as pct_no,
    case
        when nd.nota_promedio < pa.umbral_seguimiento_nota
            or (100.0 * coalesce(dd.n_no, 0)) / nullif(dd.total, 0) >= pa.umbral_critico_pct_no
        then 'CRITICO'
        else 'ADVERTENCIA'
    end as nivel_alerta
from nota_docente nd
join docente d on d.id = nd.docente_id
left join directivas_docente dd on dd.docente_id = nd.docente_id
cross join politica_activa pa
where nd.n_encuestas_validas >= pa.min_encuestas_validas
    and (
        nd.nota_promedio < pa.umbral_seguimiento_nota
        or (100.0 * coalesce(dd.n_no, 0)) / nullif(dd.total, 0) >= pa.umbral_seguimiento_pct_no
    );

-- Sin GRANT a anon/authenticated ni política de RLS propia, mismo criterio
-- que 2026-08-02-vistas-graficos-docente.sql: el frontend nunca habla
-- directo con Supabase, todo pasa por el backend con
-- SUPABASE_SERVICE_ROLE_KEY, y service_role ya tiene SELECT automático
-- sobre vistas nuevas de public gracias al "alter default privileges in
-- schema public grant all on tables to service_role" de
-- 2026-08-02-grants-service-role.sql -- verificado vía MCP tras aplicar
-- esta migración (information_schema.role_table_grants para v_seguimiento
-- incluye SELECT para service_role sin GRANT adicional).
