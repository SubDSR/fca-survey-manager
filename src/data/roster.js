import { normKey, docenteKey } from '../lib/csv.js';

/* Roster de docentes cargado desde public/docentes.csv (reemplaza los mapas
   antes hardcodeados de categoría y facultad). Provee, por docente:
   - categoria: la "Condición" (Nombrado / Nombrado - OF / Contratado)
   - facultad:  facultad de origen (relevante para los "Nombrado - OF")
   - grado, correo: metadatos adicionales disponibles (aún no mostrados en la UI).

   El emparejamiento con las filas de encuestas se hace por docenteKey(): una
   clave sin acentos/comas y en minúsculas, de modo que el nombre de display y
   las columnas crudas del CSV coinciden. */

// Busca en el header la primera columna cuyo nombre normalizado esté entre los alias.
function findCol(fields, aliases) {
  return fields.find((f) => aliases.includes(normKey(f)));
}

// Construye el mapa clave→info a partir de las filas parseadas de docentes.csv.
export function buildRoster(records, fields) {
  const cPaterno = findCol(fields, ['apellido paterno', 'ap paterno']);
  const cMaterno = findCol(fields, ['apellido materno', 'ap materno']);
  const cNombres = findCol(fields, ['nombres', 'nombre']);
  const cCondicion = findCol(fields, ['condicion', 'condición', 'categoria', 'categoría']);
  const cFacultad = findCol(fields, ['facultad']);
  const cGrado = findCol(fields, ['grado academico', 'grado académico', 'grado']);
  const cCorreo = findCol(fields, ['correo', 'email', 'e-mail']);

  const roster = new Map();
  records.forEach((r) => {
    const paterno = cPaterno ? r[cPaterno] : '';
    const materno = cMaterno ? r[cMaterno] : '';
    const nombres = cNombres ? r[cNombres] : '';
    const key = docenteKey(`${paterno || ''} ${materno || ''} ${nombres || ''}`);
    if (!key) return;
    roster.set(key, {
      categoria: (cCondicion && String(r[cCondicion] || '').trim()) || 'Sin categoría',
      facultad: (cFacultad && String(r[cFacultad] || '').trim()) || null,
      grado: (cGrado && String(r[cGrado] || '').trim()) || null,
      correo: (cCorreo && String(r[cCorreo] || '').trim()) || null,
    });
  });
  return roster;
}

// Enriquece cada fila de encuesta con la categoría y facultad del roster.
export function enrichRowsWithRoster(rows, roster) {
  return rows.map((row) => {
    const info = roster.get(docenteKey(row.docente));
    return {
      ...row,
      categoria: (info && info.categoria) || 'Sin categoría',
      facultad: (info && info.facultad) || null,
    };
  });
}
