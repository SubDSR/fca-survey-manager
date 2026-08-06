-- Bloquea DELETE /api/cargas/:id (y fn_eliminar_carga en general) pasados
-- 7 días desde carga_csv.fecha_carga -- una carga vieja probablemente ya
-- tiene reportes/decisiones tomadas sobre ella. La validación real vive
-- en el controlador (backend/src/controllers/cargas.js, eliminarCarga,
-- responde 403 ANTES de invocar esta función); esto es defensa en
-- profundidad, no la única barrera.
--
-- Por qué SÍ vale la pena la redundancia acá (y no "con el controlador
-- alcanza"): fn_eliminar_carga ya es invocable directo por RPC sin pasar
-- por el controlador -- confirmado en esta misma conversación: se llamó
-- fn_eliminar_carga() indirectamente vía DELETE /api/cargas/:id decenas
-- de veces durante las tareas de perfilado/verificación, pero también es
-- perfectamente invocable a mano desde el SQL Editor o el MCP (como se
-- hizo, por ejemplo, para depurar revision_asignacion en tareas
-- anteriores). El proyecto además ya tiene el mismo patrón en otro lado
-- (fn_valida_campania_abierta, trigger BEFORE INSERT en encuesta): las
-- invariantes que importan de verdad se protegen también a nivel de BD,
-- no solo en la capa HTTP. Costo de la duplicación: el plazo (7 días)
-- vive en dos lugares (PLAZO_ELIMINACION_DIAS en JS, interval '7 days'
-- acá) -- aceptable porque es una regla estable, no algo que vaya a
-- cambiar seguido; si cambia, es un grep de "7 d" en el repo, no una
-- migración de datos.
--
-- Aplicada contra el proyecto real (tqhqizvfehatfvmvwtsb) vía MCP el
-- 2026-08-06. Este archivo la deja versionada en el repo.

create or replace function fn_eliminar_carga(p_carga_id bigint)
returns table (respuestas_eliminadas bigint, encuestas_eliminadas bigint, encuestados_eliminados bigint)
language plpgsql
as $$
declare
  v_respuestas bigint;
  v_encuestas bigint;
  v_encuestados bigint;
  v_fecha_carga timestamptz;
begin
  -- Si p_carga_id no existe, v_fecha_carga queda NULL y el chequeo se
  -- salta -- el comportamiento ya establecido para un id inexistente
  -- (todos los DELETE de abajo son no-op, se devuelve 0/0/0) no cambia.
  select fecha_carga into v_fecha_carga from carga_csv where id = p_carga_id;

  if v_fecha_carga is not null and now() - v_fecha_carga > interval '7 days' then
    raise exception 'No se puede eliminar: han pasado más de 7 días desde la carga (fecha_carga: %).', v_fecha_carga
      using errcode = 'check_violation';
  end if;

  delete from respuesta
  where encuesta_id in (select id from encuesta where carga_id = p_carga_id);
  get diagnostics v_respuestas = row_count;

  delete from encuesta where carga_id = p_carga_id;
  get diagnostics v_encuestas = row_count;

  delete from encuestado where carga_id = p_carga_id;
  get diagnostics v_encuestados = row_count;

  perform fn_limpiar_revision_asignacion_huerfana();

  delete from carga_csv where id = p_carga_id;

  return query select v_respuestas, v_encuestas, v_encuestados;
end;
$$;

grant execute on function fn_eliminar_carga(bigint) to service_role;

comment on function fn_eliminar_carga(bigint) is
  'Borra en cascada (respuesta->encuesta->encuestado->carga_csv) solo lo que '
  'tenga carga_id = p_carga_id, y limpia (fn_limpiar_revision_asignacion_huerfana) '
  'cualquier revision_asignacion que haya quedado sin ninguna encuesta real '
  'detrás como consecuencia de este borrado. Rechaza (RAISE EXCEPTION) '
  'borrar una carga con más de 7 días desde fecha_carga -- defensa en '
  'profundidad, la validación principal vive en el controlador. '
  'LIMITACION heredada: fila con carga_id NULL (dato insertado sin pasar '
  'por el ETL, o previo a esta columna) es invisible para el borrado de '
  'encuesta/encuestado -- ver 2026-08-02-visibilidad-cargas.sql.';
