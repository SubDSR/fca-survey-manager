-- Fuzzy matching para la carga presencial (docente/asignatura por texto
-- libre en el CSV) -- ver docs/plans/2026-08-04-modulo-configuracion-design.md
-- sección 4. pg_trgm y los índices GIN (ix_docente_clave_busqueda_trgm,
-- ix_asignatura_busqueda_trgm) ya existían antes de esta migración.
--
-- Nota de implementación (confirmada al aplicar): las funciones deben ser
-- VOLATILE, no STABLE -- Postgres rechaza "SET" dentro de una función
-- STABLE/IMMUTABLE ("SET is not allowed in a non-volatile function"),
-- incluso en PLPGSQL. El SET LOCAL es, en efecto, un side-effect de sesión
-- aunque acotado a la transacción actual.

CREATE OR REPLACE FUNCTION fn_buscar_docente_similar(
  p_clave text, p_umbral numeric DEFAULT 0.6, p_limite int DEFAULT 5
) RETURNS TABLE (id bigint, nombre_completo text, similitud real)
LANGUAGE plpgsql AS $$
BEGIN
  -- SET LOCAL no acepta parámetros bind (no es una sentencia SQL normal) --
  -- se arma vía EXECUTE format(), único motivo por el que esta función es
  -- PLPGSQL y no SQL plana (una función SQL no puede intercalar EXECUTE).
  EXECUTE format('SET LOCAL pg_trgm.similarity_threshold = %L', p_umbral);
  RETURN QUERY
    SELECT d.id, d.nombre_completo, similarity(d.clave_busqueda, p_clave)
    FROM docente d
    WHERE d.clave_busqueda % p_clave
    ORDER BY similarity(d.clave_busqueda, p_clave) DESC
    LIMIT p_limite;
END;
$$;

CREATE OR REPLACE FUNCTION fn_buscar_asignatura_similar(
  p_plan_estudios_id bigint, p_clave text, p_umbral numeric DEFAULT 0.6, p_limite int DEFAULT 5
) RETURNS TABLE (id bigint, nombre text, similitud real)
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('SET LOCAL pg_trgm.similarity_threshold = %L', p_umbral);
  RETURN QUERY
    SELECT a.id, a.nombre, similarity(a.clave_busqueda, p_clave)
    FROM asignatura a
    WHERE a.plan_estudios_id = p_plan_estudios_id
      AND a.clave_busqueda % p_clave
    ORDER BY similarity(a.clave_busqueda, p_clave) DESC
    LIMIT p_limite;
END;
$$;

-- Filas de un CSV presencial cuyo docente/asignatura quedó en zona
-- ambigua (ver árbol de decisión, sección 4.4 del diseño): no se insertan
-- solas, se encolan acá hasta que un humano decida (usar un candidato,
-- crear nuevo, o descartar) -- ver POST /api/cargas/pendientes/:id/resolver.
CREATE TABLE carga_pendiente (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  carga_id bigint NOT NULL REFERENCES carga_csv(id) ON DELETE CASCADE,
  fila_numero int NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('docente','asignatura')),
  valor_csv text NOT NULL,
  fila_completa jsonb NOT NULL,
  candidatos jsonb NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','resuelta','descartada')),
  resuelto_como_id bigint,
  resuelto_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_carga_pendiente_carga ON carga_pendiente (carga_id) WHERE estado = 'pendiente';

-- Cuarto contador junto a filas_insertadas/filas_omitidas/filas_error --
-- a diferencia de esos tres (snapshot fijo al momento de la carga), este SÍ
-- se decrementa cuando un pendiente se resuelve/descarta (ver POST
-- .../resolver): refleja cuántos siguen esperando revisión AHORA, no
-- cuántos hubo alguna vez.
ALTER TABLE carga_csv ADD COLUMN filas_pendientes integer NOT NULL DEFAULT 0;
