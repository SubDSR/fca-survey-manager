-- Migración: cada carga de CSV pasa a "ser dueña" de sus propios encuestados
-- (ya no se comparten por código entre archivos distintos — el código de
-- encuesta física no es un identificador confiable en encuestas virtuales,
-- donde puede repetirse entre estudiantes distintos o no existir). A cambio,
-- se agrega la capacidad de ocultar/eliminar una carga completa.
--
-- Ya aplicada contra el proyecto real (tqhqizvfehatfvmvwtsb) vía MCP el
-- 2026-08-02. Este archivo la deja versionada en el repo.

-- 1. encuestado pasa a pertenecer a una carga específica (nullable: las
--    1841 filas ya existentes de dataset.csv no tienen carga_csv asociada,
--    y se tratan como "carga heredada" siempre visible, no gestionable
--    desde esta UI).
alter table encuestado
  add column if not exists carga_id bigint references carga_csv(id);

create index if not exists idx_encuestado_carga on encuestado (carga_id);

-- 2. encuesta también guarda carga_id de forma denormalizada (copiado de
--    encuestado.carga_id al insertar), para que las vistas de reportes
--    puedan filtrar sin tener que hacer join extra contra encuestado.
alter table encuesta
  add column if not exists carga_id bigint references carga_csv(id);

create index if not exists idx_encuesta_carga on encuesta (carga_id);

-- 3. carga_csv gana estado de visibilidad y guarda advertencias (además de
--    errores/omitidas que ya tenía) — para el caso de es_carga_oficial
--    resuelto por heurística, que merece revisión humana sin bloquear la
--    carga.
alter table carga_csv
  add column if not exists visible boolean not null default true,
  add column if not exists advertencias jsonb;

-- 4. Función atómica para eliminar una carga completa en cascada.
--    Se usa en vez de varios DELETE sueltos desde el backend para
--    garantizar que la operación es todo-o-nada (una sola transacción).
--
--    LIMITACIÓN DESCUBIERTA EL 2026-08-02 (no una hipótesis, un caso real
--    que ocurrió): esta función solo puede borrar lo que tenga carga_id
--    poblado — filtra explícitamente por "where carga_id = p_carga_id".
--    Cualquier fila de encuesta/encuestado insertada SIN pasar por este
--    ETL (una corrección manual, otro script, un import paralelo, o —
--    como pasó hoy — una carga procesada ANTES de que existiera esta
--    columna) queda con carga_id NULL, y es invisible para esta función:
--    borrar su carga_csv asociada (si la tiene) elimina el registro de
--    auditoría pero NO esas filas, que sobreviven indistinguibles de
--    dato heredado legítimo ("carga_id IS NULL" = "carga heredada,
--    siempre visible" es justamente la regla que las vistas de reportes
--    usan para no ocultarlas) — sin ningún error visible que lo delate.
--    Si algún día se vuelve a insertar directo en la BD por fuera del
--    backend, hay que poblar carga_id manualmente en esa inserción, o
--    aceptar que esas filas ya no podrán limpiarse por esta vía y habrá
--    que identificarlas y borrarlas a mano (como se hizo el 2026-08-02
--    con la encuesta huérfana que dejó la carga id=1, previa a esta
--    migración).
create or replace function fn_eliminar_carga(p_carga_id bigint)
returns table (respuestas_eliminadas bigint, encuestas_eliminadas bigint, encuestados_eliminados bigint)
language plpgsql
as $$
declare
  v_respuestas bigint;
  v_encuestas bigint;
  v_encuestados bigint;
begin
  delete from respuesta
  where encuesta_id in (select id from encuesta where carga_id = p_carga_id);
  get diagnostics v_respuestas = row_count;

  delete from encuesta where carga_id = p_carga_id;
  get diagnostics v_encuestas = row_count;

  delete from encuestado where carga_id = p_carga_id;
  get diagnostics v_encuestados = row_count;

  delete from carga_csv where id = p_carga_id;

  return query select v_respuestas, v_encuestas, v_encuestados;
end;
$$;

grant execute on function fn_eliminar_carga(bigint) to service_role;

comment on function fn_eliminar_carga(bigint) is
  'Borra en cascada (respuesta->encuesta->encuestado->carga_csv) solo lo que '
  'tenga carga_id = p_carga_id. LIMITACION: fila con carga_id NULL (dato '
  'insertado sin pasar por el ETL, o previo a esta columna) es invisible '
  'para esta funcion y queda indistinguible de carga heredada legitima. '
  'Ver comentario completo junto a la definicion en '
  '2026-08-02-visibilidad-cargas.sql.';

-- NOTA: fn_eliminar_carga() siempre devuelve una fila (aunque p_carga_id no
-- exista, sus DELETE simplemente no afectan nada) — el controlador
-- (src/controllers/cargas.js) verifica la existencia de la carga ANTES de
-- llamar a esta función, para poder responder 404 correctamente.
