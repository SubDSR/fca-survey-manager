import { useEffect, useState } from 'react';
import { Plus, Search, UserX, UserCheck, Loader2, AlertCircle } from 'lucide-react';
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

function condicionColor(nombre) {
  const n = (nombre || '').toLowerCase();
  if (n.includes('nombrado')) return '#34A853';
  if (n.includes('contratado')) return '#2F6FB0';
  return '#94A3B8';
}

const CAMPO_VACIO = {
  nombre_completo: '',
  numero_documento: '',
  tipo_documento_id: '',
  correo_institucional: '',
  facultad_id: '',
  condicion_docente_id: '',
  categoria_docente_id: '',
  grado_academico_id: '',
  pais_id: '',
};

// Adapter de api.js -> forma que espera useEntityCrud.
const docentesAdapter = {
  list: (params) => api.docentes.listar(params),
  create: (payload) => api.docentes.crear(payload),
  update: (id, payload) => api.docentes.actualizar(id, payload),
  toggleActive: (id, activo) => api.docentes.cambiarActivo(id, activo),
};

export default function DocentesTab() {
  const {
    items, loading, error, search, setSearch, activoFilter, setActivoFilter,
    extraFilters, setExtraFilters, actionError, setActionError, create, update, toggleActive,
  } = useEntityCrud(docentesAdapter, { searchFields: ['nombre_completo', 'numero_documento'] });

  const cambiarCondicionFilter = (condicionId) => {
    setExtraFilters((prev) => {
      const next = { ...prev };
      if (condicionId) next.condicion_id = condicionId;
      else delete next.condicion_id;
      return next;
    });
  };

  const [catalogos, setCatalogos] = useState(null);
  useEffect(() => {
    api.docentes.catalogos().then(setCatalogos).catch(() => setCatalogos(null));
  }, []);

  const { page, setPage, totalPages, pageItems } = usePagination(items, PAGE_SIZE, [search, activoFilter, extraFilters]);

  // ---- Historial de cambios (⋮ de cada card) ----
  const [historyTarget, setHistoryTarget] = useState(null);

  // ---- Modal alta/edición ----
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('crear'); // 'crear' | 'editar'
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

  const abrirEditar = (docente) => {
    setFormMode('editar');
    setFormTargetId(docente.id);
    setForm({
      nombre_completo: docente.nombre_completo || '',
      numero_documento: docente.numero_documento || '',
      tipo_documento_id: docente.tipo_documento_id || '',
      correo_institucional: docente.correo_institucional || '',
      facultad_id: docente.facultad_id || '',
      condicion_docente_id: docente.condicion_docente_id || '',
      categoria_docente_id: docente.categoria_docente_id || '',
      grado_academico_id: docente.grado_academico_id || '',
      pais_id: docente.pais_id || '',
    });
    setActionError('');
    setFormOpen(true);
  };

  const cerrarForm = () => { if (!saving) setFormOpen(false); };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.nombre_completo.trim()) {
      setActionError('Falta el nombre completo.');
      return;
    }
    setSaving(true);
    const payload = {
      nombre_completo: form.nombre_completo.trim(),
      numero_documento: form.numero_documento.trim() || '',
      tipo_documento_id: form.tipo_documento_id || '',
      correo_institucional: form.correo_institucional.trim() || '',
      facultad_id: form.facultad_id || '',
      condicion_docente_id: form.condicion_docente_id || '',
      categoria_docente_id: form.categoria_docente_id || '',
      grado_academico_id: form.grado_academico_id || '',
      pais_id: form.pais_id || '',
    };
    const ok = formMode === 'crear'
      ? await create(payload)
      : await update(formTargetId, payload);
    setSaving(false);
    if (ok) setFormOpen(false);
  };

  // ---- Modal ver detalle ----
  const [viewTarget, setViewTarget] = useState(null);

  // ---- Confirmación suspender/reactivar ----
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const ejecutarToggle = async () => {
    if (!confirmTarget) return;
    setConfirming(true);
    await toggleActive(confirmTarget.id, !confirmTarget.activo);
    setConfirming(false);
    setConfirmTarget(null);
  };

  return (
    <div>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-stack-lg mt-4">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface mb-2 flex items-center gap-3">
            Configuración de Docentes
            <span className="material-symbols-outlined text-primary opacity-70 text-[24px] cursor-help" title="Administra los perfiles y estados de los docentes">info</span>
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
            Administra los docentes del sistema, su información, condiciones y estados contractuales en un solo lugar.
          </p>
        </div>
        <button onClick={abrirCrear} className="bg-primary text-white px-6 py-3 rounded-lg font-label-md flex items-center gap-2 hover:bg-primary-container transition-colors shadow-md group">
          <span className="material-symbols-outlined group-hover:rotate-90 transition-transform">add</span>
          Agregar docente
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="glass-card rounded-xl p-4 mb-stack-lg flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-1/3">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">search</span>
          <input
            className="glass-input w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-on-surface focus:outline-none placeholder:text-on-surface-variant/70"
            placeholder="Buscar por nombre, apellidos o DNI..."
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
            value={extraFilters.condicion_id || ''}
            onChange={(e) => cambiarCondicionFilter(e.target.value)}
          >
            <option value="">Todas las condiciones</option>
            {(catalogos?.condicion_docente || []).map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
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
        <div className="text-center py-12 text-on-surface-variant">No se encontraron docentes para este filtro.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter mb-stack-lg">
            {pageItems.map((d) => {
              const isNombrado = (d.condicion || '').toLowerCase().includes('nombrado');
              const isContratado = (d.condicion || '').toLowerCase().includes('contratado');
              const avatarColorClass = isNombrado ? 'bg-tertiary-container/10 text-tertiary border-tertiary/20' : 'bg-primary-container/10 text-primary border-primary/20';
              const nameHoverClass = isNombrado ? 'group-hover:text-tertiary' : 'group-hover:text-primary';
              
              const tagColorClass = isNombrado 
                ? 'bg-tertiary-container/10 text-tertiary border-tertiary/20'
                : isContratado 
                  ? 'bg-[#0284c7]/10 text-[#0284c7] border-[#0284c7]/20'
                  : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30';
              const dotColorClass = isNombrado ? 'bg-tertiary' : isContratado ? 'bg-[#0284c7]' : 'bg-on-surface-variant';

              const initial = d.nombre_completo.charAt(0).toUpperCase();

              return (
                <div key={d.id} className={`glass-card rounded-xl p-6 hover:translate-y-[-4px] transition-all duration-300 group ${!d.activo ? 'border-error-container opacity-75' : ''}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-headline-md font-bold border ${!d.activo ? 'bg-surface-container-high text-on-surface-variant' : avatarColorClass}`}>
                        {initial}
                      </div>
                      <div>
                        <h3 className={`font-headline-md text-base text-on-surface leading-tight mb-1 transition-colors ${!d.activo ? 'line-through text-on-surface-variant' : nameHoverClass}`}>
                          {d.nombre_completo}
                        </h3>
                        <p className="font-body-sm text-on-surface-variant">
                          {d.numero_documento ? `DNI: ${d.numero_documento}` : 'Sin documento'}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setHistoryTarget(d)} className="text-on-surface-variant hover:text-primary transition-colors" title="Ver historial">
                      <span className="material-symbols-outlined">history</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-6">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${tagColorClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`}></span>
                      {d.condicion || 'Sin Condición'}
                    </span>
                    {!d.activo && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-error-container/20 text-error text-xs font-medium border border-error/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                        Suspendido
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-outline-variant/20 pt-4">
                    <button onClick={() => abrirEditar(d)} className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                      Editar
                    </button>
                    <button onClick={() => setViewTarget(d)} className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                      Ver
                    </button>
                    <button 
                      onClick={() => setConfirmTarget(d)} 
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                        d.activo 
                          ? 'text-error hover:bg-error-container/20' 
                          : 'text-primary hover:bg-primary-container/20'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {d.activo ? 'person_off' : 'person_check'}
                      </span>
                      {d.activo ? 'Suspender' : 'Reactivar'}
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
              itemLabel="docentes"
            />
          </div>
        </>
      )}

      {/* Alta / edición */}
      <Modal
        open={formOpen}
        onClose={cerrarForm}
        title={formMode === 'crear' ? 'Agregar docente' : 'Editar docente'}
        subtitle={formMode === 'crear' ? 'Se crea con estado activo.' : form.nombre_completo}
      >
        <form onSubmit={submitForm} className={styles.form}>
          <label className={styles.formField}>
            <span>Nombre completo (Apellidos, Nombres) *</span>
            <input
              type="text"
              value={form.nombre_completo}
              onChange={(e) => setForm((f) => ({ ...f, nombre_completo: e.target.value }))}
              placeholder="Rodríguez Martínez, Juan"
              required
            />
          </label>

          <div className={styles.formRow}>
            <label className={styles.formField}>
              <span>Tipo de documento</span>
              <select
                value={form.tipo_documento_id}
                onChange={(e) => setForm((f) => ({ ...f, tipo_documento_id: e.target.value }))}
              >
                <option value="">—</option>
                {(catalogos?.tipo_documento || []).map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </label>
            <label className={styles.formField}>
              <span>N.º de documento</span>
              <input
                type="text"
                value={form.numero_documento}
                onChange={(e) => setForm((f) => ({ ...f, numero_documento: e.target.value }))}
                placeholder="12345678"
              />
            </label>
          </div>

          <label className={styles.formField}>
            <span>Correo institucional</span>
            <input
              type="email"
              value={form.correo_institucional}
              onChange={(e) => setForm((f) => ({ ...f, correo_institucional: e.target.value }))}
              placeholder="docente@unmsm.edu.pe"
            />
          </label>

          <div className={styles.formRow}>
            <label className={styles.formField}>
              <span>Facultad</span>
              <select
                value={form.facultad_id}
                onChange={(e) => setForm((f) => ({ ...f, facultad_id: e.target.value }))}
              >
                <option value="">—</option>
                {(catalogos?.facultad || []).map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </label>
            <label className={styles.formField}>
              <span>Condición</span>
              <select
                value={form.condicion_docente_id}
                onChange={(e) => setForm((f) => ({ ...f, condicion_docente_id: e.target.value }))}
              >
                <option value="">—</option>
                {(catalogos?.condicion_docente || []).map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.formRow}>
            <label className={styles.formField}>
              <span>Categoría</span>
              <select
                value={form.categoria_docente_id}
                onChange={(e) => setForm((f) => ({ ...f, categoria_docente_id: e.target.value }))}
              >
                <option value="">—</option>
                {(catalogos?.categoria_docente || []).map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </label>
            <label className={styles.formField}>
              <span>Grado académico</span>
              <select
                value={form.grado_academico_id}
                onChange={(e) => setForm((f) => ({ ...f, grado_academico_id: e.target.value }))}
              >
                <option value="">—</option>
                {(catalogos?.grado_academico || []).map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.formField}>
            <span>País</span>
            <select
              value={form.pais_id}
              onChange={(e) => setForm((f) => ({ ...f, pais_id: e.target.value }))}
            >
              <option value="">—</option>
              {(catalogos?.pais || []).map((o) => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
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
        title={viewTarget?.nombre_completo}
        subtitle="Ficha del docente"
      >
        {viewTarget && (
          <div className={styles.viewGrid}>
            <div><span>N.º documento</span><b>{viewTarget.numero_documento || '—'}</b></div>
            <div><span>Tipo de documento</span><b>{viewTarget.tipo_documento || '—'}</b></div>
            <div><span>Correo institucional</span><b>{viewTarget.correo_institucional || '—'}</b></div>
            <div><span>Facultad</span><b>{viewTarget.facultad || '—'}</b></div>
            <div><span>Condición</span><b>{viewTarget.condicion || '—'}</b></div>
            <div><span>Grado académico</span><b>{viewTarget.grado_academico || '—'}</b></div>
            <div><span>Cursos asignados</span><b>{viewTarget.cursos_asignados ?? '—'}</b></div>
            <div><span>Estado</span><b>{viewTarget.activo ? 'Activo' : 'Suspendido'}</b></div>
          </div>
        )}
      </Modal>

      {/* Confirmación suspender/reactivar */}
      <Modal
        open={!!confirmTarget}
        onClose={() => (confirming ? null : setConfirmTarget(null))}
        title={confirmTarget?.activo ? 'Suspender docente' : 'Reactivar docente'}
        subtitle={confirmTarget?.nombre_completo}
      >
        {confirmTarget && (
          <>
            <p className={styles.confirmText}>
              {confirmTarget.activo
                ? `¿Suspender a ${confirmTarget.nombre_completo}? Podrás reactivarlo cuando quieras.`
                : `¿Reactivar a ${confirmTarget.nombre_completo}?`}
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
        tabla="docente"
        target={historyTarget}
        subtitle={historyTarget?.nombre_completo}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
