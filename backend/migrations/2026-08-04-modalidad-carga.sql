-- Distingue cargas presenciales (CSV con Programa/Docente/Curso por fila) de
-- cargas virtuales (CSV sin esas columnas, contexto fijo elegido en la UI) —
-- ver services/importarEncuestasVirtual.js. Default 'presencial' para que
-- todas las cargas históricas (anteriores a este cambio) sigan clasificando
-- igual que antes sin necesidad de un backfill.
alter table carga_csv
  add column modalidad_carga text not null default 'presencial'
  check (modalidad_carga in ('presencial', 'virtual'));
