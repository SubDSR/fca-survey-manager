import { cicloSortValue } from './chartConfigs.js';

/* dataset.csv trae el ciclo en romanos ("V") y no conoce asignatura_id/grupo_id;
   GET /api/encuestas/consolidado sí los trae. Se arma un índice
   docenteId+ciclo+seccion -> {asignaturaId, grupoId} para poder enriquecer las
   filas del CSV y unirlas con precisión a las vistas de criterios/directivas
   (ver lib/statsFromViews.js), igual que ya se hace con `groupRows` (consolidado). */

function seccionKey(docenteId, ciclo, seccion) {
  return `${docenteId}|${cicloSortValue(ciclo)}|${seccion}`;
}

export function buildSeccionIndex(consolidadoRows) {
  const index = new Map();
  consolidadoRows.forEach((c) => {
    index.set(seccionKey(c.docente_id, c.ciclo, c.seccion), {
      asignaturaId: c.asignatura_id,
      grupoId: c.grupo_id,
    });
  });
  return index;
}

// Requiere que `row.docenteId` ya esté seteado (ver data/roster.js#enrichRowsWithRoster).
export function enrichRowsWithSeccionIds(rows, index) {
  return rows.map((row) => {
    const info = index.get(seccionKey(row.docenteId, row.ciclo, row.seccion));
    return {
      ...row,
      asignaturaId: info ? info.asignaturaId : null,
      grupoId: info ? info.grupoId : null,
    };
  });
}
