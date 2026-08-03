// Réplica EXACTA de las funciones SQL reales del proyecto (confirmadas vía
// MCP de Supabase, schema public), para que el matching de docentes/cursos
// en cargas nuevas sea idéntico al que ya generó los datos existentes.

// Réplica de public.fn_normaliza_texto(p_texto):
//   select nullif(btrim(regexp_replace(lower(translate(p_texto, FROM, TO)), '\s+', ' ', 'g')), '');
const DESDE = 'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ';
const HACIA = 'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC';

export function normalizarTexto(texto) {
  if (texto === null || texto === undefined) return null;
  let out = String(texto)
    .split('')
    .map((ch) => {
      const idx = DESDE.indexOf(ch);
      return idx >= 0 ? HACIA[idx] : ch;
    })
    .join('');
  out = out.toLowerCase().replace(/\s+/g, ' ').trim();
  return out === '' ? null : out;
}

// Réplica de public.fn_clave_carga(p_docente):
//   select fn_normaliza_texto(replace(coalesce(p_docente,''), ',', ' '));
// Usada para matchear el nombre de docente tal como viene en el CSV
// ("Apellidos, Nombres") contra docente.clave_busqueda.
export function claveCarga(docenteCsv) {
  return normalizarTexto(String(docenteCsv || '').replace(/,/g, ' '));
}

// Réplica de public.fn_ciclo_desde_romano(p_romano):
//   array_position(['I','II','III','IV','V','VI','VII','VIII','IX','X'], upper(btrim(p_romano)))
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function cicloDesdeRomano(romano) {
  const idx = ROMANOS.indexOf(String(romano || '').trim().toUpperCase());
  return idx >= 0 ? idx + 1 : null;
}
