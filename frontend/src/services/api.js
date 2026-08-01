// Todas las llamadas al backend pasan por aquí.
// Nunca llames a Supabase directamente desde el frontend.
const BASE_URL = import.meta.env.VITE_API_URL;

export const api = {
  docentes: {
    listar: () => fetch(`${BASE_URL}/api/docentes`).then(r => r.json()),
    obtener: (id) => fetch(`${BASE_URL}/api/docentes/${id}`).then(r => r.json()),
  },
  encuestas: {
    consolidado: () => fetch(`${BASE_URL}/api/encuestas/consolidado`).then(r => r.json()),
    seguimiento: () => fetch(`${BASE_URL}/api/encuestas/seguimiento`).then(r => r.json()),
    criterios: () => fetch(`${BASE_URL}/api/encuestas/criterios`).then(r => r.json()),
    directivas: () => fetch(`${BASE_URL}/api/encuestas/directivas`).then(r => r.json()),
    respuestas: (params = {}) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
      ).toString();
      return fetch(`${BASE_URL}/api/encuestas/respuestas${query ? `?${query}` : ''}`).then(r => r.json());
    },
  },
  programas: {
    listar: () => fetch(`${BASE_URL}/api/programas`).then(r => r.json()),
  }
};
