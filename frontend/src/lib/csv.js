/* ===================== UTILIDADES DE NORMALIZACIÓN DE NOMBRES ==================== */
/* Ya no hay parseo de CSV (los datos vienen de GET /api/encuestas/consolidado,
   ver context/DataContext.jsx): lo que queda aquí son helpers de formato de
   nombres, usados para emparejar/mostrar docentes de forma consistente entre
   el roster (GET /api/docentes) y las filas del consolidado. */

export function stripAccents(str) {
  return String(str == null ? '' : str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function normKey(str) {
  return stripAccents(str).toLowerCase().replace(/\s+/g, ' ').trim();
}

/* ---- Nombres de docente (dataset con apellidos/nombres en columnas) ---- */

// Clave canónica de un docente para emparejar entre datasets (encuestas ↔ roster):
// sin acentos, minúsculas, sin comas y con espacios colapsados. Así el nombre de
// display "Vargas Merino, Jorge Alberto" y las columnas crudas "VARGAS MERINO
// JORGE ALBERTO" producen la misma clave.
export function docenteKey(str) {
  return stripAccents(str).toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
}

// Palabras de enlace que van en minúscula dentro de un nombre (salvo al inicio).
const NAME_MINOR_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'di', 'do', 'van', 'von', 'le']);

// Convierte un texto en MAYÚSCULAS a Title Case respetando enlaces y apóstrofes.
export function titleCaseName(str) {
  const s = String(str == null ? '' : str).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s
    .split(' ')
    .map((word, i) => {
      if (i > 0 && NAME_MINOR_WORDS.has(word)) return word;
      return word
        .replace(/^[\p{L}]/u, (c) => c.toUpperCase())
        .replace(/(['’´])([\p{L}])/u, (_, q, c) => q + c.toUpperCase());
    })
    .join(' ');
}

// Arma el nombre de display del docente: "Apellido Paterno Apellido Materno, Nombres".
export function buildDocenteName(apellidoPaterno, apellidoMaterno, nombres) {
  const apellidos = [apellidoPaterno, apellidoMaterno].map(titleCaseName).filter(Boolean).join(' ');
  const dados = titleCaseName(nombres);
  if (apellidos && dados) return `${apellidos}, ${dados}`;
  return apellidos || dados || '';
}

// Convierte un nombre "APELLIDOS, NOMBRES" en MAYÚSCULAS (como llega de
// v_docente_seccion_consolidada) al mismo formato Title Case que usaban antes
// las filas de dataset.csv, para mostrarlo consistente en toda la app.
export function titleCaseFullName(str) {
  return String(str == null ? '' : str).split(',').map((part) => titleCaseName(part.trim())).filter(Boolean).join(', ');
}
