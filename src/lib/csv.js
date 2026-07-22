import { ID_FIELDS, ID_ALIASES, LABEL_MAP } from '../data/constants.js';

/* ===================== 2. UTILIDADES DE NORMALIZACIÓN ==================== */

export function stripAccents(str) {
  return String(str == null ? '' : str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function normKey(str) {
  return stripAccents(str).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function normalizeDirectiveValue(raw) {
  const k = normKey(raw).replace(/\s+/g, '');
  if (!k) return null;
  if (k.includes('aveces') || k.includes('avece')) return 'A veces';
  if (k === 'si' || k.startsWith('si')) return 'Sí';
  if (k === 'no' || k.startsWith('no')) return 'No';
  return null;
}

export function toNumberOrNull(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/* ==================== 3. CARGA Y PARSEO DE CSV ================ */

export function detectColumnRoles(fields, sampleRows) {
  const idMap = {};
  const usedFields = new Set();

  ID_FIELDS.forEach(canonicalKey => {
    const aliases = ID_ALIASES[canonicalKey];
    const found = fields.find(f => aliases.includes(normKey(f)));
    if (found) {
      idMap[canonicalKey] = found;
      usedFields.add(found);
    }
  });

  const remaining = fields.filter(f => !usedFields.has(f));
  const criteriaCols = [];
  const directiveCols = [];

  remaining.forEach(field => {
    let numericHits = 0, directiveHits = 0, total = 0;
    for (const row of sampleRows) {
      const val = row[field];
      if (val === undefined || val === null || String(val).trim() === '') continue;
      total++;
      if (normalizeDirectiveValue(val) !== null) directiveHits++;
      else if (toNumberOrNull(val) !== null) numericHits++;
    }
    if (total === 0) return;
    if (directiveHits / total >= 0.6) {
      directiveCols.push(field);
    } else if (numericHits / total >= 0.6) {
      criteriaCols.push(field);
    }
  });

  return {
    idMap,
    criteriaCols: criteriaCols.slice(0, 6),
    directiveCols: directiveCols.slice(0, 3)
  };
}

export function buildRowsFromCSV(data, fields) {
  const sample = data.slice(0, Math.min(50, data.length));
  const roles = detectColumnRoles(fields, sample);

  if (roles.criteriaCols.length < 6 || roles.directiveCols.length < 3) {
    return null;
  }

  const shortCriteriaLabels = roles.criteriaCols.map(c => {
    const k = String(c).toLowerCase().trim();
    return LABEL_MAP[k] ? k.toUpperCase() : c;
  });

  const criteriaLabels = roles.criteriaCols.map(c => LABEL_MAP[String(c).toLowerCase().trim()] || c);
  const directiveLabels = roles.directiveCols.map(c => LABEL_MAP[String(c).toLowerCase().trim()] || c);

  const rows = [];
  const excludedRows = [];
  data.forEach(raw => {
    const scores = roles.criteriaCols.map(col => toNumberOrNull(raw[col]));
    const validScores = scores.filter(s => s !== null);

    if (validScores.length === 0) {
      // Ninguna de las 6 preguntas fue respondida: no hay forma de calcular una nota, se excluye.
      excludedRows.push({
        programa: (roles.idMap.programa && raw[roles.idMap.programa]) || 'Sin programa',
        ciclo: (roles.idMap.ciclo && raw[roles.idMap.ciclo]) || 'Sin ciclo',
        seccion: (roles.idMap.seccion && raw[roles.idMap.seccion]) || 'Sin sección',
        aula: (roles.idMap.aula && raw[roles.idMap.aula]) || 'Sin aula',
        docente: (roles.idMap.docente && raw[roles.idMap.docente]) || 'Sin docente',
        curso: (roles.idMap.curso && raw[roles.idMap.curso]) || 'Sin curso',
        codigo: (roles.idMap.codigo && raw[roles.idMap.codigo]) || '',
        missing: roles.criteriaCols.filter((col, i) => scores[i] === null)
      });
      return;
    }

    const directivas = roles.directiveCols.map((col, idx) => ({
      label: directiveLabels[idx],
      value: normalizeDirectiveValue(raw[col])
    })).filter(d => d.value !== null);

    // Solo se promedian las preguntas SÍ respondidas; las vacías/null no se contabilizan.
    const promedio = validScores.reduce((a, b) => a + b, 0) / validScores.length;

    rows.push({
      programa: (roles.idMap.programa && raw[roles.idMap.programa]) || 'Sin programa',
      ciclo: (roles.idMap.ciclo && raw[roles.idMap.ciclo]) || 'Sin ciclo',
      seccion: (roles.idMap.seccion && raw[roles.idMap.seccion]) || 'Sin sección',
      aula: (roles.idMap.aula && raw[roles.idMap.aula]) || 'Sin aula',
      docente: (roles.idMap.docente && raw[roles.idMap.docente]) || 'Sin docente',
      curso: (roles.idMap.curso && raw[roles.idMap.curso]) || 'Sin curso',
      codigo: (roles.idMap.codigo && raw[roles.idMap.codigo]) || '',
      scores,
      notaFinal: Math.round(promedio * 2 * 10) / 10,
      directivas
    });
  });

  return { rows, criteriaLabels, directiveLabels, shortCriteriaLabels, totalParsed: data.length, excludedRows };
}
