import { docenteKey } from '../lib/csv.js';

/* Roster de docentes. Provee, por docente:
   - categoria: la "Condición" (Nombrado / Nombrado - OF / Contratado)
   - facultad:  facultad de origen (relevante para los "Nombrado - OF")
   - grado, correo: metadatos adicionales disponibles (aún no mostrados en la UI).

   El emparejamiento con las filas de encuestas se hace por docenteKey(): una
   clave sin acentos/comas y en minúsculas, de modo que el nombre de display
   (dataset.csv, histórico) y el nombre_completo del backend coincidan. */

// Construye el mapa clave→info a partir de la lista de docentes que devuelve
// GET /api/docentes (ficha ya consolidada, sin necesidad de detectar columnas).
export function buildRosterFromApi(docentes) {
  const roster = new Map();
  (docentes || []).forEach((d) => {
    const key = docenteKey(d.nombre_completo);
    if (!key) return;
    roster.set(key, {
      id: d.id,
      nombreCompleto: d.nombre_completo,
      categoria: d.condicion || 'Sin categoría',
      facultad: d.facultad || null,
      grado: d.grado_academico || null,
      correo: d.correo_institucional || null,
      tienePortafolio: d.tiene_portafolio,
      registradoSunedu: d.registrado_sunedu,
    });
  });
  return roster;
}

// Enriquece cada fila de encuesta con la categoría, facultad e id del roster.
// El id (docenteId) es la clave para unir con las vistas de criterios/directivas
// del backend (GET /api/encuestas/criterios y /directivas), que identifican al
// docente por docente_id en vez de por nombre.
export function enrichRowsWithRoster(rows, roster) {
  return rows.map((row) => {
    const info = roster.get(docenteKey(row.docente));
    return {
      ...row,
      categoria: (info && info.categoria) || 'Sin categoría',
      facultad: (info && info.facultad) || null,
      docenteId: (info && info.id) ?? null,
    };
  });
}
