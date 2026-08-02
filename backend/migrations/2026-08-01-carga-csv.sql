-- Migración corregida: SOLO agrega el registro de cargas de CSV.
-- periodo_academico y campania_evaluacion YA EXISTEN con su propio diseño —
-- no se tocan. Ejecutar en el SQL Editor de Supabase.

create table if not exists carga_csv (
  id bigint generated always as identity primary key,
  campania_id smallint not null references campania_evaluacion(id),
  archivo_nombre text not null,
  filas_leidas integer not null default 0,
  filas_insertadas integer not null default 0,
  filas_omitidas integer not null default 0,   -- ya existían (duplicado seguro), no error
  filas_error integer not null default 0,
  errores jsonb,                 -- detalle de filas que fallaron, para diagnóstico
  omitidas jsonb,                 -- detalle de filas duplicadas que se saltaron
  estado text not null default 'procesando'
    check (estado in ('procesando', 'completado', 'completado_con_errores', 'error')),
  mensaje_error text,
  fecha_carga timestamptz not null default now()
);

create index if not exists idx_carga_csv_campania
  on carga_csv (campania_id);
