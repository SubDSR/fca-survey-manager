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
    listar: (params = {}) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      ).toString();
      return fetchJson(`${BASE_URL}/api/docentes${query ? `?${query}` : ''}`);
    },
    obtener: (id) => fetchJson(`${BASE_URL}/api/docentes/${id}`),
    catalogos: () => fetchJson(`${BASE_URL}/api/docentes/catalogos`),
    crear: (payload) => request(`${BASE_URL}/api/docentes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    actualizar: (id, payload) => request(`${BASE_URL}/api/docentes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    cambiarActivo: (id, activo) => request(`${BASE_URL}/api/docentes/${id}/activo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo }),
    }),
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
    listar: (params = {}) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      ).toString();
      return fetchJson(`${BASE_URL}/api/programas${query ? `?${query}` : ''}`);
    },
    catalogos: () => fetchJson(`${BASE_URL}/api/programas/catalogos`),
    crear: (payload) => request(`${BASE_URL}/api/programas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    actualizar: (id, payload) => request(`${BASE_URL}/api/programas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    cambiarActivo: (id, activo) => request(`${BASE_URL}/api/programas/${id}/activo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo }),
    }),
  },
  asignaturas: {
    listar: (params = {}) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      ).toString();
      return fetchJson(`${BASE_URL}/api/asignaturas${query ? `?${query}` : ''}`);
    },
    crear: (payload) => request(`${BASE_URL}/api/asignaturas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    actualizar: (id, payload) => request(`${BASE_URL}/api/asignaturas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    cambiarActivo: (id, activo) => request(`${BASE_URL}/api/asignaturas/${id}/activo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo }),
    }),
  },
  periodos: {
    listar: () => request(`${BASE_URL}/api/periodos`),
    crear: (payload) => request(`${BASE_URL}/api/periodos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    activar: (id) => request(`${BASE_URL}/api/periodos/${id}/activar`, { method: 'PATCH' }),
    editar: (id, payload) => request(`${BASE_URL}/api/periodos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    eliminar: (id) => request(`${BASE_URL}/api/periodos/${id}`, { method: 'DELETE' }),
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
    subirVirtual: (periodoId, cursoGrupoDocenteId, file) => {
      const formData = new FormData();
      formData.append('periodo_id', periodoId);
      formData.append('tipo', 'virtual');
      formData.append('curso_grupo_docente_id', cursoGrupoDocenteId);
      formData.append('file', file);
      return request(`${BASE_URL}/api/cargas`, { method: 'POST', body: formData });
    },
    detectarContextoVirtual: (nombreArchivo) => request(`${BASE_URL}/api/cargas/detectar-contexto-virtual?${new URLSearchParams({ nombre_archivo: nombreArchivo })}`),
    // Polling de una carga en curso (subir() ahora responde apenas se
    // registra, con estado='procesando' — esto es lo que hay que consultar
    // repetidamente hasta que estado sea un valor final).
    obtener: (id) => request(`${BASE_URL}/api/cargas/${id}`),
    pendientes: (cargaId) => request(`${BASE_URL}/api/cargas/${cargaId}/pendientes`),
    resolverPendiente: (pendienteId, payload) => request(`${BASE_URL}/api/cargas/pendientes/${pendienteId}/resolver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    cambiarVisibilidad: (id, visible) => request(`${BASE_URL}/api/cargas/${id}/visibilidad`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible }),
    }),
    eliminar: (id) => request(`${BASE_URL}/api/cargas/${id}`, { method: 'DELETE' }),
  },
  auditLog: {
    listar: (tabla, registroId) => fetchJson(`${BASE_URL}/api/audit-log?tabla=${tabla}&registro_id=${registroId}`),
  },
  politicaEvaluacion: {
    obtener: () => fetchJson(`${BASE_URL}/api/politica-evaluacion`),
  },
  revisiones: {
    listar: (params = {}) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      ).toString();
      return fetchJson(`${BASE_URL}/api/revisiones${query ? `?${query}` : ''}`);
    },
    obtener: (id) => fetchJson(`${BASE_URL}/api/revisiones/${id}`),
    resolver: (id, payload) => request(`${BASE_URL}/api/revisiones/${id}/resolver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  },
};
