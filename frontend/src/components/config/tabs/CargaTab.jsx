import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Calendar, AlertCircle, FileText, UploadCloud, CheckCircle2, Layers,
  Eye, EyeOff, Trash2, Loader2, ChevronDown, ChevronUp,
  Pencil, FileCheck2, Monitor, FileSpreadsheet, Info, List, ChevronRight,
} from 'lucide-react';
import Modal from '../../common/Modal.jsx';
import { api } from '../../../services/api.js';
import { EXPECTED_HEADERS, SAMPLE_CSV, EXPECTED_HEADERS_VIRTUAL, SAMPLE_CSV_VIRTUAL } from './cargaFormatos.js';
import styles from '../ConfigView.module.css';
import layoutStyles from './CargaTab.module.css';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// fecha_inicio/fecha_fin llegan como "YYYY-MM-DD": construir con hora fija
// evita que el motor de zona horaria del navegador la corra un día.
function formatDateOnly(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SEMESTRE_OPCIONES = [
  { value: '1', label: 'I' },
  { value: '2', label: 'II' },
  { value: '3', label: 'III' },
];

function descargarPlantillaFisica() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_encuestas_fisica.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function descargarPlantillaVirtual() {
  const blob = new Blob([SAMPLE_CSV_VIRTUAL], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'virtuales_ejemplo.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// Rediseño de "Carga de Información" sobre el diseño importado desde Claude
// Design (ver docs/plans/2026-08-04-modulo-configuracion-design.md) -- toda
// la lógica de Períodos+Campaña+Upload+Historial se movió acá tal cual desde
// el ConfigView.jsx monolítico anterior, solo cambia el layout visual y se
// suman: editar/eliminar período, y los bloques 2/3 (acciones disponibles,
// plantillas CSV).
//
// El flujo de subida (dropzone, selector de contexto virtual, preview, tabla
// de datos) YA NO vive acá: "Subir CSV" y "Subir encuestas virtuales" son
// páginas propias (/configuracion/carga/subir-csv y .../subir-virtual, ver
// SubirCsvPage.jsx / SubirVirtualPage.jsx) para tener espacio para el box de
// contexto reconocido y la tabla completa del CSV, sin competir con el resto
// del panel. El período seleccionado viaja como query param (?periodo_id=)
// para que la página de destino cargue en el mismo período sin tener que
// volver a elegirlo.
export default function CargaTab() {
  const navigate = useNavigate();

  // ---- Períodos ----
  const [periods, setPeriods] = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [periodsError, setPeriodsError] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
  const [showAllPeriods, setShowAllPeriods] = useState(false);

  const [showNewPeriodForm, setShowNewPeriodForm] = useState(false);
  const [newPeriodAnio, setNewPeriodAnio] = useState('');
  const [newPeriodSemestre, setNewPeriodSemestre] = useState('1');
  const [newPeriodActivar, setNewPeriodActivar] = useState(true);
  const [newPeriodError, setNewPeriodError] = useState('');
  const [creatingPeriod, setCreatingPeriod] = useState(false);

  const loadPeriods = useCallback(async (selectId) => {
    setPeriodsLoading(true);
    setPeriodsError('');
    const { ok, data } = await api.periodos.listar();
    setPeriodsLoading(false);
    if (!ok) {
      setPeriodsError((data && data.error) || 'No se pudo cargar la lista de períodos.');
      return;
    }
    setPeriods(data);
    if (selectId) {
      setSelectedPeriodId(selectId);
    } else if (data.length > 0) {
      setSelectedPeriodId((prev) => {
        if (prev && data.some((p) => p.id === prev)) return prev;
        const enCurso = data.find((p) => p.estado === 'EN_CURSO');
        return (enCurso || data[0]).id;
      });
    }
  }, []);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  const toggleNewPeriodForm = () => {
    setShowNewPeriodForm((prev) => !prev);
    setNewPeriodAnio('');
    setNewPeriodSemestre('1');
    setNewPeriodActivar(true);
    setNewPeriodError('');
  };

  const createPeriod = async () => {
    const anioNum = Number(newPeriodAnio);
    if (!anioNum || anioNum < 1990 || anioNum > 2100) {
      setNewPeriodError('Año inválido (debe estar entre 1990 y 2100).');
      return;
    }
    setCreatingPeriod(true);
    setNewPeriodError('');
    const { ok, data } = await api.periodos.crear({
      anio: anioNum,
      semestre: Number(newPeriodSemestre),
      activar: newPeriodActivar,
    });
    setCreatingPeriod(false);
    if (!ok) {
      setNewPeriodError((data && data.error) || 'No se pudo crear el período.');
      return;
    }
    setShowNewPeriodForm(false);
    await loadPeriods(data.id);
  };

  const activatePeriod = async (id) => {
    setActivatingId(id);
    const { ok, data } = await api.periodos.activar(id);
    setActivatingId(null);
    if (!ok) {
      setPeriodsError((data && data.error) || 'No se pudo activar el período.');
      return;
    }
    await loadPeriods(selectedPeriodId);
  };

  // ---- Editar período (fecha_inicio/fecha_fin) ----
  const [editTarget, setEditTarget] = useState(null);
  const [editFechaInicio, setEditFechaInicio] = useState('');
  const [editFechaFin, setEditFechaFin] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const abrirEditarPeriodo = (p) => {
    setEditTarget(p);
    setEditFechaInicio(p.fecha_inicio || '');
    setEditFechaFin(p.fecha_fin || '');
    setEditError('');
  };

  const guardarEdicionPeriodo = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    setEditError('');
    const { ok, data } = await api.periodos.editar(editTarget.id, {
      fecha_inicio: editFechaInicio || null,
      fecha_fin: editFechaFin || null,
    });
    setEditSaving(false);
    if (!ok) {
      setEditError((data && data.error) || 'No se pudo editar el período.');
      return;
    }
    setEditTarget(null);
    await loadPeriods(selectedPeriodId);
  };

  // ---- Eliminar período (solo si no tiene cargas/encuestas) ----
  const [deletePeriodTarget, setDeletePeriodTarget] = useState(null);
  const [deletingPeriod, setDeletingPeriod] = useState(false);
  const [deletePeriodError, setDeletePeriodError] = useState('');

  const confirmarEliminarPeriodo = async () => {
    if (!deletePeriodTarget) return;
    setDeletingPeriod(true);
    setDeletePeriodError('');
    const { ok, data } = await api.periodos.eliminar(deletePeriodTarget.id);
    setDeletingPeriod(false);
    if (!ok) {
      setDeletePeriodError((data && data.error) || 'No se pudo eliminar el período.');
      return;
    }
    setDeletePeriodTarget(null);
    await loadPeriods();
  };

  // ---- Campaña activa del período seleccionado ----
  const [campania, setCampania] = useState(null);
  const [campaniaChecked, setCampaniaChecked] = useState(false);

  // ---- Historial de cargas ----
  const [uploads, setUploads] = useState([]);
  const [totalAcumulado, setTotalAcumulado] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [visibilityPendingId, setVisibilityPendingId] = useState(null);

  const refreshHistory = useCallback(async (campaniaId) => {
    if (!campaniaId) {
      setUploads([]);
      setTotalAcumulado(0);
      return;
    }
    setHistoryLoading(true);
    const { ok, data } = await api.cargas.listar(campaniaId);
    setHistoryLoading(false);
    if (!ok) return;
    setUploads(data.cargas);
    setTotalAcumulado(data.total_acumulado);
  }, []);

  useEffect(() => {
    if (!selectedPeriodId) return;
    let cancelado = false;
    setCampaniaChecked(false);

    (async () => {
      const { ok, status, data } = await api.periodos.campaniaActiva(selectedPeriodId);
      if (cancelado) return;
      if (ok) {
        setCampania(data);
        await refreshHistory(data.id);
      } else {
        setCampania(null);
        setUploads([]);
        setTotalAcumulado(0);
        if (status !== 404) {
          setPeriodsError((data && data.error) || 'No se pudo verificar la campaña de este período.');
        }
      }
      setCampaniaChecked(true);
    })();

    return () => { cancelado = true; };
  }, [selectedPeriodId, refreshHistory]);

  const toggleVisibilidad = async (carga) => {
    setVisibilityPendingId(carga.id);
    const { ok, data } = await api.cargas.cambiarVisibilidad(carga.id, !carga.visible);
    setVisibilityPendingId(null);
    if (!ok) {
      setToast({ kind: 'error', message: (data && data.error) || 'No se pudo cambiar la visibilidad de la carga.' });
      return;
    }
    await refreshHistory(campania.id);
  };

  // ---- Eliminar carga ----
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    const { ok, data } = await api.cargas.eliminar(deleteTarget.id);
    setDeleting(false);
    if (!ok) {
      setDeleteError((data && data.error) || 'No se pudo eliminar la carga.');
      return;
    }
    setDeleteTarget(null);
    setToast({
      kind: 'success',
      message: `Carga eliminada: ${data.encuestas_eliminadas} encuestas y ${data.respuestas_eliminadas} respuestas borradas.`,
    });
    await refreshHistory(campania.id);
  };

  // ---- Toast ----
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const irASubirCsv = () => navigate(`/configuracion/carga/subir-csv?periodo_id=${selectedPeriodId}`);
  const irASubirVirtual = () => navigate(`/configuracion/carga/subir-virtual?periodo_id=${selectedPeriodId}`);

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);
  const selectedPeriodLabel = selectedPeriod ? selectedPeriod.codigo : '';
  const totalRowsLabel = totalAcumulado.toLocaleString('es-PE');
  const historyCountLabel = uploads.length + (uploads.length === 1 ? ' carga' : ' cargas');

  return (
    <>
      <div className={layoutStyles.pageHeader}>
        <span className={layoutStyles.eyebrow}>Panel académico</span>
        <h1 className={layoutStyles.pageTitle}>Carga de Información</h1>
      </div>

      {periodsError && (
        <div className={styles.errorBox} style={{ marginBottom: 20 }}>
          <AlertCircle size={20} className={styles.errorIcon} />
          <div className={styles.errorBody}>
            <p className={styles.errorTitle}>Ocurrió un problema</p>
            <p className={styles.errorText}>{periodsError}</p>
          </div>
        </div>
      )}

      <div className={layoutStyles.grid}>
        <div className={layoutStyles.leftCol}>
          {/* BLOQUE 1: Selección de período */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>1. Selecciona el período académico</h2>
                <p className={styles.cardSubtitle}>Todas las cargas y encuestas se almacenarán dentro del período seleccionado.</p>
              </div>
              <button type="button" className={layoutStyles.pillBtnOutline} onClick={toggleNewPeriodForm}>
                <Plus size={15} strokeWidth={2.5} />
                Nuevo período
              </button>
            </div>

            {showNewPeriodForm && (
              <div className={styles.newPeriodForm}>
                <div className={styles.formField} style={{ flex: '0 0 120px', minWidth: 100 }}>
                  <label className={styles.formLabel} htmlFor="newPeriodAnio">Año</label>
                  <input
                    id="newPeriodAnio"
                    type="number"
                    className={styles.formInput}
                    value={newPeriodAnio}
                    onChange={(e) => { setNewPeriodAnio(e.target.value); setNewPeriodError(''); }}
                    placeholder="2026"
                  />
                </div>
                <div className={styles.formField} style={{ flex: '0 0 100px', minWidth: 90 }}>
                  <label className={styles.formLabel} htmlFor="newPeriodSemestre">Semestre</label>
                  <select
                    id="newPeriodSemestre"
                    className={styles.formInput}
                    value={newPeriodSemestre}
                    onChange={(e) => setNewPeriodSemestre(e.target.value)}
                  >
                    {SEMESTRE_OPCIONES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formField} style={{ flex: '0 0 auto', minWidth: 'auto' }}>
                  <label className={styles.formLabel} htmlFor="newPeriodActivar">&nbsp;</label>
                  <label className={styles.checkboxLabel} htmlFor="newPeriodActivar">
                    <input
                      id="newPeriodActivar"
                      type="checkbox"
                      checked={newPeriodActivar}
                      onChange={(e) => setNewPeriodActivar(e.target.checked)}
                    />
                    Activar al crear
                  </label>
                </div>
                {newPeriodError && <div className={styles.formError} style={{ flexBasis: '100%' }}>{newPeriodError}</div>}
                <button type="button" className={styles.createBtn} onClick={createPeriod} disabled={creatingPeriod}>
                  {creatingPeriod ? <Loader2 size={16} className={styles.spin} /> : 'Crear'}
                </button>
                <button type="button" className={styles.btnSecondary} onClick={toggleNewPeriodForm}>Cancelar</button>
              </div>
            )}

            <div className={layoutStyles.periodSelectorRow}>
              <select
                value={selectedPeriodId || ''}
                onChange={(e) => setSelectedPeriodId(Number(e.target.value))}
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>{p.codigo}</option>
                ))}
              </select>
              {selectedPeriod && selectedPeriod.estado === 'EN_CURSO' && (
                <span className={`${styles.badge} ${styles.badgeActive}`}>
                  <span className={styles.badgeDot} />
                  En curso
                </span>
              )}
            </div>
          </div>

          {/* BLOQUE 2: ¿Qué deseas hacer? */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>2. ¿Qué deseas hacer?</h2>
            <p className={styles.cardSubtitle}>Elige cómo quieres registrar la información de encuestas.</p>

            <div className={layoutStyles.actionCards}>
              <div className={`${layoutStyles.actionCard} ${layoutStyles.actionCardCsv}`}>
                <UploadCloud size={28} strokeWidth={1.6} className={layoutStyles.actionCardIcon} />
                <h3 className={layoutStyles.actionCardTitle}>Subir archivo CSV</h3>
                <p className={layoutStyles.actionCardText}>Importa encuestas desde archivos CSV. El sistema validará el formato según el tipo de encuesta seleccionado.</p>
                <button type="button" className={`${layoutStyles.actionCardBtn} ${layoutStyles.actionCardBtnCsv}`} onClick={irASubirCsv}>
                  Subir CSV
                </button>
              </div>
              <div className={`${layoutStyles.actionCard} ${layoutStyles.actionCardFisica}`}>
                <span className={layoutStyles.comingSoonBadge}>Próximamente</span>
                <FileCheck2 size={28} strokeWidth={1.6} className={layoutStyles.actionCardIcon} />
                <h3 className={layoutStyles.actionCardTitle}>Registrar encuesta física</h3>
                <p className={layoutStyles.actionCardText}>Registra una encuesta física directamente en el sistema completando el formulario.</p>
                <button type="button" className={`${layoutStyles.actionCardBtn} ${layoutStyles.actionCardBtnFisica}`} disabled>
                  Nueva encuesta
                </button>
              </div>
              <div className={`${layoutStyles.actionCard} ${layoutStyles.actionCardVirtual}`}>
                <Monitor size={28} strokeWidth={1.6} className={layoutStyles.actionCardIcon} />
                <h3 className={layoutStyles.actionCardTitle}>Subir encuestas virtuales</h3>
                <p className={layoutStyles.actionCardText}>Importa resultados de encuestas virtuales realizadas en plataformas externas.</p>
                <button type="button" className={`${layoutStyles.actionCardBtn} ${layoutStyles.actionCardBtnVirtual}`} onClick={irASubirVirtual}>
                  Subir encuestas virtuales
                </button>
              </div>
            </div>
          </div>

          {/* BLOQUE 3: Información y formatos de CSV */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>3. Información y formatos de CSV</h2>
            <p className={styles.cardSubtitle}>Descarga la plantilla correspondiente antes de subir tus archivos.</p>

            <div className={layoutStyles.templateCards}>
              <div className={layoutStyles.templateCard}>
                <div className={layoutStyles.templateCardTitle}>Encuestas físicas (CSV)</div>
                <p className={layoutStyles.templateCardText}>Formato usado para registrar encuestas físicas importadas por archivo.</p>
                <div className={layoutStyles.templateCardLabel}>Formato requerido:</div>
                <div className={layoutStyles.templateCardLinkRow}>
                  <FileSpreadsheet size={18} strokeWidth={1.6} color="#1e6b39" />
                  <button type="button" className={layoutStyles.templateCardLink} onClick={descargarPlantillaFisica}>
                    Descargar plantilla física (CSV)
                  </button>
                </div>
                <div className={layoutStyles.templateCardCaption}>Ejemplo: fisicas_ejemplo.csv</div>
              </div>

              <div className={layoutStyles.templateCard}>
                <div className={layoutStyles.templateCardTitle}>Encuestas virtuales (CSV)</div>
                <p className={layoutStyles.templateCardText}>Formato usado para registrar resultados de encuestas virtuales.</p>
                <div className={layoutStyles.templateCardLabel}>Formato requerido:</div>
                <div className={layoutStyles.templateCardLinkRow}>
                  <FileSpreadsheet size={18} strokeWidth={1.6} color="#2f6fb0" />
                  <button type="button" className={layoutStyles.templateCardLink} onClick={descargarPlantillaVirtual}>
                    Descargar plantilla virtual (CSV)
                  </button>
                </div>
                <div className={layoutStyles.templateCardCaption}>Ejemplo: virtuales_ejemplo.csv</div>
              </div>
            </div>

            <div className={styles.infoBanner}>
              <Info size={18} className={styles.infoIcon} />
              <p className={styles.infoText}>
                Importante: Asegúrate de usar la plantilla correcta según el tipo de encuesta para evitar errores en la carga.
                Columnas esperadas (física): {EXPECTED_HEADERS.join(', ')}.
                Columnas esperadas (virtual): {EXPECTED_HEADERS_VIRTUAL.join(', ')}.
              </p>
            </div>
          </div>
        </div>

        <div className={layoutStyles.rightCol}>
          {/* Estado del período */}
          <div className={styles.card}>
            <div className={layoutStyles.stateCardHeader}>
              <div className={layoutStyles.stateCalendarIcon}><Calendar size={22} /></div>
              <div className={layoutStyles.stateHeaderLabel}>
                <span>Estado del período</span>
                {selectedPeriod && (
                  <span className={`${styles.badge} ${selectedPeriod.estado === 'EN_CURSO' ? styles.badgeActive : styles.badgeInactive}`}>
                    {selectedPeriod.estado === 'EN_CURSO' && <span className={styles.badgeDot} />}
                    {selectedPeriod.estado === 'EN_CURSO' ? 'En curso' : (selectedPeriod.estado === 'CERRADO' ? 'Cerrado' : 'Planificado')}
                  </span>
                )}
              </div>
            </div>
            <div className={layoutStyles.periodBigCode}>{selectedPeriodLabel || '—'}</div>
            <div className={layoutStyles.periodDatesCol}>
              <div>Fecha de inicio: <b>{selectedPeriod ? formatDateOnly(selectedPeriod.fecha_inicio) : '—'}</b></div>
              <div>Fecha de fin: <b>{selectedPeriod ? formatDateOnly(selectedPeriod.fecha_fin) : '—'}</b></div>
            </div>
            <button type="button" className={layoutStyles.linkBtn} onClick={() => setShowAllPeriods((v) => !v)}>
              {showAllPeriods ? 'Ocultar periodos' : 'Ver todos los periodos →'}
            </button>

            {showAllPeriods && (
              <div className={layoutStyles.allPeriodsWrap}>
                {periodsLoading && (
                  <div className={layoutStyles.periodListRow}><Loader2 size={14} className={styles.spin} /> Cargando períodos…</div>
                )}
                {!periodsLoading && periods.length === 0 && (
                  <div className={layoutStyles.periodListRow}>Aún no hay períodos académicos registrados.</div>
                )}
                {periods.map((p) => {
                  const active = p.estado === 'EN_CURSO';
                  return (
                    <div key={p.id} className={layoutStyles.periodListRow}>
                      <div className={layoutStyles.periodListInfo}>
                        <div className={layoutStyles.periodListNameRow}>
                          <span className={layoutStyles.periodListName}>{p.codigo}</span>
                          <span className={`${styles.badge} ${active ? styles.badgeActive : styles.badgeInactive}`}>
                            {active && <span className={styles.badgeDot} />}
                            {active ? 'En curso' : (p.estado === 'CERRADO' ? 'Cerrado' : 'Planificado')}
                          </span>
                        </div>
                        <div className={layoutStyles.periodListDates}>
                          {formatDateOnly(p.fecha_inicio)} – {formatDateOnly(p.fecha_fin)}
                        </div>
                      </div>
                      <div className={layoutStyles.periodListActions}>
                        {!active && (
                          <button
                            type="button"
                            className={styles.btnOutline}
                            onClick={() => activatePeriod(p.id)}
                            disabled={activatingId === p.id}
                          >
                            {activatingId === p.id ? <Loader2 size={14} className={styles.spin} /> : 'Activar'}
                          </button>
                        )}
                        <button
                          type="button"
                          className={layoutStyles.iconBtnSmall}
                          title="Editar fechas"
                          onClick={() => abrirEditarPeriodo(p)}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className={`${layoutStyles.iconBtnSmall} ${layoutStyles.iconBtnSmallDanger}`}
                          title="Eliminar período"
                          onClick={() => { setDeletePeriodTarget(p); setDeletePeriodError(''); }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historial de cargas */}
          <div className={styles.card}>
            <div className={layoutStyles.historyHeaderRow}>
              <h3>Historial de cargas</h3>
              {/* Sin destino funcional: esta lista ya muestra el historial
                  completo de la campaña (sin truncar ni paginar), así que no
                  hay una vista "más completa" a la que enlazar todavía. */}
              <span className={layoutStyles.footerLink} style={{ cursor: 'default', opacity: 0.5 }}>Ver todo</span>
            </div>
            <div className={layoutStyles.historyCaption}>
              {historyLoading ? <Loader2 size={12} className={styles.spin} /> : historyCountLabel}
            </div>

            <div className={styles.infoBanner}>
              <Layers size={18} className={styles.infoIcon} />
              <p className={styles.infoText}>
                <b>{totalRowsLabel} registros acumulados</b> en {selectedPeriodLabel}. Las cargas ocultas no se cuentan aquí.
              </p>
            </div>

            {uploads.length > 0 ? (
              <div>
                {uploads.map((u) => {
                  const tieneDetalle = u.filas_omitidas > 0 || u.filas_error > 0;
                  const expanded = expandedId === u.id;
                  return (
                    <div key={u.id}>
                      <div className={layoutStyles.historyListRow} style={!u.visible ? { opacity: 0.6 } : undefined}>
                        <div className={layoutStyles.historyFileIconBox}><FileText size={15} /></div>
                        <div className={layoutStyles.historyListInfo}>
                          <div className={layoutStyles.historyListNameRow}>
                            <span className={layoutStyles.historyListName} title={u.archivo_nombre}>{u.archivo_nombre}</span>
                            <span className={`${layoutStyles.historyBadgeModalidad} ${u.modalidad_carga === 'virtual' ? layoutStyles.historyBadgeModalidadVirtual : ''}`}>
                              {u.modalidad_carga === 'virtual' ? 'Virtual' : 'Física'}
                            </span>
                            {!u.visible && <span className={`${styles.badge} ${styles.badgeInactive}`}>Oculta</span>}
                          </div>
                          <div className={layoutStyles.historyListMeta}>
                            {formatDateTime(u.fecha_carga)} · {'+' + u.filas_insertadas.toLocaleString('es-PE')} registros
                            {u.filas_omitidas > 0 && ` · ${u.filas_omitidas} omitidas`}
                            {u.filas_error > 0 && ` · ${u.filas_error} error`}
                          </div>
                        </div>
                        <div className={layoutStyles.historyListActions}>
                          {tieneDetalle && (
                            <button
                              type="button"
                              className={layoutStyles.iconBtnSmall}
                              onClick={() => setExpandedId(expanded ? null : u.id)}
                              aria-label="Ver detalle"
                            >
                              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                          <button
                            type="button"
                            className={layoutStyles.iconBtnSmall}
                            title={u.visible ? 'Ocultar carga' : 'Mostrar carga'}
                            onClick={() => toggleVisibilidad(u)}
                            disabled={visibilityPendingId === u.id}
                          >
                            {visibilityPendingId === u.id
                              ? <Loader2 size={14} className={styles.spin} />
                              : (u.visible ? <Eye size={14} /> : <EyeOff size={14} />)}
                          </button>
                          <button
                            type="button"
                            className={`${layoutStyles.iconBtnSmall} ${layoutStyles.iconBtnSmallDanger}`}
                            title="Eliminar carga"
                            onClick={() => { setDeleteTarget(u); setDeleteError(''); }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {expanded && (
                        <div className={styles.detailPanel}>
                          {u.filas_error > 0 && (
                            <div className={styles.detailGroup}>
                              <span className={`${styles.detailBadge} ${styles.detailBadgeError}`}>{u.filas_error} error{u.filas_error === 1 ? '' : 'es'}</span>
                              <ul className={styles.detailList}>
                                {(u.errores || []).map((e, i) => (
                                  // eslint-disable-next-line react/no-array-index-key
                                  <li key={i}>Fila {e.fila}: {e.mensaje}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {u.filas_omitidas > 0 && (
                            <div className={styles.detailGroup}>
                              <span className={`${styles.detailBadge} ${styles.detailBadgeOmitted}`}>{u.filas_omitidas} omitida{u.filas_omitidas === 1 ? '' : 's'}</span>
                              <ul className={styles.detailList}>
                                {(u.omitidas || []).map((o, i) => (
                                  // eslint-disable-next-line react/no-array-index-key
                                  <li key={i}>Fila {o.fila}: {o.mensaje}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {u.advertencias && u.advertencias.length > 0 && (
                            <div className={styles.detailGroup}>
                              <span className={`${styles.detailBadge} ${styles.detailBadgeWarning}`}>{u.advertencias.length} advertencia{u.advertencias.length === 1 ? '' : 's'}</span>
                              <ul className={styles.detailList}>
                                {u.advertencias.map((a, i) => (
                                  // eslint-disable-next-line react/no-array-index-key
                                  <li key={i}>Fila {a.fila}: {a.mensaje}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.historyEmpty}>
                {historyLoading ? 'Cargando historial…' : 'Aún no se han cargado encuestas para esta campaña.'}
              </p>
            )}

            {uploads.length > 0 && (
              <span className={layoutStyles.footerLink} style={{ cursor: 'default', opacity: 0.5 }}>
                Ver historial completo →
              </span>
            )}
          </div>

          {/* Guía rápida */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Guía rápida</h3>
            <ul className={layoutStyles.guiaList}>
              <li className={layoutStyles.guiaItem}>
                <div className={layoutStyles.guiaIconBox}><List size={18} strokeWidth={1.6} /></div>
                <div className={layoutStyles.guiaInfo}>
                  <div className={layoutStyles.guiaTitle}>Pasos para subir encuestas</div>
                  <div className={layoutStyles.guiaSubtitle}>Aprende cómo importar tus archivos CSV correctamente</div>
                </div>
                <ChevronRight size={18} className={layoutStyles.guiaChevron} />
              </li>
              <li className={layoutStyles.guiaItem}>
                <div className={layoutStyles.guiaIconBox}><FileCheck2 size={18} strokeWidth={1.6} /></div>
                <div className={layoutStyles.guiaInfo}>
                  <div className={layoutStyles.guiaTitle}>Cómo registrar encuestas físicas</div>
                  <div className={layoutStyles.guiaSubtitle}>Guía para completar encuestas directamente en el sistema</div>
                </div>
                <ChevronRight size={18} className={layoutStyles.guiaChevron} />
              </li>
              <li className={layoutStyles.guiaItem}>
                <div className={layoutStyles.guiaIconBox}><Layers size={18} strokeWidth={1.6} /></div>
                <div className={layoutStyles.guiaInfo}>
                  <div className={layoutStyles.guiaTitle}>Tipos de CSV y formatos</div>
                  <div className={layoutStyles.guiaSubtitle}>Conoce los formatos aceptados y sus diferencias</div>
                </div>
                <ChevronRight size={18} className={layoutStyles.guiaChevron} />
              </li>
            </ul>
            <button type="button" className={layoutStyles.footerLink} style={{ marginTop: 4 }}>Ver guía completa →</button>
          </div>
        </div>
      </div>

      {/* Eliminar carga */}
      <Modal
        open={!!deleteTarget}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Eliminar carga"
        subtitle={deleteTarget ? deleteTarget.archivo_nombre : ''}
      >
        {deleteTarget && (
          <>
            <p className={styles.deleteWarningText}>
              Esto eliminará permanentemente esta carga y todo lo que insertó
              (<b>{deleteTarget.filas_insertadas} encuestas</b> y sus respuestas). No se puede deshacer.
            </p>
            {deleteError && <p className={styles.formError}>{deleteError}</p>}
            <div className={styles.previewActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancelar
              </button>
              <button type="button" className={styles.dangerBtn} onClick={confirmDelete} disabled={deleting}>
                {deleting ? <Loader2 size={16} className={styles.spin} /> : 'Sí, eliminar'}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Editar período */}
      <Modal
        open={!!editTarget}
        onClose={() => (editSaving ? null : setEditTarget(null))}
        title="Editar período"
        subtitle={editTarget ? editTarget.codigo : ''}
      >
        {editTarget && (
          <>
            <div className={styles.newPeriodForm} style={{ margin: 0 }}>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="editFechaInicio">Fecha de inicio</label>
                <input
                  id="editFechaInicio"
                  type="date"
                  className={styles.formInput}
                  value={editFechaInicio}
                  onChange={(e) => setEditFechaInicio(e.target.value)}
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor="editFechaFin">Fecha de fin</label>
                <input
                  id="editFechaFin"
                  type="date"
                  className={styles.formInput}
                  value={editFechaFin}
                  onChange={(e) => setEditFechaFin(e.target.value)}
                />
              </div>
            </div>
            {editError && <p className={styles.formError}>{editError}</p>}
            <div className={styles.previewActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setEditTarget(null)} disabled={editSaving}>
                Cancelar
              </button>
              <button type="button" className={styles.confirmBtn} onClick={guardarEdicionPeriodo} disabled={editSaving}>
                {editSaving ? <Loader2 size={16} className={styles.spin} /> : 'Guardar cambios'}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Eliminar período */}
      <Modal
        open={!!deletePeriodTarget}
        onClose={() => (deletingPeriod ? null : setDeletePeriodTarget(null))}
        title="Eliminar período"
        subtitle={deletePeriodTarget ? deletePeriodTarget.codigo : ''}
      >
        {deletePeriodTarget && (
          <>
            <p className={styles.deleteWarningText}>
              Esto eliminará permanentemente el período <b>{deletePeriodTarget.codigo}</b>. Solo es posible si no
              tiene cargas ni encuestas asociadas — de lo contrario, el sistema bloqueará la eliminación.
            </p>
            {deletePeriodError && <p className={styles.formError}>{deletePeriodError}</p>}
            <div className={styles.previewActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setDeletePeriodTarget(null)} disabled={deletingPeriod}>
                Cancelar
              </button>
              <button type="button" className={styles.dangerBtn} onClick={confirmarEliminarPeriodo} disabled={deletingPeriod}>
                {deletingPeriod ? <Loader2 size={16} className={styles.spin} /> : 'Sí, eliminar'}
              </button>
            </div>
          </>
        )}
      </Modal>

      {toast && (
        <div className={`${styles.toast} ${toast.kind === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.kind === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </>
  );
}
