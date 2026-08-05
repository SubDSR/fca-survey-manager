// Formatos de CSV compartidos entre CargaTab.jsx (plantillas, Bloque 3) y las
// páginas dedicadas de subida (SubirCsvPage.jsx / SubirVirtualPage.jsx) --
// evita declarar los mismos encabezados/CSV de ejemplo en varios archivos.

export const EXPECTED_HEADERS = ['Programa', 'Ciclo', 'Seccion', 'Aula', 'Codigo', 'Docente', 'Curso', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];

export const SAMPLE_CSV = `Programa,Ciclo,Seccion,Aula,Codigo,Docente,Curso,P1,P2,P3,P4,P5,P6,P7,P8,P9
Ing. de Sistemas,V,1,301,20201234,Perez Gomez Juan,Base de Datos II,4,5,4,5,5,4,5,4,5
Ing. de Sistemas,V,1,301,20201234,Perez Gomez Juan,Base de Datos II,3,4,4,3,4,4,3,4,4
`;

// Deben coincidir EXACTAMENTE con COLUMNAS_ESPERADAS_VIRTUAL en
// backend/src/services/importarEncuestasVirtual.js (columna → pregunta.id
// documentado ahí). Sin Programa/Docente/Curso/Ciclo/Sección: ese contexto
// se fija una sola vez en la UI (selector de contexto), no viaja por fila
// como en el CSV presencial.
export const EXPECTED_HEADERS_VIRTUAL = [
  'Respuesta número',
  'Calidad expositiva del docente',
  'Nivel de conocimiento del docente',
  'Capacidad del profesor para relacionar los objetivos del curso ofrecido',
  'Cumplimiento de los objetivos del curso ofrecido',
  'Satisfacción con la metodología de enseñanza aplicada por el docente',
  'Apreciación general del contenido en relación con sus expectativas',
  'Puntualidad y Cumplimiento de Horario del Docente',
  'Entrega del Sílabus en el Aula Virtual',
  'Entrega de notas',
  'Comentarios adicionales u observaciones sobre el desempeño del docente',
];

export const SAMPLE_CSV_VIRTUAL = `Respuesta número,Calidad expositiva del docente,Nivel de conocimiento del docente,Capacidad del profesor para relacionar los objetivos del curso ofrecido,Cumplimiento de los objetivos del curso ofrecido,Satisfacción con la metodología de enseñanza aplicada por el docente,Apreciación general del contenido en relación con sus expectativas,Puntualidad y Cumplimiento de Horario del Docente,Entrega del Sílabus en el Aula Virtual,Entrega de notas,Comentarios adicionales u observaciones sobre el desempeño del docente
1,9,10,9,10,9,10,Si,Si,A veces,Buen docente
2,8,9,8,9,8,9,Si,A veces,Si,
3,10,10,10,10,10,10,Si,Si,Si,Excelente curso
`;

// Split de una línea CSV respetando comillas (campos entre comillas pueden
// contener comas o comillas escapadas como ""). Necesario porque las
// exportaciones reales de encuestas virtuales (Google Forms/Sheets) citan
// TODAS las columnas — un split(',') ingenuo deja los encabezados como
// `"Respuesta número"` (comillas literales incluidas) y la validación de
// columnas esperadas falla contra el archivo real. trim() al final también
// limpia el BOM inicial (U+FEFF cuenta como whitespace para trim() en JS).
export function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

// Parsea un CSV completo (texto crudo) a un array de objetos {header: valor},
// respetando comillas. A diferencia de csv-parse (backend), esto es solo
// para la vista previa/resumen del lado del cliente -- el import real
// siempre se re-parsea en el servidor con csv-parse.
export function parseCsvToRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] !== undefined ? cells[i] : ''; });
    return row;
  });
  return { headers, rows };
}
