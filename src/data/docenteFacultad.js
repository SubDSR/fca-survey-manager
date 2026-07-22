export const DOCENTE_FACULTAD_MAP = {
  'Collazos Paucar, Edwin': 'Contabilidad',
  'Farfán Muñoz, Ivar Rodrigo': 'Facultad de Ciencias Contables',
  'Olivares Taipe, Paulo César': 'Facultad de Ingeniería de Sistemas e Informática',
  'Pérez Palacios, Emma': 'Facultad de Ciencias Económicas',
  'Revolledo Novoa, Álvaro Arturo': 'Facultad de Derecho y Ciencia Política',
  'Vargas Salazar, Ivonne Yanete': 'Facultad de Educación',
};

export function normDocenteName(s) {
  return String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getDocenteFacultad(docenteName) {
  return DOCENTE_FACULTAD_MAP[normDocenteName(docenteName)] || null;
}
