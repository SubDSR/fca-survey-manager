export function matchDocentes(rows, query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set();
  for (const r of rows) {
    if (!seen.has(r.docente) && r.docente.toLowerCase().includes(q)) {
      seen.add(r.docente);
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, 'es')).slice(0, limit);
}
