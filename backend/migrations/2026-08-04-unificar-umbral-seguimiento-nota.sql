-- Corrige un umbral de nota inventado que no correspondía a ninguna regla
-- de negocio real: politica_evaluacion.umbral_seguimiento_nota = 11 se
-- introdujo junto con v_seguimiento (2026-08-04-vista-seguimiento.sql) como
-- un corte "más grave que reprobado", pero el criterio real y ya
-- establecido de aprobado/desaprobado en todo el resto del sistema
-- (v_encuesta_nota.aprobado, reportes de Evaluación Docente en el
-- frontend) es umbral_aprobacion = 14. Cualquier docente desaprobado debe
-- aparecer en seguimiento -- no solo los que caen por debajo de 11.
--
-- Confirmado antes de esta migración (information_schema, pg_proc y grep
-- del repo) que umbral_seguimiento_nota no se usa en ningún otro lugar:
-- ninguna otra vista, función ni código de backend la referencia -- solo
-- v_seguimiento. Se elimina la columna en vez de solo resincronizar su
-- valor, para que no puedan volver a divergir en el futuro.
--
-- Orden importa: primero se reemplaza v_seguimiento para que deje de
-- depender de la columna, recién ahí se puede hacer DROP COLUMN sin
-- CASCADE. Ojo con "select pol.*" en la CTE politica_activa: Postgres
-- expande el * a la lista de columnas concreta AL CREAR la vista, así que
-- aunque nunca se referencie pa.umbral_seguimiento_nota más abajo, un
-- "select pol.*" sigue dejando la vista dependiendo de esa columna. Por
-- eso politica_activa lista las columnas explícitas que de verdad usa.
create or replace view v_seguimiento as
with campania_abierta as (
    select ca.id as campania_id, ca.politica_evaluacion_id
    from campania_evaluacion ca
    where ca.estado = 'ABIERTA'
),
politica_activa as (
    select
        pol.id,
        pol.umbral_aprobacion,
        pol.umbral_seguimiento_pct_no,
        pol.umbral_critico_pct_no,
        pol.min_encuestas_validas
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
        when nd.nota_promedio < pa.umbral_aprobacion
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
        nd.nota_promedio < pa.umbral_aprobacion
        or (100.0 * coalesce(dd.n_no, 0)) / nullif(dd.total, 0) >= pa.umbral_seguimiento_pct_no
    );

-- Los umbrales de pct_no (umbral_seguimiento_pct_no=30, umbral_critico_pct_no=45)
-- no cambian -- no tienen un concepto equivalente de "aprobado" al cual alinearse.
alter table politica_evaluacion
  drop constraint ck_politica_umbrales;

alter table politica_evaluacion
  drop column umbral_seguimiento_nota;

alter table politica_evaluacion
  add constraint ck_politica_umbrales
  check (umbral_aprobacion <= nota_maxima and umbral_seguimiento_pct_no <= umbral_critico_pct_no);

-- Ya aplicada contra el proyecto real (tqhqizvfehatfvmvwtsb) vía MCP el
-- 2026-08-04 (en dos pasos separados por la trampa del "select pol.*"
-- documentada arriba). Este archivo la deja versionada en el repo.
