import { useEffect, useState } from 'react';
import { Plus, Search, UserX, UserCheck, Loader2, AlertCircle } from 'lucide-react';
import Modal from '../../common/Modal.jsx';
import EntityCard from '../shared/EntityCard.jsx';
import CatalogHeader from '../shared/CatalogHeader.jsx';
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
      <CatalogHeader
        title="Configuración de Docentes"
        subtitle="Administra los docentes del sistema, su información y condiciones."
        tooltip="Administra el directorio completo de docentes, incluyendo activos y suspendidos."
      />

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por nombre o DNI…"
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
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="suspendidos">Suspendidos</option>
        </select>
        <select
          className={styles.filterSelect}
          value={extraFilters.condicion_id || ''}
          onChange={(e) => cambiarCondicionFilter(e.target.value)}
        >
          <option value="">Todas las condiciones</option>
          {(catalogos?.condicion_docente || []).map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <button type="button" className={styles.btnAdd} onClick={abrirCrear}>
          <Plus size={16} strokeWidth={2.5} />
          Agregar docente
        </button>
      </div>

      {actionError && (
        <div className={styles.actionErrorBox}>
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {loading && (
        <div className={styles.emptyState}><Loader2 size={18} className={styles.spin} /> Cargando docentes…</div>
      )}
      {!loading && error && <div className={styles.emptyState}>{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className={styles.emptyState}>No se encontraron docentes para este filtro.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className={styles.grid}>
            {pageItems.map((d) => (
              <EntityCard
                key={d.id}
                title={d.nombre_completo}
                subtitle={d.numero_documento || 'Sin documento'}
                statusLabel={d.condicion || 'Sin condición'}
                statusColor={condicionColor(d.condicion)}
                active={d.activo}
                onEdit={() => abrirEditar(d)}
                onView={() => setViewTarget(d)}
                onToggleActive={() => setConfirmTarget(d)}
                toggleActiveLabel={d.activo ? 'Suspender' : 'Reactivar'}
                ToggleIcon={d.activo ? UserX : UserCheck}
              />
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            setPage={setPage}
            totalItems={items.length}
            pageSize={PAGE_SIZE}
            itemLabel="docentes"
          />
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
    </div>
  );
}
