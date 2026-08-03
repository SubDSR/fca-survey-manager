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

// fetch() NO rechaza en un 4xx/5xx — solo en fallas de red. Sin esto, un
// 500 con body { error: "..." } se resolvía igual que un 200, y ese objeto
// de error terminaba guardado como si fueran los datos reales (p. ej.
// criterios = { error: "..." } en vez de un array), reventando más tarde
// en cualquier .forEach()/.map() consumidor sin que el .catch() de quien
// llamó a este método se enterara nunca. fetchJson() sí rechaza en ese
// caso, para que los .catch() ya existentes en toda la app (DataContext,
// GestionView, CursoView, DocenteView, etc.) funcionen como se espera.
async function fetchJson(url) {
  const res = await fetch(url);
  let data = null;
  try {
    data = await res.json();
  } catch {
    // sin body parseable
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Error ${res.status} al llamar ${url}`);
  }
  return data;
}

export const api = {
  docentes: {
    listar: () => fetchJson(`${BASE_URL}/api/docentes`),
    obtener: (id) => fetchJson(`${BASE_URL}/api/docentes/${id}`),
  },
  encuestas: {
    consolidado: () => fetchJson(`${BASE_URL}/api/encuestas/consolidado`),
    seguimiento: () => fetchJson(`${BASE_URL}/api/encuestas/seguimiento`),
    criterios: () => fetchJson(`${BASE_URL}/api/encuestas/criterios`),
    directivas: () => fetchJson(`${BASE_URL}/api/encuestas/directivas`),
    respuestas: (params = {}) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
      ).toString();
      return fetchJson(`${BASE_URL}/api/encuestas/respuestas${query ? `?${query}` : ''}`);
    },
  },
  programas: {
    listar: () => fetchJson(`${BASE_URL}/api/programas`),
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
