/* ============ SECCIONES DE ORIGEN DE UN GRUPO CONSOLIDADO ============ */
/* Un grupo de GET /api/encuestas/consolidado puede juntar varias secciones
   dispersas bajo un único grupo_id "oficial" (secciones_origen, p. ej.
   "3-5, 4-6"). Las vistas de detalle (v_respuesta_detalle,
   v_promedio_por_criterio, v_encuesta_directivas) NO conocen ese grupo_id
   oficial: cada fila sigue identificada por SU PROPIO grupo_id físico (el de
   la sección dispersa), aunque sí traen ciclo+sección. Filtrar esas vistas
   por el grupo_id oficial deja fuera las secciones dispersas -- hay que
   comparar docente_id+asignatura_id+ciclo+sección contra los pares que trae
   secciones_origen, que sí incluye TODAS las secciones que aportan al grupo
   (la oficial y las dispersas). */

// "3-5, 4-6" -> [{ ciclo: 3, seccion: 5 }, { ciclo: 4, seccion: 6 }]
export function parseSeccionesOrigen(seccionesOrigen) {
  if (!seccionesOrigen) return [];
  return String(seccionesOrigen)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [ciclo, seccion] = s.split('-').map((n) => Number(n.trim()));
      return { ciclo, seccion };
    })
    .filter((p) => Number.isFinite(p.ciclo) && Number.isFinite(p.seccion));
}

export function matchKey(docenteId, asignaturaId, ciclo, seccion) {
  return `${docenteId}|${asignaturaId}|${ciclo}|${seccion}`;
}

// Claves docenteId+asignaturaId+ciclo+sección de TODAS las secciones de
// origen de cada fila de `rows` (filas de lib/directorGroups.js, con
// .seccionesOrigen).
export function keysFromRows(rows) {
  const keys = new Set();
  rows.forEach((r) => {
    parseSeccionesOrigen(r.seccionesOrigen).forEach(({ ciclo, seccion }) => {
      keys.add(matchKey(r.docenteId, r.asignaturaId, ciclo, seccion));
    });
  });
  return keys;
}
