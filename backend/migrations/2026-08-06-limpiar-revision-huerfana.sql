-- fn_eliminar_carga borraba respuesta->encuesta->encuestado->carga_csv en
-- cascada, pero nunca tocaba revision_asignacion -- que no está carga_id-
-- scoped (referencia curso_grupo_docente_id, dato de catálogo permanente).
-- Si una carga disparó fn_detectar_revision_asignacion() (creó una
-- incidencia 'pendiente') y esa carga se elimina después, la incidencia
-- queda huérfana: sin ninguna encuesta real detrás, invisible para GET
-- /api/revisiones?estado=pendiente (se filtra al cruzar con
-- v_asignaciones_sin_respaldo, que ya no le encuentra fila) pero presente
-- para siempre en la tabla. Encontrado en vivo (id=147) durante la
-- auditoría de schema del 2026-08-06 y limpiado a mano esa vez puntual --
-- esta migración corrige la causa, no solo el síntoma.
--
-- ENFOQUE ELEGIDO: barrido genérico (fn_limpiar_revision_asignacion_huerfana),
-- no el cálculo de "¿este curso_grupo_docente_id era EXCLUSIVO de la carga
-- que se está borrando?" dentro de fn_eliminar_carga.
--
-- Por qué: la condición correcta de "esta incidencia ya no describe nada"
-- es la MISMA sin importar el estado ni qué carga la originó -- "ninguna
-- encuesta, de NINGUNA carga, sigue referenciando ni su origen ni su
-- destino" -- y esa condición no necesita saber qué carga se acaba de
-- borrar para evaluarse correctamente. Calcular "exclusividad a esta
-- carga" en el momento del borrado exigiría capturar el set de
-- curso_grupo_docente_id ANTES de borrar encuesta y luego decidir por
-- cada uno si alguna OTRA carga todavía lo usa -- lógicamente equivalente
-- a "¿tiene 0 encuestas después de borrar?", pero con más superficie para
-- un error de orden de operaciones. El barrido genérico evalúa el estado
-- real de la tabla después del borrado, no una reconstrucción de qué
-- pertenecía a quién -- más simple de verificar como correcto, y además
-- reutilizable fuera del contexto de borrar una carga específica (une
-- ambos casos del pedido: "arregla fn_eliminar_carga" y "función/query
-- que en cualquier momento limpie" son la misma función).
--
-- CASO QUE ESTO PRESERVA A PROPÓSITO (verificado con el caso real
-- Tassara, revision_asignacion.id=15): una incidencia 'reasignada' tiene
-- su origen con 0 encuestas SIEMPRE (el UPDATE de encuesta.curso_grupo_docente_id
-- ya las movió todas al destino) -- eso es el estado ESPERADO tras
-- reasignar, no una señal de huérfano. La condición de abajo por eso
-- exige que el DESTINO también esté vacío antes de borrar -- si el
-- destino sigue teniendo encuestas de cualquier carga (incluida una
-- carga totalmente distinta a la que originó la incidencia), la fila
-- sobrevive.
--
-- Aplicada contra el proyecto real (tqhqizvfehatfvmvwtsb) vía MCP el
-- 2026-08-06. Este archivo la deja versionada en el repo.

create or replace function fn_limpiar_revision_asignacion_huerfana()
returns bigint
language plpgsql
as $$
declare
  v_eliminadas bigint;
begin
  delete from revision_asignacion ra
  where not exists (
      select 1 from encuesta e where e.curso_grupo_docente_id = ra.curso_grupo_docente_id
    )
    and (
      ra.curso_grupo_docente_destino_id is null
      or not exists (
        select 1 from encuesta e where e.curso_grupo_docente_id = ra.curso_grupo_docente_destino_id
      )
    );
  get diagnostics v_eliminadas = row_count;
  return v_eliminadas;
end;
$$;

grant execute on function fn_limpiar_revision_asignacion_huerfana() to service_role;

comment on function fn_limpiar_revision_asignacion_huerfana() is
  'Borra revision_asignacion cuyo origen y (si tiene) destino ya no tienen '
  'ninguna encuesta real. Invocada automáticamente por fn_eliminar_carga; '
  'también invocable a mano/periódicamente como barrido general.';

-- fn_eliminar_carga: mismo contrato de retorno de siempre (3 columnas,
-- ningún cambio para el controlador que la llama vía .rpc()) -- la
-- limpieza de revision_asignacion es un efecto interno, no se expone como
-- un 4to contador para no romper el shape que ya consume
-- backend/src/controllers/cargas.js.
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

  -- Después de borrar encuesta (para que "ya no queda ninguna encuesta
  -- apuntando a este cgd" refleje la realidad post-borrado) y antes de
  -- borrar carga_csv (sin relación con el orden, solo por claridad).
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
  'detrás como consecuencia de este borrado. LIMITACION heredada: fila con '
  'carga_id NULL (dato insertado sin pasar por el ETL, o previo a esta '
  'columna) es invisible para el borrado de encuesta/encuestado -- ver '
  '2026-08-02-visibilidad-cargas.sql.';
