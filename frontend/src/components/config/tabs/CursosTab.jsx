import { useEffect, useState } from 'react';
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

  return (
    <div>
      <CatalogHeader
        title="Catálogo de Cursos"
        subtitle="Administra los cursos (asignaturas) de cada programa."
        tooltip="Administra el catálogo completo de cursos, incluyendo activos y suspendidos."
      />

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por nombre del curso…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={extraFilters.programa_id || ''}
          onChange={(e) => cambiarProgramaFilter(e.target.value)}
        >
          <option value="">Todos los programas</option>
          {programas.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre_corto}</option>
          ))}
        </select>
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
          Agregar curso
        </button>
      </div>

      {actionError && (
        <div className={styles.actionErrorBox}>
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {loading && (
        <div className={styles.emptyState}><Loader2 size={18} className={styles.spin} /> Cargando cursos…</div>
      )}
      {!loading && error && <div className={styles.emptyState}>{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className={styles.emptyState}>No se encontraron cursos para este filtro.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
        <div className={styles.grid}>
          {pageItems.map((c) => (
            <EntityCard
              key={c.id}
              icon={BookOpen}
              title={c.nombre}
              subtitle={c.programa || 'Sin programa'}
              statusLabel={c.ciclo ? `Ciclo ${c.ciclo}` : null}
              statusColor="#2F6FB0"
              active={c.activo}
              onEdit={() => abrirEditar(c)}
              onView={() => setViewTarget(c)}
              onToggleActive={() => setConfirmTarget(c)}
              toggleActiveLabel={c.activo ? 'Suspender' : 'Reactivar'}
              ToggleIcon={c.activo ? ToggleLeft : ToggleRight}
              onShowHistory={() => setHistoryTarget(c)}
            />
          ))}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          setPage={setPage}
          totalItems={items.length}
          pageSize={PAGE_SIZE}
          itemLabel="cursos"
        />
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
