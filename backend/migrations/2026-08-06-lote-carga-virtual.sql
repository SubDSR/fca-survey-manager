-- Carga de encuestas virtuales por lote (ZIP): un solo ZIP puede traer
-- varios CSV virtuales (mismo formato que ya procesa importarEncuestasVirtual,
-- uno a la vez) -- cada CSV interno sigue generando su propia fila de
-- carga_csv (mismo pipeline, sin cambios), pero todas comparten un lote_id
-- para que el frontend las agrupe en el historial y calcule el progreso
-- "archivo X de N" contando cuántas de esas filas ya llegaron a un estado
-- final.
--
-- Aplicado contra el proyecto real (tqhqizvfehatfvmvwtsb) vía MCP el
-- 2026-08-06. Este archivo lo deja versionado en el repo.

alter table carga_csv add column if not exists lote_id uuid;
alter table carga_csv add column if not exists nombre_lote text;

-- Motivo por el que un archivo del lote quedó en 'pendiente_revision' (ver
-- abajo) -- deliberadamente una columna aparte de mensaje_error: no es lo
-- mismo "el archivo está mal" (mensaje_error, CSV corrupto o con columnas
-- faltantes) que "el archivo es válido pero detectarContextoVirtual no
-- alcanzó confianza suficiente para el docente/curso y necesita que un
-- humano lo resuelva subiéndolo de nuevo por separado" (motivo_pendiente).
-- Mezclar ambos en un solo campo le haría perder al frontend (y a quien
-- lea el historial) la distinción que la propia carga de lotes necesita
-- para no bloquear el resto del ZIP por una sola detección dudosa.
alter table carga_csv add column if not exists motivo_pendiente text;

-- 'pendiente_revision': solo alcanzable desde una carga de lote (ver
-- subirLoteVirtual/procesarLoteVirtualEnBackground en cargas.js) -- el CSV
-- es válido (columnas correctas, se pudo parsear) pero detectarContextoVirtual
-- no resolvió un curso_grupo_docente con confianza suficiente. No se inserta
-- ninguna fila (encuesta/respuesta) para este archivo -- queda tal cual
-- para que el usuario lo resuelva subiéndolo de nuevo individualmente por
-- /configuracion/carga/subir-virtual (mismo selector manual "Editar datos"
-- que ya existe ahí).
alter table carga_csv drop constraint if exists carga_csv_estado_check;
alter table carga_csv add constraint carga_csv_estado_check
  check (estado in ('procesando', 'completado', 'completado_con_errores', 'error', 'pendiente_revision'));

create index if not exists idx_carga_csv_lote_id on carga_csv (lote_id) where lote_id is not null;
