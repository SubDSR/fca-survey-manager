// Todas las llamadas al backend pasan por aquí.
// Nunca llames a Supabase directamente desde el frontend.
const BASE_URL = import.meta.env.VITE_API_URL;

// A diferencia de los métodos de solo-lectura de abajo (que asumen 200 y
// solo hacen r.json()), periodos/cargas tienen respuestas de error con
// significado propio para la UI (400/404/409/422) que hay que poder
// distinguir de un 200/201 sin lanzar una excepción genérica. request()
// devuelve siempre { ok, status, data } en vez de solo el body.
async function request(url, options) {
  const res = await fetch(url, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    // sin body (p. ej. algún 204 futuro) — data queda null
  }
  return { ok: res.ok, status: res.status, data };
}

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
  },
  periodos: {
    listar: () => request(`${BASE_URL}/api/periodos`),
    crear: (payload) => request(`${BASE_URL}/api/periodos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    activar: (id) => request(`${BASE_URL}/api/periodos/${id}/activar`, { method: 'PATCH' }),
    // 404 es una respuesta válida y esperada aquí (período sin campaña
    // abierta/borrador) — no es un error de red, la UI debe distinguirlo.
    campaniaActiva: (id) => request(`${BASE_URL}/api/periodos/${id}/campania-activa`),
  },
  cargas: {
    listar: (campaniaId) => request(`${BASE_URL}/api/cargas?campania_id=${campaniaId}`),
    subir: (periodoId, file) => {
      const formData = new FormData();
      formData.append('periodo_id', periodoId);
      formData.append('file', file);
      return request(`${BASE_URL}/api/cargas`, { method: 'POST', body: formData });
    },
    cambiarVisibilidad: (id, visible) => request(`${BASE_URL}/api/cargas/${id}/visibilidad`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible }),
    }),
    eliminar: (id) => request(`${BASE_URL}/api/cargas/${id}`, { method: 'DELETE' }),
  },
};
