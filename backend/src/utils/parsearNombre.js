// "Vargas Merino, Jorge Alberto" -> { apellido_paterno, apellido_materno, nombres }
// Extraído de services/importarEncuestas.js (usado ahí para parsear el
// nombre de docente tal como viene en el CSV) para reutilizarlo también en
// el alta manual desde el panel de administración (controllers/docentes.js)
// sin reimplementar el mismo split.
export function parsearNombreDocente(nombreCsv) {
  const [apellidos, nombres] = nombreCsv.split(',').map((s) => s.trim());
  const [apellidoPaterno, ...restoApellidos] = (apellidos || '').split(/\s+/);
  return {
    apellido_paterno: apellidoPaterno || '',
    apellido_materno: restoApellidos.length ? restoApellidos.join(' ') : null,
    nombres: nombres || '',
  };
}
