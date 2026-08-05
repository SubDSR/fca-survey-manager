-- Vista de detección: curso_grupo_docente sin respaldo en la carga oficial
-- (es_carga_oficial = false/NULL) que ya tiene encuestas asociadas. Trae todo
-- lo necesario para la notificación/modal de resolución sin queries
-- adicionales (docente, curso, programa, ciclo/sección, conteo y fecha más
-- antigua). Deliberadamente NO conoce revision_asignacion -- describe la
-- realidad actual de curso_grupo_docente/encuesta; la tabla de tracking se
-- consulta aparte y se combina en el controlador (ver GET /api/revisiones).
create or replace view v_asignaciones_sin_respaldo as
select
    cgd.id as curso_grupo_docente_id,
    cgd.docente_id,
    d.nombre_completo as docente,
    a.id as asignatura_id,
    a.nombre as curso,
    pr.id as programa_id,
    pr.nombre_corto as programa,
    g.ciclo,
    g.seccion,
    count(e.id) as n_encuestas,
    min(e.fecha_respuesta) as encuesta_mas_antigua
from curso_grupo_docente cgd
join docente d on d.id = cgd.docente_id
join curso_grupo cg on cg.id = cgd.curso_grupo_id
join asignatura a on a.id = cg.asignatura_id
join grupo g on g.id = cg.grupo_id
join programa pr on pr.id = g.programa_id
join encuesta e on e.curso_grupo_docente_id = cgd.id
where cgd.es_carga_oficial is not true
group by cgd.id, cgd.docente_id, d.nombre_completo, a.id, a.nombre, pr.id, pr.nombre_corto, g.ciclo, g.seccion;

-- Tabla de seguimiento/resolución de incidencias detectadas por la vista de
-- arriba. El índice único parcial evita duplicar una incidencia pendiente
-- para el mismo curso_grupo_docente_id (una nueva encuesta sobre la misma
-- asignación dispersa ya reportada no debe crear una segunda fila pendiente).
create table revision_asignacion (
  id bigint generated always as identity primary key,
  curso_grupo_docente_id bigint not null references curso_grupo_docente(id),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','reasignada','confirmada_correcta','descartada')),
  curso_grupo_docente_destino_id bigint references curso_grupo_docente(id),
  resuelto_por text,
  resuelto_en timestamptz,
  notas text,
  created_at timestamptz not null default now()
);
create unique index ux_revision_asignacion_cgd_pendiente
  on revision_asignacion (curso_grupo_docente_id) where estado = 'pendiente';

-- Backfill: incidencias que ya existen hoy en la BD (encuestas cargadas
-- antes de que existiera esta tabla) -- p. ej. el caso reportado de Tassara
-- Salviati, que resultó no ser aislado (35 curso_grupo_docente afectados al
-- momento de esta migración).
insert into revision_asignacion (curso_grupo_docente_id, estado)
select curso_grupo_docente_id, 'pendiente'
from v_asignaciones_sin_respaldo
on conflict (curso_grupo_docente_id) where estado = 'pendiente' do nothing;

-- Detección automática hacia adelante: cada nueva encuesta insertada contra
-- un curso_grupo_docente sin respaldo oficial abre (o reutiliza, si ya hay
-- una pendiente para ese mismo curso_grupo_docente_id) su incidencia.
-- AFTER INSERT porque solo interesa reaccionar al hecho ya consumado (fila
-- ya persistida), no validar/bloquear el insert de encuesta.
create or replace function fn_detectar_revision_asignacion() returns trigger as $$
begin
  if exists (
    select 1 from curso_grupo_docente cgd
    where cgd.id = new.curso_grupo_docente_id and cgd.es_carga_oficial is not true
  ) then
    insert into revision_asignacion (curso_grupo_docente_id, estado)
    values (new.curso_grupo_docente_id, 'pendiente')
    on conflict (curso_grupo_docente_id) where estado = 'pendiente' do nothing;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger tg_encuesta_detectar_revision
  after insert on encuesta
  for each row execute function fn_detectar_revision_asignacion();
