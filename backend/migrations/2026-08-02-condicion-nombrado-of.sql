-- Corrige el catálogo condicion_docente: 'Nombrado - otra facultad' pasa
-- a 'Nombrado - OF', tal como aparece en frontend/public/docentes.csv
-- (fuente original de este dato) — en algún punto de la carga a la BD se
-- expandió a la forma larga.
--
-- Verificado antes de aplicar que nombre='Nombrado - otra facultad' solo
-- se usa para mostrarse tal cual en la UI (vía v_docente_ficha.condicion):
-- ninguna vista/reporte/PDF depende de que el texto sea la forma larga.
-- La decisión "es_otra_facultad" ya vive en su propia columna booleana,
-- independiente del texto.
--
-- De paso corrige dos bugs de estilo ya existentes, dormidos por este
-- mismo problema (ambos esperaban la forma corta "OF" para armar la
-- clase CSS del badge, y nunca coincidían con el texto largo):
--   - frontend/src/components/gestion/GestionView.jsx: getStatusClass()
--     revisa que el texto contenga "nombrado" Y "of" -- "otra facultad"
--     no contiene la subcadena "of", así que el badge especial
--     .nombradoOf nunca se aplicaba.
--   - frontend/src/components/docente/DocenteHeader.jsx +
--     data/constants.js (categoriaSlug): producía el slug
--     "nombrado-otra-facultad", que no coincide con la clase real
--     .nombrado-of definida en DocenteHeader.module.css.
--
-- Ya aplicado contra el proyecto real (tqhqizvfehatfvmvwtsb) vía MCP el
-- 2026-08-02. Este archivo lo deja versionado en el repo. Guardado por
-- el valor anterior exacto, así que re-correrlo es un no-op si ya se
-- aplicó.
update condicion_docente
set nombre = 'Nombrado - OF'
where codigo = 'NOMBRADO_OF'
  and nombre = 'Nombrado - otra facultad';
