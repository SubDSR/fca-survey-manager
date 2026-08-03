-- En un proyecto Supabase nuevo, service_role NO recibe automáticamente
-- ALL PRIVILEGES en las tablas si el bootstrap estándar del dashboard no se
-- ejecutó (o fue revocado) — este proyecto es un caso así: al conectar el
-- backend real (vía PostgREST, no vía la conexión privilegiada del MCP/SQL
-- Editor), toda operación fallaba con "permission denied for table X",
-- incluso para tablas tan básicas como periodo_academico o docente. Sin
-- este archivo, cualquiera que reproduzca este esquema desde cero (otro
-- ambiente, un colaborador nuevo) se topa con el mismo error, sin ninguna
-- pista de la causa — el error de Postgres no distingue "no tienes permiso"
-- de "la tabla no existe" de forma obvia para alguien que no lo haya
-- depurado antes.
--
-- Ya aplicado contra el proyecto real (tqhqizvfehatfvmvwtsb) vía MCP el
-- 2026-08-02. Este archivo lo deja versionado en el repo.

-- 1. service_role necesita el set completo de privilegios (SELECT, INSERT,
--    UPDATE, DELETE, ...) sobre TODAS las tablas de public, no solo las que
--    existían al momento de este fix: el ALTER DEFAULT PRIVILEGES asegura
--    que las tablas creadas por migraciones futuras hereden esto
--    automáticamente, sin tener que repetir este GRANT cada vez.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- 2. staging es de solo lectura para el backend (catálogos como
--    map_programa, usados por el ETL de carga de encuestas vía
--    supabase.schema('staging')). service_role no tenía ni USAGE sobre el
--    schema, lo que hacía fallar la resolución de programa_id en silencio
--    (el Promise.all de cargarCatalogos() descartaba el error hasta que se
--    corrigió aparte). Deliberadamente NO se otorga INSERT/UPDATE/DELETE
--    aquí: staging no debe ser escribible desde el backend de la app.
grant usage on schema staging to service_role;
grant select on staging.map_programa to service_role;
