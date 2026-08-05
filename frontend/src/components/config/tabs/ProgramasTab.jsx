import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ToggleLeft, ToggleRight, Loader2, AlertCircle, GraduationCap } from 'lucide-react';
import Modal from '../../common/Modal.jsx';
import EntityCard from '../shared/EntityCard.jsx';
import CatalogHeader from '../shared/CatalogHeader.jsx';
import HistoryModal from '../shared/HistoryModal.jsx';
import Pagination from '../shared/Pagination.jsx';
import { usePagination } from '../shared/usePagination.js';
import { useEntityCrud } from '../shared/useEntityCrud.js';
import { api } from '../../../services/api.js';
import styles from './DocentesTab.module.css';

const PAGE_SIZE = 9;

function nivelColor(codigo) {
  if (codigo === 'DOCTORADO') return '#7C3AED';
  if (codigo === 'ESPECIALIZACION') return '#2F6FB0';
  return '#34A853';
}

const CAMPO_VACIO = {
  codigo: '', nivel_programa_id: '', nombre_base: '', mencion: '', nombre_corto: '',
};

const programasAdapter = {
  list: (params) => api.programas.listar(params),
  create: (payload) => api.programas.crear(payload),
  update: (id, payload) => api.programas.actualizar(id, payload),
  toggleActive: (id, activo) => api.programas.cambiarActivo(id, activo),
};

