-- Fix de seguridad crítico (ver docs/db-schema-2026-08-06.md, Parte 3):
-- audit_log, carga_pendiente y revision_asignacion se crearon (migraciones
-- 2026-08-04-audit-log.sql, 2026-08-05-fuzzy-matching-carga-csv.sql,
-- 2026-08-04-revision-asignacion.sql) sin ENABLE ROW LEVEL SECURITY, a
-- diferencia de las otras 34 tablas de public. Resultado confirmado por el
-- advisor de seguridad de Supabase (nivel critical, vía MCP list_tables):
-- lectura y escritura SIN restricción para anon/authenticated -- cualquiera
-- con la clave pública del proyecto podía leer o modificar estas 3 tablas.
-- A diferencia de carga_csv (la única excepción documentada a propósito
-- desde el 2026-08-02), nadie decidió esto conscientemente para estas 3 --
-- se copió el patrón de crear tabla+índices+trigger sin el paso de RLS.
--
-- Se replica exactamente el patrón que ya usan las otras 34 tablas
-- (confirmado con pg_policies antes de escribir esto, no reescrito de
-- memoria): política p_lectura_autenticados, PERMISSIVE, SELECT, rol
-- authenticated, condición true, sin USING/WITH CHECK adicional.
--
-- Por qué esto no afecta al backend: service_role tiene rolbypassrls=true
-- (confirmado vía pg_roles) -- activar RLS en una tabla no cambia en nada
-- su acceso, con o sin políticas. El único efecto real es que anon/
-- authenticated (los roles que sí respetan RLS) dejan de poder escribir
-- (RLS activo sin política de INSERT/UPDATE/DELETE = denegado por
-- defecto) y solo pueden leer, igual que en el resto del esquema.
--
-- Aplicada contra el proyecto real (tqhqizvfehatfvmvwtsb) vía MCP el
-- 2026-08-06. Este archivo la deja versionada en el repo.

alter table audit_log enable row level security;
alter table carga_pendiente enable row level security;
alter table revision_asignacion enable row level security;

create policy p_lectura_autenticados on audit_log
  for select to authenticated using (true);
create policy p_lectura_autenticados on carga_pendiente
  for select to authenticated using (true);
create policy p_lectura_autenticados on revision_asignacion
  for select to authenticated using (true);
