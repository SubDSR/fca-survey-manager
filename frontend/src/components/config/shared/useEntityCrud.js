import { useState, useEffect, useCallback, useMemo } from 'react';

/* Normalización propia (NFD + strip de diacríticos), deliberadamente NO
   importada desde GestionView.jsx/lib — ver decisión de la sección 0 del
   documento de diseño: este módulo administrativo no comparte código con
   la vista de solo-consulta existente. */
function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(new RegExp("[\u0300-\u036f]", "g"), '')
    .toLowerCase()
    .trim();
}

/* Hook genérico de listado + alta/edición/suspensión para los tabs de
   catálogo del módulo de Configuración (Docentes ahora; Programas/Cursos lo
   reutilizarán sin cambios, solo cambia el `adapter`). Ver
   docs/plans/2026-08-04-modulo-configuracion-design.md, secciones 1.3 y 3.2.

   `adapter`:
     - list(params): Promise<Array>            (lanza en error, como fetchJson)
     - create(payload): Promise<{ok,status,data}>
     - update(id, payload): Promise<{ok,status,data}>
     - toggleActive(id, activo): Promise<{ok,status,data}>

   El filtro activo (Todos/Activos/Suspendidos) se resuelve en el backend —
   pocos estados posibles, un pedido por cambio, no por tecla. La búsqueda de
   texto se resuelve en el cliente sobre la lista ya cargada: los catálogos
   de este módulo son chicos (decenas a un par de cientos de filas), así que
   no vale la pena un pedido de red por cada tecla escrita.

   `extraFilters`: filtros adicionales server-side propios de cada entidad
   (p. ej. condicion_id en Docentes) que este hook no conoce — el tab dueño
   los arma con setExtraFilters y acá solo se mezclan tal cual en `params`,
   junto al `activo` que si maneja el hook. Así Programas/Cursos pueden traer
   sus propios filtros sin tocar este archivo. */
export function useEntityCrud(adapter, { searchFields = ['nombre_completo', 'numero_documento'] } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activoFilter, setActivoFilter] = useState('todos'); // 'todos' | 'activos' | 'suspendidos'
  const [extraFilters, setExtraFilters] = useState({});
  const [actionError, setActionError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { ...extraFilters };
      if (activoFilter === 'activos') params.activo = 'true';
      if (activoFilter === 'suspendidos') params.activo = 'false';
      const data = await adapter.list(params);
      setItems(data || []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la lista.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activoFilter, extraFilters]);

  useEffect(() => { reload(); }, [reload]);

  const items_ = useMemo(() => {
    const term = normalizar(search);
    if (!term) return items;
    return items.filter((item) => {
      const haystack = normalizar(searchFields.map((f) => item[f]).join(' '));
      return haystack.includes(term);
    });
  }, [items, search, searchFields]);

  const create = async (payload) => {
    setActionError('');
    const { ok, data } = await adapter.create(payload);
    if (!ok) {
      setActionError((data && data.error) || 'No se pudo crear el registro.');
      return false;
    }
    await reload();
    return true;
  };

  const update = async (id, payload) => {
    setActionError('');
    const { ok, data } = await adapter.update(id, payload);
    if (!ok) {
      setActionError((data && data.error) || 'No se pudo editar el registro.');
      return false;
    }
    await reload();
    return true;
  };

  const toggleActive = async (id, activo) => {
    setActionError('');
    const { ok, data } = await adapter.toggleActive(id, activo);
    if (!ok) {
      setActionError((data && data.error) || 'No se pudo cambiar el estado.');
      return false;
    }
    await reload();
    return true;
  };

  return {
    items: items_,
    loading,
    error,
    search,
    setSearch,
    activoFilter,
    setActivoFilter,
    extraFilters,
    setExtraFilters,
    actionError,
    setActionError,
    reload,
    create,
    update,
    toggleActive,
  };
}
