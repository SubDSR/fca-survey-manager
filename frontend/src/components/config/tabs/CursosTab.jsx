import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ToggleLeft, ToggleRight, Loader2, AlertCircle, BookOpen } from 'lucide-react';
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

const CAMPO_VACIO = { nombre: '', programa_id: '', ciclo: '', creditos: '' };

const cursosAdapter = {
  list: (params) => api.asignaturas.listar(params),
  create: (payload) => api.asignaturas.crear(payload),
  update: (id, payload) => api.asignaturas.actualizar(id, payload),
  toggleActive: (id, activo) => api.asignaturas.cambiarActivo(id, activo),
};

export default function CursosTab() {
  const {
    items, loading, error, search, setSearch, activoFilter, setActivoFilter,
    extraFilters, setExtraFilters, actionError, setActionError, create, update, toggleActive,
  } = useEntityCrud(cursosAdapter, { searchFields: ['nombre'] });

  const { page, setPage, totalPages, pageItems } = usePagination(items, PAGE_SIZE, [search, activoFilter, extraFilters]);
  const [historyTarget, setHistoryTarget] = useState(null);

  const cambiarProgramaFilter = (programaId) => {
    setExtraFilters((prev) => {
      const next = { ...prev };
      if (programaId) next.programa_id = programaId;
      else delete next.programa_id;
      return next;
    });
  };

  const [programas, setProgramas] = useState([]);
  useEffect(() => {
    api.programas.listar({ activo: 'true' }).then(setProgramas).catch(() => setProgramas([]));
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

  const abrirEditar = (curso) => {
    setFormMode('editar');
    setFormTargetId(curso.id);
    setForm({
      nombre: curso.nombre || '',
      programa_id: curso.programa_id || '',
      ciclo: curso.ciclo ?? '',
      creditos: curso.creditos ?? '',
    });
    setActionError('');
    setFormOpen(true);
  };

  const cerrarForm = () => { if (!saving) setFormOpen(false); };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.programa_id) {
      setActionError('Completa el nombre del curso y el programa.');
      return;
    }
    setSaving(true);
    const payload = {
      nombre: form.nombre.trim(),
      programa_id: form.programa_id,
      ciclo: form.ciclo === '' ? '' : Number(form.ciclo),
      creditos: form.creditos === '' ? '' : Number(form.creditos),
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
          Agregar curso
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-outline-variant/30 mb-6">
        <button className="pb-3 font-headline-sm font-semibold text-primary border-b-2 border-primary">
           Cursos
        </button>
        <button onClick={() => navigate('../programas')} className="pb-3 font-headline-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
           Programas
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="glass-card rounded-xl p-4 mb-stack-lg flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-1/3">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">search</span>
          <input
            className="glass-input w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-on-surface focus:outline-none placeholder:text-on-surface-variant/70"
            placeholder="Buscar por nombre del curso..."
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
          <select
            className="glass-input px-4 py-2 rounded-full text-sm font-medium text-on-surface focus:outline-none"
            value={extraFilters.programa_id || ''}
            onChange={(e) => cambiarProgramaFilter(e.target.value)}
          >
            <option value="">Todos los programas</option>
            {programas.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre_corto}</option>
            ))}
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
        <div className="text-center py-12 text-on-surface-variant">No se encontraron cursos para este filtro.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter mb-stack-lg">
            {pageItems.map((c) => (
              <div key={c.id} className={`glass-card rounded-xl overflow-hidden hover:translate-y-[-4px] transition-all duration-300 group flex flex-col ${!c.activo ? 'border-error-container opacity-75' : ''}`}>
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-3">
                    <span className="material-symbols-outlined text-primary text-[28px] p-2 bg-primary-container/10 rounded-lg group-hover:scale-110 transition-transform">
                      book_4
                    </span>
                    <button onClick={() => setHistoryTarget(c)} className="text-on-surface-variant hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[20px]">history</span>
                    </button>
                  </div>
                  <h3 className={`font-headline-sm text-on-surface font-semibold mb-2 line-clamp-2 ${!c.activo ? 'line-through text-on-surface-variant' : 'group-hover:text-primary transition-colors'}`}>
                    {c.nombre}
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-surface-container-high text-on-surface-variant">
                      {c.programa || 'Sin Programa'}
                    </span>
                    {c.ciclo && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-tertiary-container/10 text-tertiary border border-tertiary/20">
                        Ciclo {c.ciclo}
                      </span>
                    )}
                    {c.creditos && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-surface-container-high text-on-surface-variant">
                        {c.creditos} CR
                      </span>
                    )}
                    {!c.activo && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-error-container/20 text-error border border-error/20">
                        Suspendido
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-surface-container-lowest border-t border-outline-variant/20 p-3 flex justify-between gap-2">
                   <button onClick={() => abrirEditar(c)} className="flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Editar
                   </button>
                   <button onClick={() => setViewTarget(c)} className="flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      Ver
                   </button>
                   <button 
                     onClick={() => setConfirmTarget(c)}
                     className={`flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        c.activo 
                          ? 'text-error hover:bg-error-container/20' 
                          : 'text-primary hover:bg-primary-container/20'
                      }`}
                   >
                      <span className="material-symbols-outlined text-[16px]">
                        {c.activo ? 'block' : 'check_circle'}
                      </span>
                      {c.activo ? 'Suspender' : 'Reactivar'}
                   </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-outline-variant/20 pt-6">
            <Pagination
              page={page}
              totalPages={totalPages}
              setPage={setPage}
              totalItems={items.length}
              pageSize={PAGE_SIZE}
              itemLabel="cursos"
            />
          </div>
        </>
      )}

      {/* Alta / edición */}
      <Modal
        open={formOpen}
        onClose={cerrarForm}
        title={formMode === 'crear' ? 'Agregar curso' : 'Editar curso'}
        subtitle={formMode === 'crear' ? 'Se crea con estado activo.' : form.nombre}
      >
        <form onSubmit={submitForm} className={styles.form}>
          <label className={styles.formField}>
            <span>Nombre del curso *</span>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Base de Datos II"
              required
            />
          </label>

          <label className={styles.formField}>
            <span>Programa *</span>
            <select
              value={form.programa_id}
              onChange={(e) => setForm((f) => ({ ...f, programa_id: e.target.value }))}
              required
            >
              <option value="">—</option>
              {programas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre_corto}</option>
              ))}
            </select>
          </label>

          <div className={styles.formRow}>
            <label className={styles.formField}>
              <span>Ciclo</span>
              <input
                type="number"
                min="1"
                value={form.ciclo}
                onChange={(e) => setForm((f) => ({ ...f, ciclo: e.target.value }))}
                placeholder="3"
              />
            </label>
            <label className={styles.formField}>
              <span>Créditos</span>
              <input
                type="number"
                min="0"
                value={form.creditos}
                onChange={(e) => setForm((f) => ({ ...f, creditos: e.target.value }))}
                placeholder="4"
              />
            </label>
          </div>

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
        title={viewTarget?.nombre}
        subtitle="Ficha del curso"
      >
        {viewTarget && (
          <div className={styles.viewGrid}>
            <div><span>Programa</span><b>{viewTarget.programa || '—'}</b></div>
            <div><span>Ciclo</span><b>{viewTarget.ciclo ?? '—'}</b></div>
            <div><span>Créditos</span><b>{viewTarget.creditos ?? '—'}</b></div>
            <div><span>Electivo</span><b>{viewTarget.es_electivo ? 'Sí' : 'No'}</b></div>
            <div><span>Estado</span><b>{viewTarget.activo ? 'Activo' : 'Suspendido'}</b></div>
          </div>
        )}
      </Modal>

      {/* Confirmación suspender/reactivar */}
      <Modal
        open={!!confirmTarget}
        onClose={() => (confirming ? null : setConfirmTarget(null))}
        title={confirmTarget?.activo ? 'Suspender curso' : 'Reactivar curso'}
        subtitle={confirmTarget?.nombre}
      >
        {confirmTarget && (
          <>
            <p className={styles.confirmText}>
              {confirmTarget.activo
                ? `¿Suspender "${confirmTarget.nombre}"? Podrás reactivarlo cuando quieras.`
                : `¿Reactivar "${confirmTarget.nombre}"?`}
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
        tabla="asignatura"
        target={historyTarget}
        subtitle={historyTarget?.nombre}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
