import { useEffect, useState } from 'react';
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

  return (
    <div>
      <CatalogHeader
        title="Catálogo de Programas"
        subtitle="Administra los programas de posgrado y su nivel."
        tooltip="Administra el catálogo completo de programas de posgrado, incluyendo activos y suspendidos."
      />

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por nombre o código…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={activoFilter}
          onChange={(e) => setActivoFilter(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="activos">Activos</option>
          <option value="suspendidos">Suspendidos</option>
        </select>
        <button type="button" className={styles.btnAdd} onClick={abrirCrear}>
          <Plus size={16} strokeWidth={2.5} />
          Agregar programa
        </button>
      </div>

      {actionError && (
        <div className={styles.actionErrorBox}>
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {loading && (
        <div className={styles.emptyState}><Loader2 size={18} className={styles.spin} /> Cargando programas…</div>
      )}
      {!loading && error && <div className={styles.emptyState}>{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className={styles.emptyState}>No se encontraron programas para este filtro.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
        <div className={styles.grid}>
          {pageItems.map((p) => (
            <EntityCard
              key={p.id}
              icon={GraduationCap}
              title={p.nombre_corto}
              subtitle={p.codigo}
              statusLabel={p.nivel_programa?.nombre || 'Sin nivel'}
              statusColor={nivelColor(p.nivel_programa?.codigo)}
              active={p.activo}
              onEdit={() => abrirEditar(p)}
              onView={() => setViewTarget(p)}
              onToggleActive={() => setConfirmTarget(p)}
              toggleActiveLabel={p.activo ? 'Suspender' : 'Reactivar'}
              ToggleIcon={p.activo ? ToggleLeft : ToggleRight}
              onShowHistory={() => setHistoryTarget(p)}
            />
          ))}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          setPage={setPage}
          totalItems={items.length}
          pageSize={PAGE_SIZE}
          itemLabel="programas"
        />
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
