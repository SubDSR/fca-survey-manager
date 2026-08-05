-- Tabla de auditoría genérica -- propuesta original en
-- docs/plans/2026-08-04-modulo-configuracion-design.md, sección 3.3, nunca
-- aplicada hasta ahora. Se aplica en esta tarea porque la revisión de
-- asignaciones sin respaldo necesita dejar rastro de cada resolución
-- (revision_asignacion) y de cada reasignación de encuestas (UPDATE sobre
-- encuesta.curso_grupo_docente_id) -- se extiende también a docente/programa/
-- asignatura, que ya tenían CRUD sin auditoría desde la tarea anterior.
create table audit_log (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id bigint not null,
  accion text not null check (accion in ('INSERT','UPDATE','SUSPEND','REACTIVATE')),
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  usuario text,
  created_at timestamptz not null default now()
);
create index ix_audit_log_registro on audit_log (tabla, registro_id, created_at desc);
create index ix_audit_log_fecha on audit_log (created_at desc);

-- Genérica de verdad: usa jsonb en vez de OLD.activo/NEW.activo directo,
-- porque no todas las tablas cubiertas tienen columna `activo` (encuesta no
-- tiene ninguna; revision_asignacion tiene `estado`, no `activo`) -- acceder
-- a un campo inexistente vía NEW.campo revienta en tiempo de ejecución (la
-- fila NEW/OLD es de tipo record, resuelto por tabla real en cada disparo),
-- mientras que to_jsonb(NEW)->>'campo' simplemente da NULL si no existe.
--
-- Limitación conocida (documentada también en el diseño original): `usuario`
-- no tiene de dónde salir todavía -- el proyecto no tiene autenticación.
-- Queda NULL hasta que exista un sistema de login real.
create or replace function fn_audit_log() returns trigger as $$
declare
  v_old jsonb := case when TG_OP <> 'INSERT' then to_jsonb(OLD) end;
  v_new jsonb := case when TG_OP <> 'DELETE' then to_jsonb(NEW) end;
  v_accion text;
begin
  if TG_OP = 'INSERT' then
    v_accion := 'INSERT';
  elsif TG_OP = 'UPDATE' and (v_old->>'activo') = 'true' and (v_new->>'activo') = 'false' then
    v_accion := 'SUSPEND';
  elsif TG_OP = 'UPDATE' and (v_old->>'activo') = 'false' and (v_new->>'activo') = 'true' then
    v_accion := 'REACTIVATE';
  else
    v_accion := 'UPDATE';
  end if;

  insert into audit_log (tabla, registro_id, accion, datos_anteriores, datos_nuevos)
  values (
    TG_TABLE_NAME,
    coalesce((v_new->>'id')::bigint, (v_old->>'id')::bigint),
    v_accion, v_old, v_new
  );
  return new;
end;
$$ language plpgsql;

create trigger tg_docente_audit after insert or update on docente
  for each row execute function fn_audit_log();
create trigger tg_programa_audit after insert or update on programa
  for each row execute function fn_audit_log();
create trigger tg_asignatura_audit after insert or update on asignatura
  for each row execute function fn_audit_log();
create trigger tg_encuesta_audit after insert or update on encuesta
  for each row execute function fn_audit_log();
create trigger tg_revision_asignacion_audit after insert or update on revision_asignacion
  for each row execute function fn_audit_log();
