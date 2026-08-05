-- Extiende fn_buscar_asignatura_similar (creada en la migración de fuzzy
-- matching de la carga presencial) para permitir búsqueda SIN acotar por
-- plan_estudios_id (p_plan_estudios_id = NULL) -- necesario para la
-- detección de contexto desde el nombre de archivo de encuestas virtuales
-- (ver backend/src/services/detectarContextoVirtual.js), donde todavía no
-- se sabe el programa/plan al momento de identificar cuál segmento del
-- nombre es el curso. Los llamadores existentes (resolverAsignatura en
-- importarEncuestas.js) siempre pasan un plan_estudios_id real, así que su
-- comportamiento no cambia.
CREATE OR REPLACE FUNCTION fn_buscar_asignatura_similar(
  p_plan_estudios_id bigint, p_clave text, p_umbral numeric DEFAULT 0.6, p_limite int DEFAULT 5
) RETURNS TABLE (id bigint, nombre text, similitud real)
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('SET LOCAL pg_trgm.similarity_threshold = %L', p_umbral);
  RETURN QUERY
    SELECT a.id, a.nombre, similarity(a.clave_busqueda, p_clave)
    FROM asignatura a
    WHERE (p_plan_estudios_id IS NULL OR a.plan_estudios_id = p_plan_estudios_id)
      AND a.clave_busqueda % p_clave
    ORDER BY similarity(a.clave_busqueda, p_clave) DESC
    LIMIT p_limite;
END;
$$;
