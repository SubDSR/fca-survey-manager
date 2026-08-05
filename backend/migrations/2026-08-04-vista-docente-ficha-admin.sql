-- El tab administrativo "Docentes" (docs/plans/2026-08-04-modulo-configuracion-design.md,
-- sección 3) necesita, en la MISMA fila que ya usa el listado público
-- (GET /api/docentes -> v_docente_ficha):
--   - d.activo, para mostrar/filtrar el estado suspendido/activo.
--   - Los ids crudos de FK (condicion_docente_id, facultad_id, categoria_docente_id,
--     grado_academico_id, tipo_documento_id, pais_id), para poder precargar los
--     <select> del formulario de edición sin una segunda consulta — la vista
--     hoy solo expone los NOMBRES ya unidos (tipo_documento, facultad, condicion,
--     etc.), útiles para mostrar pero no para saber qué opción viene
--     seleccionada en un <select>.
--
-- Cambio puramente aditivo: se agregan columnas al FINAL del SELECT, ninguna
-- columna existente se renombra/mueve/quita. CREATE OR REPLACE VIEW exige
-- exactamente esto para no romper a nadie que ya dependa del shape actual
-- (buildRosterFromApi en el frontend lee campos por nombre, no por posición,
-- así que ganar columnas nuevas es inocuo para él).
--
-- Aplicada contra el proyecto real (tqhqizvfehatfvmvwtsb) vía MCP el 2026-08-04.

create or replace view v_docente_ficha as
select
    d.id,
    d.nombre_completo,
    d.numero_documento,
    d.codigo_docente,
    td.nombre as tipo_documento,
    f.nombre as facultad,
    cd.nombre as condicion,
    cd.es_otra_facultad,
    cat.nombre as categoria_carrera,
    ga.nombre as grado_academico,
    d.correo_institucional,
    d.tiene_portafolio,
    d.registrado_sunedu,
    d.sunedu_r1,
    d.en_roster_encuestas,
    d.enriquecido_padron,
    (select count(*) from curso_grupo_docente x where x.docente_id = d.id) as cursos_asignados,
    d.activo,
    d.tipo_documento_id,
    d.facultad_id,
    d.condicion_docente_id,
    d.categoria_docente_id,
    d.grado_academico_id,
    d.pais_id
from docente d
left join tipo_documento td on td.id = d.tipo_documento_id
left join facultad f on f.id = d.facultad_id
left join condicion_docente cd on cd.id = d.condicion_docente_id
left join categoria_docente cat on cat.id = d.categoria_docente_id
left join grado_academico ga on ga.id = d.grado_academico_id;
