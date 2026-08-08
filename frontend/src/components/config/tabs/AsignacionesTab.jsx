
import { useEffect, useState } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../../services/api.js';
import Modal from '../../common/Modal.jsx';
import HistoryModal from '../shared/HistoryModal.jsx';
import Pagination from '../shared/Pagination.jsx';
import { usePagination } from '../shared/usePagination.js';

const PAGE_SIZE = 9;

// Componente para buscar docente predictivamente
function DocenteSearchInput({ value, onChange, onSelect }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    if (!query || query.length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      api.docentes.listar({ q: query })
        .then(data => setResults(data || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className='relative'>
      <input
        type='text'
        className='glass-input w-full px-4 py-2 rounded-lg text-sm focus:outline-none'
        placeholder='Buscar por nombre...'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading && <div className='absolute right-3 top-2.5 text-slate-400'><Loader2 size={16} className='animate-spin' /></div>}
      {results.length > 0 && query && (
        <div className='absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto'>
          {results.map((d) => (
            <div
              key={d.id}
              className='px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer'
              onClick={() => {
                setQuery(d.nombre_completo);
                setResults([]);
                onSelect(d.id);
              }}
            >
              {d.nombre_completo}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AsignacionesTab() {
  const [periodos, setPeriodos] = useState([]);
  const [periodoId, setPeriodoId] = useState('');
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [search, setSearch] = useState('');
  const [programaFilter, setProgramaFilter] = useState('');
  const [cicloFilter, setCicloFilter] = useState('');
  const [seccionFilter, setSeccionFilter] = useState('');
  
  const [historyTarget, setHistoryTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  
  const [newDocenteId, setNewDocenteId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // 1. Cargar períodos
  useEffect(() => {
    // Si fetchJson lanza error, lo atrapamos
    api.periodos.listar()
      .then((data) => {
        // En SubirVirtualPage hacen {ok, data}, ac dependemos de qu retorna api.periodos.listar
        // Asumiendo que retorna el array
        const list = Array.isArray(data) ? data : (data?.data || []);
        setPeriodos(list);
        const activo = list.find((p) => p.estado === 'EN_CURSO');
        if (activo) setPeriodoId(String(activo.id));
        else if (list.length > 0) setPeriodoId(String(list[0].id));
      })
      .catch((err) => console.error('Error cargando periodos:', err));
  }, []);

  // 2. Cargar asignaciones cada vez que cambia el perodo
  const loadAsignaciones = () => {
    if (!periodoId) return;
    setLoading(true);
    setError('');
    api.asignaciones.listar({ periodo_id: periodoId })
      .then((data) => {
        setItems(data || []);
      })
      .catch((err) => setError(err.message || 'Error cargando asignaciones.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAsignaciones();
  }, [periodoId]);

  // Filtrado local
  const filteredItems = items.filter((item) => {
    if (search) {
      const q = search.toLowerCase();
      const matchDocente = item.docente?.nombre_completo?.toLowerCase().includes(q);
      const matchCurso = item.asignatura?.nombre?.toLowerCase().includes(q);
      if (!matchDocente && !matchCurso) return false;
    }
    if (programaFilter && String(item.grupo?.programa?.id) !== programaFilter) {
      return false;
    }
    if (cicloFilter && String(item.grupo?.ciclo) !== cicloFilter) {
      return false;
    }
    if (seccionFilter && String(item.grupo?.seccion) !== seccionFilter) {
      return false;
    }
    return true;
  });

  const { page, setPage, totalPages, pageItems } = usePagination(filteredItems, PAGE_SIZE, [search, programaFilter, cicloFilter, seccionFilter, periodoId]);

  const programasUnicos = Array.from(new Set(items.map((i) => i.grupo?.programa?.id))).map((id) => {
    const item = items.find((i) => i.grupo?.programa?.id === id);
    return item?.grupo?.programa;
  }).filter(Boolean);

  const ciclosUnicos = !programaFilter ? [] : Array.from(new Set(
    items.filter(i => String(i.grupo?.programa?.id) === programaFilter && i.grupo?.ciclo)
         .map(i => i.grupo.ciclo)
  )).sort((a, b) => Number(a) - Number(b));

  const seccionesUnicas = (!programaFilter || !cicloFilter) ? [] : Array.from(new Set(
    items.filter(i => String(i.grupo?.programa?.id) === programaFilter && String(i.grupo?.ciclo) === cicloFilter && i.grupo?.seccion)
         .map(i => i.grupo.seccion)
  )).sort((a, b) => String(a).localeCompare(String(b)));

  const abrirEditar = (item) => {
    setEditTarget(item);
    setNewDocenteId('');
    setSaveError('');
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!newDocenteId) {
      setSaveError('Selecciona un docente de la lista.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      // api.asignaciones.actualizar usa request() o direct fetch. Supongamos fetchJson o similar
      await api.asignaciones.actualizar(editTarget.id, { docente_id: newDocenteId });
      setEditTarget(null);
      loadAsignaciones(); // recargar
    } catch (err) {
      setSaveError(err.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className='flex flex-col md:flex-row md:items-end justify-between gap-6 mb-stack-lg mt-4'>
        <div>
          <h1 className='font-display-lg text-display-lg text-on-surface mb-2 flex items-center gap-3'>
             Carga Académica
             <span className='material-symbols-outlined text-primary opacity-70 text-[24px] cursor-help' title='Asignación de docentes a cursos por período'>info</span>
          </h1>
          <p className='font-body-lg text-body-lg text-on-surface-variant max-w-2xl'>Gestiona y reasigna los docentes para cada curso y sección en un período específico.</p>
        </div>
        
        <div className='flex flex-col gap-1 min-w-[200px]'>
          <label className='text-xs font-semibold text-on-surface-variant uppercase tracking-wider'>Período Académico</label>
          <select
            className='glass-input px-4 py-2.5 rounded-lg text-sm font-medium text-on-surface focus:outline-none'
            value={periodoId}
            onChange={(e) => setPeriodoId(e.target.value)}
          >
            {periodos.length === 0 && <option value=''>Cargando...</option>}
            {periodos.map(p => (
              <option key={p.id} value={p.id}>{p.codigo} {p.estado === 'EN_CURSO' ? '(Actual)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      <div className='flex gap-4 border-b border-outline-variant/30 mb-6'>
        <button className='pb-3 font-headline-sm font-semibold text-primary border-b-2 border-primary'>
           Asignaciones Docentes
        </button>
      </div>

      <div className='glass-card rounded-xl p-4 mb-stack-lg flex flex-col lg:flex-row gap-4 items-center justify-between'>
        <div className='relative w-full lg:w-1/3'>
          <Search size={18} className='absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant' />
          <input
            className='glass-input w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-on-surface focus:outline-none placeholder:text-on-surface-variant/70'
            placeholder='Buscar curso o docente...'
            type='text'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className='flex flex-wrap gap-2 w-full lg:w-auto items-center'>
          <select
            className='glass-input px-4 py-2 rounded-full text-sm font-medium text-on-surface focus:outline-none'
            value={programaFilter}
            onChange={(e) => { setProgramaFilter(e.target.value); setCicloFilter(''); setSeccionFilter(''); }}
          >
            <option value=''>Todos los programas</option>
            {programasUnicos.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.nombre_corto}</option>
            ))}
          </select>
          {programaFilter && (
            <select
              className='glass-input px-4 py-2 rounded-full text-sm font-medium text-on-surface focus:outline-none'
              value={cicloFilter}
              onChange={(e) => { setCicloFilter(e.target.value); setSeccionFilter(''); }}
            >
              <option value=''>Todos los ciclos</option>
              {ciclosUnicos.map(c => (
                <option key={c} value={String(c)}>Ciclo {c}</option>
              ))}
            </select>
          )}
          {cicloFilter && (
            <select
              className='glass-input px-4 py-2 rounded-full text-sm font-medium text-on-surface focus:outline-none'
              value={seccionFilter}
              onChange={(e) => setSeccionFilter(e.target.value)}
            >
              <option value=''>Todas las secciones</option>
              {seccionesUnicas.map(s => (
                <option key={s} value={String(s)}>Sección {s}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading && (
        <div className='flex justify-center items-center py-12 text-primary'>
          <Loader2 size={32} className='animate-spin' />
        </div>
      )}
      {!loading && error && <div className='text-error text-center py-12'>{error}</div>}
      {!loading && !error && filteredItems.length === 0 && (
        <div className='text-center py-12 text-on-surface-variant'>No se encontraron asignaciones.</div>
      )}

      {!loading && !error && filteredItems.length > 0 && (
        <>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter mb-stack-lg'>
            {pageItems.map((item) => (
              <div key={item.id} className='glass-card rounded-xl overflow-hidden hover:translate-y-[-4px] transition-all duration-300 group flex flex-col'>
                <div className='p-5 flex-1'>
                  <div className='flex justify-between items-start mb-3'>
                    <span className='inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-surface-container-high text-on-surface-variant'>
                      {item.grupo?.programa?.nombre_corto || 'N/A'}
                    </span>
                    <button onClick={() => setHistoryTarget({ id: item.id, ...item })} className='text-on-surface-variant hover:text-primary transition-colors' title='Ver historial de cambios'>
                      <span className='material-symbols-outlined text-[20px]'>history</span>
                    </button>
                  </div>
                  
                  <h3 className='font-headline-sm text-on-surface font-semibold mb-1 line-clamp-2 group-hover:text-primary transition-colors'>
                    {item.asignatura?.nombre || 'Curso Desconocido'}
                  </h3>
                  
                  <div className='flex flex-wrap gap-2 mb-4'>
                    <span className='inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-tertiary-container/10 text-tertiary border border-tertiary/20'>
                      Ciclo {item.grupo?.ciclo || '?'}
                    </span>
                    <span className='inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-surface-container-high text-on-surface-variant'>
                      Sec. {item.grupo?.seccion || '?'}
                    </span>
                  </div>

                  <div className='mt-auto pt-3 border-t border-outline-variant/20'>
                    <div className='text-[10px] uppercase font-bold text-on-surface-variant mb-1'>Docente Actual</div>
                    <div className='text-sm font-medium text-on-surface line-clamp-1'>
                      {item.docente?.nombre_completo || 'Sin asignar'}
                    </div>
                  </div>
                </div>
                
                <div className='bg-surface-container-lowest border-t border-outline-variant/20 p-3 flex justify-between gap-2'>
                   <button onClick={() => abrirEditar(item)} className='flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors'>
                      <span className='material-symbols-outlined text-[16px]'>edit</span>
                      Reasignar Docente
                   </button>
                </div>
              </div>
            ))}
          </div>

          <div className='border-t border-outline-variant/20 pt-6'>
            <Pagination
              page={page}
              totalPages={totalPages}
              setPage={setPage}
              totalItems={filteredItems.length}
              pageSize={PAGE_SIZE}
              itemLabel='asignaciones'
            />
          </div>
        </>
      )}

      {/* Modal Reasignar */}
      <Modal
        open={!!editTarget}
        onClose={() => { if (!saving) setEditTarget(null); }}
        title='Reasignar Docente'
        subtitle={`${editTarget?.asignatura?.nombre} - Ciclo: ${editTarget?.grupo?.ciclo} - Sec: ${editTarget?.grupo?.seccion}`}
        overflowVisible
      >
        <form onSubmit={submitEdit} className='flex flex-col gap-4 mt-2'>
          <div className='bg-surface-container/30 p-3 rounded-lg mb-2'>
            <div className='text-xs text-on-surface-variant mb-1'>Docente Actual</div>
            <div className='text-sm font-medium text-on-surface'>{editTarget?.docente?.nombre_completo || 'Ninguno'}</div>
          </div>
          
          <div className='flex flex-col gap-1'>
            <label className='text-sm font-semibold text-on-surface'>Nuevo Docente *</label>
            <DocenteSearchInput onSelect={(id) => setNewDocenteId(id)} />
          </div>

          {saveError && (
            <div className='bg-error-container/20 border border-error/50 rounded-lg p-3 flex gap-2 text-error items-center text-sm'>
              <AlertCircle size={16} /> {saveError}
            </div>
          )}

          <div className='flex justify-end gap-3 mt-4 pt-4 border-t border-outline-variant/20'>
            <button type='button' className='px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors' onClick={() => setEditTarget(null)} disabled={saving}>
              Cancelar
            </button>
            <button type='submit' className='px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-container rounded-lg transition-colors flex items-center gap-2' disabled={saving || !newDocenteId}>
              {saving ? <Loader2 size={16} className='animate-spin' /> : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </Modal>

      <HistoryModal
        tabla='curso_grupo_docente'
        target={historyTarget}
        subtitle={historyTarget?.asignatura?.nombre}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
