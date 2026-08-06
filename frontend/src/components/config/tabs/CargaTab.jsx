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

// Mismo plazo que backend/src/controllers/cargas.js (PLAZO_ELIMINACION_DIAS)
// -- este chequeo en el frontend es solo cosmético (deshabilita el botón
// para no invitar al click); la validación real que de verdad protege los
// datos vive en el backend, que la vuelve a hacer sin confiar en esto.
const PLAZO_ELIMINACION_DIAS = 7;
const MENSAJE_PLAZO_ELIMINACION = `No se puede eliminar: han pasado más de ${PLAZO_ELIMINACION_DIAS} días desde la carga.`;

function haPasadoElPlazoDeEliminacion(fechaCarga) {
  if (!fechaCarga) return false;
  const antiguedadMs = Date.now() - new Date(fechaCarga).getTime();
  return antiguedadMs > PLAZO_ELIMINACION_DIAS * 24 * 60 * 60 * 1000;
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
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-stack-lg mt-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface mb-2 flex items-center gap-3">
             Carga de Información
             <span className="material-symbols-outlined text-primary opacity-70 text-[24px] cursor-help" title="Administra la carga de encuestas">info</span>
          </h1>
          <p className="text-base text-on-surface-variant max-w-2xl">Selecciona un período y registra los datos de encuestas físicas y virtuales.</p>
        </div>
      </div>

      {periodsError && (
        <div className="bg-error-container/20 border border-error/50 rounded-xl p-4 flex gap-3 text-error mb-4 items-center">
          <AlertCircle size={20} className="shrink-0" />
          <div>
            <p className="font-medium text-sm">Ocurrió un problema</p>
            <p className="text-sm opacity-80">{periodsError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 space-y-8">
          {/* BLOQUE 1: Selección de período */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl text-on-surface font-semibold mb-1">1. Selecciona el período académico</h2>
                <p className="text-sm text-on-surface-variant">Todas las cargas y encuestas se almacenarán dentro del período seleccionado.</p>
              </div>
              <button type="button" className="text-primary font-medium text-sm border border-primary/30 hover:bg-primary-container/20 rounded-lg px-4 py-2 flex items-center gap-2 transition-colors shrink-0" onClick={toggleNewPeriodForm}>
                <Plus size={16} strokeWidth={2.5} />
                Nuevo período
              </button>
            </div>

            {showNewPeriodForm && (
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wider" htmlFor="newPeriodAnio">Año</label>
                  <input
                    id="newPeriodAnio"
                    type="number"
                    className="glass-input w-full px-3 py-2 rounded-lg text-sm text-on-surface focus:outline-none"
                    value={newPeriodAnio}
                    onChange={(e) => { setNewPeriodAnio(e.target.value); setNewPeriodError(''); }}
                    placeholder="2026"
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wider" htmlFor="newPeriodSemestre">Semestre</label>
                  <select
                    id="newPeriodSemestre"
                    className="glass-input w-full px-3 py-2 rounded-lg text-sm text-on-surface focus:outline-none"
                    value={newPeriodSemestre}
                    onChange={(e) => setNewPeriodSemestre(e.target.value)}
                  >
                    {SEMESTRE_OPCIONES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    id="newPeriodActivar"
                    type="checkbox"
                    checked={newPeriodActivar}
                    onChange={(e) => setNewPeriodActivar(e.target.checked)}
                    className="w-4 h-4 text-primary rounded border-outline-variant focus:ring-primary"
                  />
                  <label className="text-sm text-on-surface-variant cursor-pointer" htmlFor="newPeriodActivar">
                    Activar al crear
                  </label>
                </div>
                {newPeriodError && <div className="w-full text-error text-sm font-medium">{newPeriodError}</div>}
                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button type="button" className="flex-1 sm:flex-none bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-container transition-colors disabled:opacity-50 flex justify-center items-center" onClick={createPeriod} disabled={creatingPeriod}>
                    {creatingPeriod ? <Loader2 size={16} className={styles.spin} /> : 'Crear'}
                  </button>
                  <button type="button" className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors" onClick={toggleNewPeriodForm}>Cancelar</button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <select
                className="glass-input px-4 py-2 rounded-lg text-lg font-semibold text-on-surface focus:outline-none min-w-[200px]"
                value={selectedPeriodId || ''}
                onChange={(e) => setSelectedPeriodId(Number(e.target.value))}
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>{p.codigo}</option>
                ))}
              </select>
              {selectedPeriod && selectedPeriod.estado === 'EN_CURSO' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-container/20 text-primary border border-primary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  En curso
                </span>
              )}
            </div>
          </div>

          {/* BLOQUE 2: ¿Qué deseas hacer? */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-xl text-on-surface font-semibold mb-1">2. ¿Qué deseas hacer?</h2>
            <p className="text-sm text-on-surface-variant mb-6">Elige cómo quieres registrar la información de encuestas.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface-container-lowest border border-primary/40 rounded-xl p-5 flex flex-col items-center text-center hover:border-primary transition-colors shadow-sm">
                <UploadCloud size={32} className="text-primary mb-3" strokeWidth={1.5} />
                <h3 className="font-medium text-on-surface mb-2">Subir archivo CSV</h3>
                <p className="text-xs text-on-surface-variant mb-4 flex-1">Importa encuestas físicas desde archivos CSV.</p>
                <button type="button" className="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-container transition-colors" onClick={irASubirCsv}>
                  Subir CSV
                </button>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl p-5 flex flex-col items-center text-center relative opacity-60">
                <span className="absolute top-2 right-2 bg-tertiary-container/20 text-tertiary text-[10px] font-bold px-2 py-0.5 rounded uppercase">Próximamente</span>
                <FileCheck2 size={32} className="text-on-surface-variant mb-3" strokeWidth={1.5} />
                <h3 className="font-medium text-on-surface mb-2">Encuesta física</h3>
                <p className="text-xs text-on-surface-variant mb-4 flex-1">Registra una encuesta física completando el formulario.</p>
                <button type="button" className="w-full py-2 bg-surface-container text-on-surface-variant rounded-lg text-sm font-medium cursor-not-allowed" disabled>
                  Nueva encuesta
                </button>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl p-5 flex flex-col items-center text-center hover:border-secondary transition-colors">
                <Monitor size={32} className="text-[#4b4b4b] mb-3" strokeWidth={1.5} />
                <h3 className="font-medium text-on-surface mb-2">Encuestas virtuales</h3>
                <p className="text-xs text-on-surface-variant mb-4 flex-1">Importa resultados de encuestas virtuales externas.</p>
                <button type="button" className="w-full py-2 bg-[#4b4b4b] text-white rounded-lg text-sm font-medium hover:bg-[#333333] transition-colors" onClick={irASubirVirtual}>
                  Subir encuestas
                </button>
              </div>
            </div>
          </div>

          {/* BLOQUE 3: Información y formatos de CSV */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-xl text-on-surface font-semibold mb-1">3. Información y formatos de CSV</h2>
            <p className="text-sm text-on-surface-variant mb-6">Descarga la plantilla correspondiente antes de subir tus archivos.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 flex gap-4 items-start">
                <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0">
                  <FileSpreadsheet size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="font-medium text-on-surface mb-1">Encuestas físicas</div>
                  <p className="text-xs text-on-surface-variant mb-3">Formato usado para registrar encuestas físicas importadas por archivo.</p>
                  <button type="button" className="text-primary text-sm font-medium hover:underline text-left" onClick={descargarPlantillaFisica}>
                    Descargar plantilla (CSV)
                  </button>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 flex gap-4 items-start">
                <div className="bg-[#2f6fb0]/10 p-2 rounded-lg text-[#2f6fb0] shrink-0">
                  <FileSpreadsheet size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="font-medium text-on-surface mb-1">Encuestas virtuales</div>
                  <p className="text-xs text-on-surface-variant mb-3">Formato usado para registrar resultados de encuestas virtuales.</p>
                  <button type="button" className="text-[#2f6fb0] text-sm font-medium hover:underline text-left" onClick={descargarPlantillaVirtual}>
                    Descargar plantilla (CSV)
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-tertiary-container/10 border border-tertiary/20 rounded-lg p-4 flex gap-3 text-tertiary text-sm">
              <Info size={18} className="shrink-0" />
              <p>
                Asegúrate de usar la plantilla correcta según el tipo de encuesta para evitar errores en la carga.<br />
                Columnas esperadas (física): <span className="font-medium opacity-80">{EXPECTED_HEADERS.join(', ')}</span>.<br />
                Columnas esperadas (virtual): <span className="font-medium opacity-80">{EXPECTED_HEADERS_VIRTUAL.join(', ')}</span>.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Estado del período */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary/10 text-primary p-2 rounded-lg">
                <Calendar size={20} strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">Estado del período</div>
                {selectedPeriod && (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <span className={`w-2 h-2 rounded-full ${selectedPeriod.estado === 'EN_CURSO' ? 'bg-primary' : 'bg-on-surface-variant/40'}`} />
                    {selectedPeriod.estado === 'EN_CURSO' ? 'En curso' : (selectedPeriod.estado === 'CERRADO' ? 'Cerrado' : 'Planificado')}
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-3xl font-bold text-on-surface mb-6">{selectedPeriodLabel || '—'}</div>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center text-sm border-b border-outline-variant/30 pb-2">
                <span className="text-on-surface-variant">Fecha de inicio</span>
                <span className="font-semibold text-on-surface">{selectedPeriod ? formatDateOnly(selectedPeriod.fecha_inicio) : '—'}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-outline-variant/30 pb-2">
                <span className="text-on-surface-variant">Fecha de fin</span>
                <span className="font-semibold text-on-surface">{selectedPeriod ? formatDateOnly(selectedPeriod.fecha_fin) : '—'}</span>
              </div>
            </div>

            <button type="button" className="text-primary text-sm font-medium hover:underline flex items-center justify-center w-full gap-1" onClick={() => setShowAllPeriods((v) => !v)}>
              {showAllPeriods ? 'Ocultar periodos' : 'Ver todos los periodos'} <ChevronDown size={16} className={`transition-transform ${showAllPeriods ? 'rotate-180' : ''}`} />
            </button>

            {showAllPeriods && (
              <div className="mt-4 pt-4 border-t border-outline-variant/30 space-y-3">
                {periodsLoading && (
                  <div className="text-sm text-primary flex items-center justify-center gap-2 py-4"><Loader2 size={16} className={styles.spin} /> Cargando períodos...</div>
                )}
                {!periodsLoading && periods.length === 0 && (
                  <div className="text-sm text-on-surface-variant text-center py-4">Aún no hay períodos académicos registrados.</div>
                )}
                {periods.map((p) => {
                  const active = p.estado === 'EN_CURSO';
                  return (
                    <div key={p.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-3 flex justify-between items-center group hover:border-primary/30 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-on-surface">{p.codigo}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${active ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                            {active ? 'En curso' : (p.estado === 'CERRADO' ? 'Cerrado' : 'Planificado')}
                          </span>
                        </div>
                        <div className="text-xs text-on-surface-variant">
                          {formatDateOnly(p.fecha_inicio)} – {formatDateOnly(p.fecha_fin)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!active && (
                          <button
                            type="button"
                            className="w-7 h-7 rounded flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
                            onClick={() => activatePeriod(p.id)}
                            disabled={activatingId === p.id}
                            title="Activar"
                          >
                            {activatingId === p.id ? <Loader2 size={14} className={styles.spin} /> : <CheckCircle2 size={14} />}
                          </button>
                        )}
                        <button
                          type="button"
                          className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
                          title="Editar fechas"
                          onClick={() => abrirEditarPeriodo(p)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="w-7 h-7 rounded flex items-center justify-center text-error hover:bg-error-container/20 transition-colors"
                          title="Eliminar período"
                          onClick={() => { setDeletePeriodTarget(p); setDeletePeriodError(''); }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historial de cargas */}
          <div className="glass-card rounded-xl p-6 flex flex-col h-[500px]">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-xl text-on-surface font-semibold">Historial de cargas</h3>
              <span className="text-xs text-on-surface-variant/50 cursor-default">Ver todo</span>
            </div>
            <div className="text-xs text-on-surface-variant mb-4">
              {historyLoading ? <Loader2 size={12} className={`${styles.spin} inline-block`} /> : historyCountLabel}
            </div>

            <div className="bg-primary-container/10 border border-primary/20 rounded-lg p-3 flex gap-3 text-primary text-sm mb-4 shrink-0">
              <Layers size={18} className="shrink-0" />
              <p className="text-xs leading-relaxed">
                <b className="font-bold">{totalRowsLabel} registros acumulados</b> en {selectedPeriodLabel}. Las cargas ocultas no se cuentan aquí.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {uploads.length > 0 ? (
                <div className="space-y-3">
                  {uploads.map((u) => {
                    const tieneDetalle = u.filas_omitidas > 0 || u.filas_error > 0;
                    const expanded = expandedId === u.id;
                    const bloqueadaPorPlazo = haPasadoElPlazoDeEliminacion(u.fecha_carga);
                    return (
                      <div key={u.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg overflow-hidden">
                        <div className={`p-3 flex items-start gap-3 ${!u.visible ? 'opacity-60' : ''}`}>
                          <div className="bg-surface-container p-2 rounded text-on-surface-variant shrink-0 mt-0.5">
                            <FileText size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium text-sm text-on-surface truncate max-w-[150px]" title={u.archivo_nombre}>{u.archivo_nombre}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${u.modalidad_carga === 'virtual' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
                                {u.modalidad_carga === 'virtual' ? 'Virtual' : 'Física'}
                              </span>
                              {!u.visible && <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant uppercase font-bold tracking-wider">Oculta</span>}
                            </div>
                            <div className="text-[11px] text-on-surface-variant leading-relaxed">
                              {formatDateTime(u.fecha_carga)}<br/>
                              <span className="font-medium text-primary">+{u.filas_insertadas.toLocaleString('es-PE')} registros</span>
                              {u.filas_omitidas > 0 && <span className="text-tertiary"> · {u.filas_omitidas} omitidas</span>}
                              {u.filas_error > 0 && <span className="text-error"> · {u.filas_error} error</span>}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            {tieneDetalle && (
                              <button
                                type="button"
                                className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container text-on-surface-variant transition-colors"
                                onClick={() => setExpandedId(expanded ? null : u.id)}
                                aria-label="Ver detalle"
                              >
                                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            )}
                            <button
                              type="button"
                              className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container text-on-surface-variant transition-colors"
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
                              className="w-7 h-7 flex items-center justify-center rounded hover:bg-error-container/20 text-error transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              title={bloqueadaPorPlazo ? MENSAJE_PLAZO_ELIMINACION : 'Eliminar carga'}
                              disabled={bloqueadaPorPlazo}
                              onClick={() => {
                                if (bloqueadaPorPlazo) return;
                                setDeleteTarget(u);
                                setDeleteError('');
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        {expanded && (
                          <div className="bg-surface-container-high/30 border-t border-outline-variant/20 p-3 text-xs">
                            {u.filas_error > 0 && (
                              <div className="mb-3">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-error-container/30 text-error mb-1">{u.filas_error} error{u.filas_error === 1 ? '' : 'es'}</span>
                                <ul className="pl-4 list-disc text-error/80 space-y-1">
                                  {(u.errores || []).map((e, i) => (
                                    <li key={i}>Fila {e.fila}: {e.mensaje}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {u.filas_omitidas > 0 && (
                              <div className="mb-3">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-tertiary-container/30 text-tertiary mb-1">{u.filas_omitidas} omitida{u.filas_omitidas === 1 ? '' : 's'}</span>
                                <ul className="pl-4 list-disc text-on-surface-variant space-y-1">
                                  {(u.omitidas || []).map((o, i) => (
                                    <li key={i}>Fila {o.fila}: {o.mensaje}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {u.advertencias && u.advertencias.length > 0 && (
                              <div>
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-tertiary-container/30 text-tertiary mb-1">{u.advertencias.length} advertencia{u.advertencias.length === 1 ? '' : 's'}</span>
                                <ul className="pl-4 list-disc text-on-surface-variant space-y-1">
                                  {u.advertencias.map((a, i) => (
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
                <div className="h-full flex items-center justify-center text-sm text-on-surface-variant/70 text-center px-4">
                  {historyLoading ? 'Cargando historial...' : 'Aún no se han cargado encuestas para esta campaña.'}
                </div>
              )}
            </div>
            
            {uploads.length > 0 && (
              <div className="pt-4 border-t border-outline-variant/30 mt-4 text-center shrink-0">
                <span className="text-xs text-primary font-medium opacity-50 cursor-default">
                  Ver historial completo →
                </span>
              </div>
            )}
          </div>

          {/* Guía rápida */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-xl text-on-surface font-semibold mb-4">Guía rápida</h3>
            <ul className="space-y-3 mb-4">
              <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container transition-colors cursor-pointer group border border-transparent hover:border-outline-variant/30">
                <div className="bg-primary/10 text-primary p-2 rounded-lg group-hover:scale-110 transition-transform"><List size={18} strokeWidth={1.5} /></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-on-surface mb-0.5 group-hover:text-primary transition-colors">Pasos para subir encuestas</div>
                  <div className="text-xs text-on-surface-variant">Aprende cómo importar tus archivos CSV correctamente</div>
                </div>
                <ChevronRight size={18} className="text-on-surface-variant/50 group-hover:text-primary transition-colors" />
              </li>
              <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container transition-colors cursor-pointer group border border-transparent hover:border-outline-variant/30">
                <div className="bg-primary/10 text-primary p-2 rounded-lg group-hover:scale-110 transition-transform"><FileCheck2 size={18} strokeWidth={1.5} /></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-on-surface mb-0.5 group-hover:text-primary transition-colors">Cómo registrar encuestas físicas</div>
                  <div className="text-xs text-on-surface-variant">Guía para completar encuestas directamente en el sistema</div>
                </div>
                <ChevronRight size={18} className="text-on-surface-variant/50 group-hover:text-primary transition-colors" />
              </li>
              <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container transition-colors cursor-pointer group border border-transparent hover:border-outline-variant/30">
                <div className="bg-primary/10 text-primary p-2 rounded-lg group-hover:scale-110 transition-transform"><Layers size={18} strokeWidth={1.5} /></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-on-surface mb-0.5 group-hover:text-primary transition-colors">Tipos de CSV y formatos</div>
                  <div className="text-xs text-on-surface-variant">Conoce los formatos aceptados y sus diferencias</div>
                </div>
                <ChevronRight size={18} className="text-on-surface-variant/50 group-hover:text-primary transition-colors" />
              </li>
            </ul>
            <button type="button" className="text-primary text-sm font-medium hover:underline w-full text-center">Ver guía completa →</button>
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