export default function ProgramasTab() {
  const {
    items, loading, error, search, setSearch, activoFilter, setActivoFilter,
    actionError, setActionError, create, update, toggleActive,
  } = useEntityCrud(programasAdapter, { searchFields: ['nombre_corto', 'nombre_base', 'codigo'] });

  const { page, setPage, totalPages, pageItems } = usePagination(items, PAGE_SIZE, [search, activoFilter]);
  const [historyTarget, setHistoryTarget] = useState(null);

  const [catalogos, setCatalogos] = useState(null);
  useEffect(() => {
    api.programas.catalogos().then(setCatalogos).catch(() => setCatalogos(null));
  }, []);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('crear');
  const [formTargetId, setFormTargetId] = useState(null);
  const [form, setForm] = useState(CAMPO_VACIO);
  const [saving, setSaving] = useState(false);

  const abrirCrear = () => {
    setFormMode('crear');
    setFormTargetId(null);
    setForm(CAMPO_VACIO);
    setActionError('');
    setFormOpen(true);
  };

  const abrirEditar = (programa) => {
    setFormMode('editar');
    setFormTargetId(programa.id);
    setForm({
      codigo: programa.codigo || '',
      nivel_programa_id: programa.nivel_programa_id || '',
      nombre_base: programa.nombre_base || '',
      mencion: programa.mencion || '',
      nombre_corto: programa.nombre_corto || '',
    });
    setActionError('');
    setFormOpen(true);
  };

  const cerrarForm = () => { if (!saving) setFormOpen(false); };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.codigo.trim() || !form.nivel_programa_id || !form.nombre_base.trim() || !form.nombre_corto.trim()) {
      setActionError('Completa código, nivel, nombre base y nombre corto.');
      return;
    }
    setSaving(true);
    const payload = {
      codigo: form.codigo.trim(),
      nivel_programa_id: form.nivel_programa_id,
      nombre_base: form.nombre_base.trim(),
      mencion: form.mencion.trim() || '',
      nombre_corto: form.nombre_corto.trim(),
    };
    const ok = formMode === 'crear'
      ? await create(payload)
      : await update(formTargetId, payload);
    setSaving(false);
    if (ok) setFormOpen(false);
  };

  const [viewTarget, setViewTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const ejecutarToggle = async () => {
    if (!confirmTarget) return;
    setConfirming(true);
    await toggleActive(confirmTarget.id, !confirmTarget.activo);
    setConfirming(false);
    setConfirmTarget(null);
  };

  const navigate = useNavigate();

  return (
    <div>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-stack-lg mt-4">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface mb-2 flex items-center gap-3">
             Gestión Académica
             <span className="material-symbols-outlined text-primary opacity-70 text-[24px] cursor-help" title="Administra los cursos y programas de estudio">info</span>
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">Administra el catálogo completo de cursos y programas académicos.</p>
        </div>
        <button onClick={abrirCrear} className="bg-primary text-white px-6 py-3 rounded-lg font-label-md flex items-center gap-2 hover:bg-primary-container transition-colors shadow-md group">
          <span className="material-symbols-outlined group-hover:rotate-90 transition-transform">add</span>
          Agregar programa
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-outline-variant/30 mb-6">
        <button onClick={() => navigate('../cursos')} className="pb-3 font-headline-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
           Cursos
        </button>
        <button className="pb-3 font-headline-sm font-semibold text-primary border-b-2 border-primary">
           Programas
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="glass-card rounded-xl p-4 mb-stack-lg flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-1/3">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">search</span>
          <input
            className="glass-input w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-on-surface focus:outline-none placeholder:text-on-surface-variant/70"
            placeholder="Buscar por nombre o código..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center">
          <select
            className="glass-input px-4 py-2 rounded-full text-sm font-medium text-on-surface focus:outline-none"
            value={activoFilter}
            onChange={(e) => setActivoFilter(e.target.value)}
          >
            <option value="todos">Todos los estados</option>
            <option value="activos">Activos</option>
            <option value="suspendidos">Suspendidos</option>
          </select>
        </div>
      </div>

      {actionError && (
        <div className="bg-error-container/20 border border-error/50 rounded-xl p-4 flex gap-3 text-error mb-4 items-center">
          <AlertCircle size={18} />
          <span className="font-medium text-sm">{actionError}</span>
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center py-12 text-primary">
          <Loader2 size={32} className={styles.spin} />
        </div>
      )}
      {!loading && error && <div className="text-error text-center py-12">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="text-center py-12 text-on-surface-variant">No se encontraron programas para este filtro.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter mb-stack-lg">
            {pageItems.map((p) => {
              const codigoNivel = p.nivel_programa?.codigo || '';
              let tagColorClass = 'bg-surface-container-high text-on-surface-variant';
              if (codigoNivel === 'DOCTORADO') tagColorClass = 'bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/20';
              else if (codigoNivel === 'MAESTRIA') tagColorClass = 'bg-primary-container/10 text-primary border border-primary/20';
              else if (codigoNivel === 'ESPECIALIZACION') tagColorClass = 'bg-[#0284c7]/10 text-[#0284c7] border border-[#0284c7]/20';

              return (
                <div key={p.id} className={`glass-card rounded-xl overflow-hidden hover:translate-y-[-4px] transition-all duration-300 group flex flex-col ${!p.activo ? 'border-error-container opacity-75' : ''}`}>
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <span className="material-symbols-outlined text-primary text-[28px] p-2 bg-primary-container/10 rounded-lg group-hover:scale-110 transition-transform">
                        school
                      </span>
                      <button onClick={() => setHistoryTarget(p)} className="text-on-surface-variant hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">history</span>
                      </button>
                    </div>
                    <h3 className={`font-headline-sm text-on-surface font-semibold mb-2 line-clamp-2 ${!p.activo ? 'line-through text-on-surface-variant' : 'group-hover:text-primary transition-colors'}`}>
                      {p.nombre_corto}
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-medium ${tagColorClass}`}>
                        {p.nivel_programa?.nombre || 'Sin nivel'}
                      </span>
                      {p.codigo && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-surface-container-high text-on-surface-variant">
                          Cód: {p.codigo}
                        </span>
                      )}
                      {!p.activo && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-error-container/20 text-error border border-error/20">
                          Suspendido
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest border-t border-outline-variant/20 p-3 flex justify-between gap-2">
                     <button onClick={() => abrirEditar(p)} className="flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Editar
                     </button>
                     <button onClick={() => setViewTarget(p)} className="flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Ver
                     </button>
                     <button 
                       onClick={() => setConfirmTarget(p)}
                       className={`flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          p.activo 
                            ? 'text-error hover:bg-error-container/20' 
                            : 'text-primary hover:bg-primary-container/20'
                        }`}
                     >
                        <span className="material-symbols-outlined text-[16px]">
                          {p.activo ? 'block' : 'check_circle'}
                        </span>
                        {p.activo ? 'Suspender' : 'Reactivar'}
                     </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-outline-variant/20 pt-6">
            <Pagination
              page={page}
              totalPages={totalPages}
              setPage={setPage}
              totalItems={items.length}
              pageSize={PAGE_SIZE}
              itemLabel="programas"
            />
          </div>
        </>
      )}

      {/* Alta / edición */}
      <Modal
        open={formOpen}
        onClose={cerrarForm}
        title={formMode === 'crear' ? 'Agregar programa' : 'Editar programa'}
        subtitle={formMode === 'crear' ? 'Se crea con estado activo.' : form.nombre_corto}
      >
        <form onSubmit={submitForm} className={styles.form}>
          <div className={styles.formRow}>
            <label className={styles.formField}>
              <span>Código *</span>
              <input
                type="text"
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="GNI"
                required
              />
            </label>
            <label className={styles.formField}>
              <span>Nivel *</span>
              <select
                value={form.nivel_programa_id}
                onChange={(e) => setForm((f) => ({ ...f, nivel_programa_id: e.target.value }))}
                required
              >
                <option value="">—</option>
                {(catalogos?.nivel_programa || []).map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.formField}>
            <span>Nombre base *</span>
            <input
              type="text"
              value={form.nombre_base}
              onChange={(e) => setForm((f) => ({ ...f, nombre_base: e.target.value }))}
              placeholder="Maestría en Gestión de Negocios Internacionales"
              required
            />
          </label>

          <label className={styles.formField}>
            <span>Mención</span>
            <input
              type="text"
              value={form.mencion}
              onChange={(e) => setForm((f) => ({ ...f, mencion: e.target.value }))}
              placeholder="Comercio Internacional"
            />
          </label>

          <label className={styles.formField}>
            <span>Nombre corto *</span>
            <input
              type="text"
              value={form.nombre_corto}
              onChange={(e) => setForm((f) => ({ ...f, nombre_corto: e.target.value }))}
              placeholder="COMERCIO INTERNACIONAL"
              required
            />
          </label>

          {actionError && <div className={styles.formError}>{actionError}</div>}

          <div className={styles.formActions}>
            <button type="button" className={styles.btnSecondary} onClick={cerrarForm} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? <Loader2 size={16} className={styles.spin} /> : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Ver detalle */}
      <Modal
        open={!!viewTarget}
        onClose={() => setViewTarget(null)}
        title={viewTarget?.nombre_corto}
        subtitle="Ficha del programa"
      >
        {viewTarget && (
          <div className={styles.viewGrid}>
            <div><span>Código</span><b>{viewTarget.codigo || '—'}</b></div>
            <div><span>Nivel</span><b>{viewTarget.nivel_programa?.nombre || '—'}</b></div>
            <div><span>Nombre base</span><b>{viewTarget.nombre_base || '—'}</b></div>
            <div><span>Mención</span><b>{viewTarget.mencion || '—'}</b></div>
            <div><span>Estado</span><b>{viewTarget.activo ? 'Activo' : 'Suspendido'}</b></div>
          </div>
        )}
      </Modal>

      {/* Confirmación suspender/reactivar */}
      <Modal
        open={!!confirmTarget}
        onClose={() => (confirming ? null : setConfirmTarget(null))}
        title={confirmTarget?.activo ? 'Suspender programa' : 'Reactivar programa'}
        subtitle={confirmTarget?.nombre_corto}
      >
        {confirmTarget && (
          <>
            <p className={styles.confirmText}>
              {confirmTarget.activo
                ? `¿Suspender "${confirmTarget.nombre_corto}"? Podrás reactivarlo cuando quieras.`
                : `¿Reactivar "${confirmTarget.nombre_corto}"?`}
            </p>
            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setConfirmTarget(null)} disabled={confirming}>
                Cancelar
              </button>
              <button
                type="button"
                className={confirmTarget.activo ? styles.btnDanger : styles.btnPrimary}
                onClick={ejecutarToggle}
                disabled={confirming}
              >
                {confirming ? <Loader2 size={16} className={styles.spin} /> : (confirmTarget.activo ? 'Sí, suspender' : 'Sí, reactivar')}
              </button>
            </div>
          </>
        )}
      </Modal>

      <HistoryModal
        tabla="programa"
        target={historyTarget}
        subtitle={historyTarget?.nombre_corto}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
