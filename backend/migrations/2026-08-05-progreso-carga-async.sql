-- Carga asíncrona con progreso visible (ver investigación de lentitud de
-- importarFilasCsv): el backend ahora responde de inmediato al subir un CSV
-- y sigue procesando en background. filas_procesadas permite que el
-- frontend haga polling a GET /api/cargas/:id y muestre "X de Y filas
-- procesadas" mientras estado='procesando', sin depender de que la
-- conexión HTTP original siga abierta.
alter table carga_csv
  add column if not exists filas_procesadas integer not null default 0;
