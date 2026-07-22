export const ID_FIELDS = [
  'programa', 'ciclo', 'seccion', 'aula', 'docente',
  'apellidoPaterno', 'apellidoMaterno', 'nombres', 'curso', 'codigo',
];

export const ID_ALIASES = {
  programa: ['programa'],
  ciclo: ['ciclo'],
  seccion: ['seccion', 'sección', 'grupo'],
  aula: ['aula', 'salon', 'salón'],
  docente: ['docente', 'profesor', 'docentes', 'profesora'],
  // Dataset con el nombre del docente separado en columnas (formato nuevo).
  apellidoPaterno: ['apellido paterno', 'ap paterno', 'apellido 1'],
  apellidoMaterno: ['apellido materno', 'ap materno', 'apellido 2'],
  nombres: ['nombres', 'nombre'],
  curso: ['curso', 'asignatura', 'materia'],
  codigo: ['codigo', 'código', 'cod. encuesta', 'codigo encuesta'],
};

export const LABEL_MAP = {
  p1: 'Calidad expositiva del docente',
  p2: 'Nivel de conocimiento del docente',
  p3: 'Capacidad del profesor para relacionar los objetivos del curso ofrecido',
  p4: 'Cumplimiento de los objetivos del curso ofrecido',
  p5: 'Satisfacción con la metodología de enseñanza aplicada por el docente',
  p6: 'Apreciación general del contenido en relación con sus expectativas',
  p7: 'Puntualidad y Asistencia del Docente',
  p8: 'Entrega del Sílabus en el Aula Virtual',
  p9: 'Disponibilidad Anticipada del Material del Curso',
};

export const CATEGORIA_ORDER = ['Nombrado', 'Nombrado - OF', 'Contratado'];

// Slug de la categoría para el nombre de clase CSS de la píldora (Docente).
export function categoriaSlug(categoria) {
  return String(categoria || '').toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, '-');
}
