import { Fragment, useEffect, useRef, useState, useCallback } from 'react';
import {
  Plus, Calendar, AlertCircle, FileText, UploadCloud, CheckCircle2, Layers,
  Eye, EyeOff, Trash2, Loader2, ChevronDown, ChevronUp, AlertTriangle, Ban,
} from 'lucide-react';
import Modal from '../common/Modal.jsx';
import { api } from '../../services/api.js';
import styles from './ConfigView.module.css';

const EXPECTED_HEADERS = ['Programa', 'Ciclo', 'Seccion', 'Aula', 'Codigo', 'Docente', 'Curso', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];

const SAMPLE_CSV = `Programa,Ciclo,Seccion,Aula,Codigo,Docente,Curso,P1,P2,P3,P4,P5,P6,P7,P8,P9
Ing. de Sistemas,V,1,301,20201234,Perez Gomez Juan,Base de Datos II,4,5,4,5,5,4,5,4,5
Ing. de Sistemas,V,1,301,20201234,Perez Gomez Juan,Base de Datos II,3,4,4,3,4,4,3,4,4
`;

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

export default function ConfigView() {
  const fileInputRef = useRef(null);

  // ---- Períodos ----
  const [periods, setPeriods] = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [periodsError, setPeriodsError] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [activatingId, setActivatingId] = useState(null);

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
    setUploadStage('idle');
    setShowSuccessBanner(false);

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

  // ---- Subida de CSV ----
  const [uploadStage, setUploadStage] = useState('idle'); // idle | preview | error | uploading
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingFileName, setPendingFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [pendingRowCount, setPendingRowCount] = useState(0);

  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successKind, setSuccessKind] = useState('ok'); // ok | warning

  const parseAndSet = (file, text) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setUploadStage('error');
      setShowSuccessBanner(false);
      setErrorMessage('El archivo está vacío o no contiene filas de datos.');
      return;
    }
    const headers = lines[0].split(',').map((h) => h.trim());
    const missing = EXPECTED_HEADERS.filter((h) => !headers.includes(h));
    const extra = headers.filter((h) => !EXPECTED_HEADERS.includes(h));
    if (missing.length > 0) {
      setUploadStage('error');
      setShowSuccessBanner(false);
      setErrorMessage(`Faltan columnas requeridas: ${missing.join(', ')}.${extra.length ? ` Columnas no reconocidas: ${extra.join(', ')}.` : ''}`);
      return;
    }
    const dataLines = lines.slice(1);
    setUploadStage('preview');
    setShowSuccessBanner(false);
    setPendingFile(file);
    setPendingFileName(file.name);
    setCsvHeaders(headers);
    setPreviewRows(dataLines.slice(0, 5).map((line) => ({ cells: line.split(',').map((c) => c.trim()) })));
    setPendingRowCount(dataLines.length);
  };

  const handleFile = (file) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadStage('error');
      setShowSuccessBanner(false);
      setErrorMessage(`"${file.name}" no es un archivo CSV válido. Solo se aceptan archivos .csv.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => parseAndSet(file, String(evt.target.result || ''));
    reader.onerror = () => {
      setUploadStage('error');
      setShowSuccessBanner(false);
      setErrorMessage('No se pudo leer el archivo. Intenta nuevamente.');
    };
    reader.readAsText(file);
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const triggerFilePicker = () => fileInputRef.current && fileInputRef.current.click();
  const onFileInputChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const useSampleFile = () => {
    const file = new File([SAMPLE_CSV], 'encuestas_ejemplo.csv', { type: 'text/csv' });
    parseAndSet(file, SAMPLE_CSV);
  };

  const resetUpload = () => {
    setUploadStage('idle');
    setErrorMessage('');
    setPreviewRows([]);
    setCsvHeaders([]);
    setPendingFile(null);
  };

  const confirmUpload = async () => {
    if (!pendingFile || !selectedPeriodId) return;
    setUploadStage('uploading');
    const { ok, status, data } = await api.cargas.subir(selectedPeriodId, pendingFile);

    if (status === 400 || status === 404 || status === 409) {
      setUploadStage('error');
      setErrorMessage((data && data.error) || 'No se pudo subir el archivo.');
      return;
    }
    if (!ok && status !== 422) {
      setUploadStage('error');
      setErrorMessage((data && data.error) || 'Error del servidor al procesar la carga.');
      return;
    }

    // 201 (completado / completado_con_errores) o 422 (todas las filas
    // fallaron): en ambos casos el backend devolvió el registro real de la
    // carga — se muestra su resultado en vez de tratarlo como un fallo de
    // red genérico.
    const carga = data;
    setUploadStage('idle');
    setPreviewRows([]);
    setCsvHeaders([]);
    setPendingFile(null);

    if (carga.estado === 'error') {
      setSuccessKind('warning');
      setSuccessMessage(`No se insertó ninguna fila de "${carga.archivo_nombre}": las ${carga.filas_error} filas fallaron. Revisa el detalle en el historial.`);
    } else {
      const partes = [`Se insertaron ${carga.filas_insertadas} filas`];
      if (carga.filas_omitidas > 0) partes.push(`${carga.filas_omitidas} omitidas por duplicado`);
      if (carga.filas_error > 0) partes.push(`${carga.filas_error} con error`);
      setSuccessKind(carga.filas_error > 0 ? 'warning' : 'ok');
      setSuccessMessage(`${partes.join(', ')}.`);
    }
    setShowSuccessBanner(true);
    setExpandedId(carga.id);
    await refreshHistory(campania.id);
  };

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);
  const selectedPeriodLabel = selectedPeriod ? selectedPeriod.codigo : '';
  const totalRowsLabel = totalAcumulado.toLocaleString('es-PE');
  const historyCountLabel = uploads.length + (uploads.length === 1 ? ' carga' : ' cargas');

  const puedeSubir = campaniaChecked && !!campania;

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <h1 className={styles.headerTitle}>Configuración</h1>
          <p className={styles.headerSubtitle}>Administra los períodos académicos y la carga de encuestas del sistema.</p>
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

        {/* BLOQUE 1: Periodos */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Períodos académicos</h2>
              <p className={styles.cardSubtitle}>Gestiona los ciclos de evaluación. Solo un período puede estar activo a la vez.</p>
            </div>
            <button type="button" className={styles.btnPrimary} onClick={toggleNewPeriodForm}>
              <Plus size={16} strokeWidth={2.5} />
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

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Estado</th>
                  <th>Fecha de inicio</th>
                  <th className={styles.actionCell}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {periodsLoading && (
                  <tr><td colSpan={4} className={styles.historyEmpty}><Loader2 size={16} className={styles.spin} /> Cargando períodos…</td></tr>
                )}
                {!periodsLoading && periods.length === 0 && (
                  <tr><td colSpan={4} className={styles.historyEmpty}>Aún no hay períodos académicos registrados.</td></tr>
                )}
                {periods.map((p) => {
                  const active = p.estado === 'EN_CURSO';
                  return (
                    <tr key={p.id} className={`${styles.periodRow} ${active ? styles.periodRowActive : ''}`}>
                      <td className={styles.periodCell}>
                        <div className={styles.periodCellInner}>
                          <span className={`${styles.periodIcon} ${active ? styles.periodIconActive : ''}`}>
                            <Calendar size={16} />
                          </span>
                          {p.codigo}
                        </div>
                      </td>
                      <td>
                        {active ? (
                          <span className={`${styles.badge} ${styles.badgeActive}`}>
                            <span className={styles.badgeDot} />
                            En curso
                          </span>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeInactive}`}>
                            {p.estado === 'CERRADO' ? 'Cerrado' : 'Planificado'}
                          </span>
                        )}
                      </td>
                      <td>{formatDateOnly(p.fecha_inicio)}</td>
                      <td className={styles.actionCell}>
                        {active ? (
                          <span className={styles.actionCurrentLabel}>Período en curso</span>
                        ) : (
                          <button
                            type="button"
                            className={styles.btnOutline}
                            onClick={() => activatePeriod(p.id)}
                            disabled={activatingId === p.id}
                          >
                            {activatingId === p.id ? <Loader2 size={14} className={styles.spin} /> : 'Activar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* BLOQUE 2: Carga de encuestas */}
        <div className={styles.card}>
          <div className={`${styles.cardHeader} ${styles.cardHeaderAlignStart}`}>
            <div>
              <h2 className={styles.cardTitle}>Carga de encuestas</h2>
              <p className={styles.cardSubtitle}>Importa resultados en formato CSV. Cada carga se acumula dentro de la campaña abierta del período seleccionado.</p>
            </div>
          </div>

          <div className={styles.uploadGrid}>
            <div className={styles.uploadColumn}>
              <div className={styles.periodTargetField}>
                <label className={styles.formLabel} htmlFor="targetPeriod">Período destino</label>
                <div className={styles.periodSelectWrap}>
                  <select
                    id="targetPeriod"
                    className={styles.periodSelect}
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

              {!campaniaChecked && (
                <div className={styles.emptyCampaignBox}>
                  <Loader2 size={18} className={styles.spin} />
                  <span>Verificando campaña de evaluación…</span>
                </div>
              )}

              {campaniaChecked && !campania && (
                <div className={styles.emptyCampaignBox}>
                  <Ban size={20} className={styles.emptyCampaignIcon} />
                  <p className={styles.emptyCampaignTitle}>Este período no tiene una campaña de evaluación abierta</p>
                  <p className={styles.emptyCampaignText}>Abre o crea una campaña de evaluación para "{selectedPeriodLabel}" antes de subir encuestas.</p>
                </div>
              )}

              {campaniaChecked && campania && uploadStage === 'idle' && (
                <div
                  className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''}`}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                >
                  <div className={styles.dropzoneIconBox}>
                    <UploadCloud size={24} strokeWidth={1.8} />
                  </div>
                  <p className={styles.dropzoneTitle}>Arrastra tu archivo CSV aquí</p>
                  <p className={styles.dropzoneText}>
                    o <button type="button" className={styles.dropzoneLink} onClick={triggerFilePicker}>selecciona desde tu equipo</button>
                  </p>
                  <p className={styles.dropzoneHint}>Solo archivos .csv · Máx. 50 MB</p>
                  <p className={styles.dropzoneSampleWrap}>
                    <button type="button" className={styles.dropzoneSampleLink} onClick={useSampleFile}>Usar archivo de ejemplo</button>
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className={styles.hiddenFileInput}
                    onChange={onFileInputChange}
                  />
                </div>
              )}

              {uploadStage === 'error' && (
                <div className={styles.errorBox}>
                  <AlertCircle size={20} className={styles.errorIcon} />
                  <div className={styles.errorBody}>
                    <p className={styles.errorTitle}>No se pudo procesar el archivo</p>
                    <p className={styles.errorText}>{errorMessage}</p>
                  </div>
                  <button type="button" className={styles.errorRetryBtn} onClick={resetUpload}>Intentar de nuevo</button>
                </div>
              )}

              {uploadStage === 'preview' && (
                <div className={styles.previewBox}>
                  <div className={styles.previewHeader}>
                    <div className={styles.previewFileInfo}>
                      <FileText size={16} />
                      <span className={styles.previewFileName}>{pendingFileName}</span>
                      <span className={styles.previewRowCount}>— {pendingRowCount} filas detectadas</span>
                    </div>
                    <span className={styles.previewMeta}>Previsualización de las primeras {previewRows.length} filas</span>
                  </div>
                  <div className={styles.previewTableWrap}>
                    <table className={styles.previewTable}>
                      <thead>
                        <tr>
                          {csvHeaders.map((h) => <th key={h}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <tr key={i}>
                            {row.cells.map((cell, j) => (
                              // eslint-disable-next-line react/no-array-index-key
                              <td key={j}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.previewActions}>
                    <button type="button" className={styles.btnSecondary} onClick={resetUpload}>Cancelar</button>
                    <button type="button" className={styles.confirmBtn} onClick={confirmUpload}>Confirmar carga</button>
                  </div>
                </div>
              )}

              {uploadStage === 'uploading' && (
                <div className={styles.emptyCampaignBox}>
                  <Loader2 size={20} className={styles.spin} />
                  <span>Procesando "{pendingFileName}"… puede tardar varios segundos.</span>
                </div>
              )}

              {showSuccessBanner && (
                <div className={successKind === 'warning' ? styles.warningBanner : styles.successBanner}>
                  {successKind === 'warning'
                    ? <AlertTriangle size={18} className={styles.warningIcon} />
                    : <CheckCircle2 size={18} className={styles.successIcon} />}
                  <span className={successKind === 'warning' ? styles.warningText : styles.successText}>{successMessage}</span>
                </div>
              )}
            </div>

            <div className={styles.historyPanel}>
              <div className={styles.historyHeader}>
                <h3 className={styles.historyTitle}>Historial de cargas — {selectedPeriodLabel}</h3>
                <span className={styles.historyCount}>
                  {historyLoading ? <Loader2 size={13} className={styles.spin} /> : historyCountLabel}
                </span>
              </div>

              <div className={styles.infoBanner}>
                <Layers size={18} className={styles.infoIcon} />
                <p className={styles.infoText}>
                  <b>{totalRowsLabel} registros acumulados</b> en {selectedPeriodLabel}. Las cargas ocultas no se cuentan aquí.
                </p>
              </div>

              {uploads.length > 0 ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Archivo</th>
                        <th>Fecha</th>
                        <th className={styles.actionCell}>Filas</th>
                        <th className={styles.actionCell}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploads.map((u) => {
                        const tieneDetalle = u.filas_omitidas > 0 || u.filas_error > 0;
                        const expanded = expandedId === u.id;
                        return (
                          <Fragment key={u.id}>
                            <tr className={`${styles.periodRow} ${!u.visible ? styles.historyRowHidden : ''}`}>
                              <td className={styles.historyFileCell}>
                                <div className={styles.historyFileInner}>
                                  <FileText size={14} className={styles.historyFileIcon} />
                                  <span className={styles.historyFileName} title={u.archivo_nombre}>{u.archivo_nombre}</span>
                                  {!u.visible && <span className={`${styles.badge} ${styles.badgeInactive}`}>Oculta</span>}
                                  {tieneDetalle && (
                                    <button
                                      type="button"
                                      className={styles.expandToggle}
                                      onClick={() => setExpandedId(expanded ? null : u.id)}
                                      aria-label="Ver detalle"
                                    >
                                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className={styles.historyDate}>{formatDateTime(u.fecha_carga)}</td>
                              <td className={styles.historyRows}>
                                {'+' + u.filas_insertadas.toLocaleString('es-PE')}
                                {u.filas_omitidas > 0 && <span className={styles.historyRowsSub}> · {u.filas_omitidas} omitidas</span>}
                                {u.filas_error > 0 && <span className={styles.historyRowsSubError}> · {u.filas_error} error</span>}
                              </td>
                              <td className={styles.actionCell}>
                                <div className={styles.rowActions}>
                                  <button
                                    type="button"
                                    className={styles.iconBtn}
                                    title={u.visible ? 'Ocultar carga' : 'Mostrar carga'}
                                    onClick={() => toggleVisibilidad(u)}
                                    disabled={visibilityPendingId === u.id}
                                  >
                                    {visibilityPendingId === u.id
                                      ? <Loader2 size={15} className={styles.spin} />
                                      : (u.visible ? <Eye size={15} /> : <EyeOff size={15} />)}
                                  </button>
                                  <button
                                    type="button"
                                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                    title="Eliminar carga"
                                    onClick={() => { setDeleteTarget(u); setDeleteError(''); }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {expanded && (
                              <tr>
                                <td colSpan={4} className={styles.detailCell}>
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
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      <tr>
                        <td className={styles.totalRowLabel}>Total acumulado</td>
                        <td className={styles.totalRowLabel} />
                        <td className={styles.totalRowValue} colSpan={2}>{totalRowsLabel}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.historyEmpty}>
                  {historyLoading ? 'Cargando historial…' : 'Aún no se han cargado encuestas para esta campaña.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

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

      {toast && (
        <div className={`${styles.toast} ${toast.kind === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.kind === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
