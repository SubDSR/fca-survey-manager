import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import JSZip from 'jszip';
import {
  ArrowLeft, ArrowRight, UploadCloud, FileText, AlertCircle, AlertTriangle, Loader2,
  CheckCircle2, XCircle, Ban, Layers, User, Building2, BookOpen, Users, GraduationCap,
  Pencil, RefreshCw, Eye, Archive,
} from 'lucide-react';
import { api } from '../../../services/api.js';
import DataTable from '../../common/DataTable.jsx';
import { EXPECTED_HEADERS_VIRTUAL, parseCsvToRows } from './cargaFormatos.js';
import styles from '../ConfigView.module.css';
import layoutStyles from './CargaTab.module.css';

const COLUMNA_RESPUESTA_NUMERO = 'Respuesta número';
const COLUMNA_COMENTARIO = 'Comentarios adicionales u observaciones sobre el desempeño del docente';
const COLUMNAS_PREGUNTAS = EXPECTED_HEADERS_VIRTUAL.filter((h) => h !== COLUMNA_RESPUESTA_NUMERO && h !== COLUMNA_COMENTARIO);
const COLUMNAS_TABLA = [
  { key: COLUMNA_RESPUESTA_NUMERO, label: 'N°' },
  ...COLUMNAS_PREGUNTAS.map((h) => ({ key: h, label: h })),
  { key: COLUMNA_COMENTARIO, label: 'Comentario (no se guarda)' },
];
const FILAS_PREVIEW_CORTA = 3;

function formatearTamano(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Página dedicada de "Subir encuestas virtuales". A diferencia de la
// versión anterior (elegir Docente→Curso ANTES de soltar el archivo), acá
// el archivo se suelta primero: al soltarlo se detecta Docente/Curso/
// Ciclo/Sección automáticamente a partir del NOMBRE del archivo (ver
// backend/src/services/detectarContextoVirtual.js) y se muestran 5 boxes
// con lo detectado. Si la detección no alcanza confianza suficiente en
// algún campo (o el ciclo/sección del nombre no coincide con el real de la
// BD), el badge queda en ámbar y el botón "Continuar con la carga" sigue
// deshabilitado hasta que el usuario corrija vía "Editar datos" -- que
// reabre el MISMO selector manual (Docente -> Curso) que ya existía en la
// versión anterior, no un editor de texto libre: la detección solo
// PRELLENA ese selector, nunca inserta nada por sí sola.
//
// El dropzone también acepta un .zip con varios CSV virtuales (carga por
// lote, ver tarea correspondiente) -- SIN tocar nada del flujo de un solo
// .csv de arriba: es una rama enteramente aparte (stage 'preview-lote' /
// 'procesando-lote' / 'resultado-lote') que reutiliza el mismo dropzone,
// pero cada CSV dentro del ZIP detecta su PROPIO docente/curso en el
// servidor (backend/src/controllers/cargas.js, subirLoteVirtual) -- acá no
// hay selector manual por archivo: si la detección de alguno no alcanza
// confianza suficiente, ese archivo queda "pendiente de revisión" en el
// resumen final y se resuelve subiéndolo de nuevo, individual, por esta
// misma página. El listado de archivos del ZIP en el preview (JSZip) es
// solo un adelanto para el usuario -- el servidor vuelve a extraer y
// filtrar el ZIP de forma autoritativa antes de procesar nada.
export default function SubirVirtualPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const csvFileInputRef = useRef(null);
  const zipFileInputRef = useRef(null);

  const [periodo, setPeriodo] = useState(null);
  const [periodoLoading, setPeriodoLoading] = useState(true);
  const [periodoError, setPeriodoError] = useState('');
  const [campania, setCampania] = useState(null);
  const [campaniaChecked, setCampaniaChecked] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setPeriodoLoading(true);
    api.periodos.listar().then(({ ok, data }) => {
      if (cancelado) return;
      setPeriodoLoading(false);
      if (!ok) {
        setPeriodoError((data && data.error) || 'No se pudo cargar el período académico.');
        return;
      }
      const idBuscado = Number(searchParams.get('periodo_id'));
      const encontrado = (idBuscado && data.find((p) => p.id === idBuscado))
        || data.find((p) => p.estado === 'EN_CURSO')
        || data[0]
        || null;
      setPeriodo(encontrado);
      if (!encontrado) setPeriodoError('No hay períodos académicos registrados todavía.');
    });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!periodo) return undefined;
    let cancelado = false;
    setCampaniaChecked(false);
    api.periodos.campaniaActiva(periodo.id).then(({ ok, status, data }) => {
      if (cancelado) return;
      if (ok) {
        setCampania(data);
      } else {
        setCampania(null);
        if (status !== 404) setPeriodoError((data && data.error) || 'No se pudo verificar la campaña de este período.');
      }
      setCampaniaChecked(true);
    });
    return () => { cancelado = true; };
  }, [periodo]);

  // ---- Subida / archivo ----
  // idle | preview | uploading | procesando | resultado | error -- ver el
  // mismo patrón (y su comentario) en SubirCsvPage.jsx.
  const [stage, setStage] = useState('idle');
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [isDraggingZip, setIsDraggingZip] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingFileName, setPendingFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [cargaEnProceso, setCargaEnProceso] = useState(null);
  const [showAllRows, setShowAllRows] = useState(false);

  // ---- Carga por lote (ZIP con varios CSV virtuales) -- estado propio,
  // en paralelo al de arriba, para no tocar el flujo de un solo .csv. ----
  const [pendingZipFile, setPendingZipFile] = useState(null);
  const [zipEntradas, setZipEntradas] = useState([]); // [{ nombre, valido }] -- preview, solo informativo
  const [loteEnProceso, setLoteEnProceso] = useState(null); // respuesta de subirLoteVirtual / obtenerLote

  // ---- Detección automática de contexto (a partir del nombre del archivo) ----
  const [deteccion, setDeteccion] = useState(null); // respuesta cruda de detectar-contexto-virtual
  const [deteccionLoading, setDeteccionLoading] = useState(false);

  // ---- Contexto confirmado (auto o manual) -- mismo shape que usa la
  // subida real (api.cargas.subirVirtual) y el selector manual. ----
  const [virtualDocente, setVirtualDocente] = useState(null);
  const [virtualCurso, setVirtualCurso] = useState(null);

  // ---- Selector manual ("Editar datos") -- mismo componente ya construido
  // en la tarea de carga virtual, ahora reutilizado también para corregir
  // una detección dudosa en vez de solo para elegir desde cero. ----
  const [editandoContexto, setEditandoContexto] = useState(false);
  const [docenteSearch, setDocenteSearch] = useState('');
  const [docenteResults, setDocenteResults] = useState([]);
  const [docenteSearching, setDocenteSearching] = useState(false);
  const [docenteEditable, setDocenteEditable] = useState(null); // ficha completa (con cursos) mientras se edita
  const [docenteEditableLoading, setDocenteEditableLoading] = useState(false);

  useEffect(() => {
    if (!editandoContexto || docenteEditable) return undefined;
    const term = docenteSearch.trim();
    if (term.length < 2) {
      setDocenteResults([]);
      return undefined;
    }
    setDocenteSearching(true);
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const data = await api.docentes.listar({ activo: true, search: term });
        if (!cancelado) setDocenteResults(data);
      } catch {
        if (!cancelado) setDocenteResults([]);
      } finally {
        if (!cancelado) setDocenteSearching(false);
      }
    }, 300);
    return () => { cancelado = true; clearTimeout(t); };
  }, [docenteSearch, editandoContexto, docenteEditable]);

  const seleccionarDocenteEditable = async (docente) => {
    setDocenteResults([]);
    setDocenteEditableLoading(true);
    try {
      const data = await api.docentes.obtener(docente.id);
      setDocenteEditable(data);
    } catch {
      setDocenteEditable({ ...docente, cursos: [] });
    } finally {
      setDocenteEditableLoading(false);
    }
  };

  const abrirEdicionContexto = async () => {
    setEditandoContexto(true);
    setDocenteSearch('');
    setDocenteResults([]);
    const idDocenteConocido = virtualDocente?.id || deteccion?.docente?.id;
    if (idDocenteConocido) {
      setDocenteEditableLoading(true);
      try {
        const data = await api.docentes.obtener(idDocenteConocido);
        setDocenteEditable(data);
      } catch {
        setDocenteEditable(null);
      } finally {
        setDocenteEditableLoading(false);
      }
    } else {
      setDocenteEditable(null);
    }
  };

  const cambiarDocenteEditable = () => {
    setDocenteEditable(null);
    setDocenteSearch('');
    setDocenteResults([]);
  };

  const elegirCursoEditable = (curso) => {
    setVirtualDocente(docenteEditable);
    setVirtualCurso(curso);
    setEditandoContexto(false);
    setDocenteEditable(null);
  };

  const parseAndSet = async (file, text) => {
    const { headers, rows } = parseCsvToRows(text);
    if (rows.length === 0) {
      setStage('error');
      setErrorMessage('El archivo está vacío o no contiene filas de datos.');
      return;
    }
    const missing = EXPECTED_HEADERS_VIRTUAL.filter((h) => !headers.includes(h));
    const extra = headers.filter((h) => !EXPECTED_HEADERS_VIRTUAL.includes(h));
    if (missing.length > 0) {
      setStage('error');
      setErrorMessage(`Faltan columnas requeridas: ${missing.join(', ')}.${extra.length ? ` Columnas no reconocidas: ${extra.join(', ')}.` : ''}`);
      return;
    }

    setParsedRows(rows);
    setPendingFile(file);
    setPendingFileName(file.name);
    setResultado(null);
    setShowAllRows(false);
    setVirtualDocente(null);
    setVirtualCurso(null);
    setEditandoContexto(false);
    setDeteccion(null);
    setStage('preview');

    setDeteccionLoading(true);
    const { ok, data } = await api.cargas.detectarContextoVirtual(file.name);
    setDeteccionLoading(false);
    if (!ok) return; // deja los boxes vacíos -- el usuario siempre puede usar "Editar datos"
    setDeteccion(data);
    if (data.badge === 'success' && data.curso_grupo_docente) {
      setVirtualDocente({ id: data.docente.id, nombre_completo: data.docente.nombre });
      setVirtualCurso({
        curso_grupo_docente_id: data.curso_grupo_docente.curso_grupo_docente_id,
        asignatura: data.curso_grupo_docente.asignatura,
        programa: data.curso_grupo_docente.programa,
        ciclo: data.curso_grupo_docente.ciclo,
        seccion: data.curso_grupo_docente.seccion,
      });
    }
  };

  // Adelanto informativo del contenido del ZIP (JSZip, client-side) para el
  // preview "1. Archivos detectados en el lote" -- el filtro acá es un
  // espejo best-effort del real (extraerCsvsDeZip en el backend), que es el
  // que de verdad decide qué se procesa cuando se confirma la carga.
  const handleZipFile = async (file) => {
    setPendingZipFile(file);
    setPendingFileName(file.name);
    setZipEntradas([]);
    setLoteEnProceso(null);
    setStage('preview-lote');

    try {
      const zip = await JSZip.loadAsync(file);
      const entradas = [];
      zip.forEach((rutaRelativa, entry) => {
        if (entry.dir) return;
        const base = rutaRelativa.split('/').pop();
        if (!base || base.startsWith('.') || rutaRelativa.includes('__MACOSX/')) return;
        entradas.push({ nombre: rutaRelativa, valido: base.toLowerCase().endsWith('.csv') });
      });
      setZipEntradas(entradas);
      if (entradas.filter((e) => e.valido).length === 0) {
        setStage('error');
        setErrorMessage('El ZIP no contiene ningún archivo .csv.');
      }
    } catch (err) {
      setStage('error');
      setErrorMessage(`No se pudo leer el ZIP: ${err.message}`);
    }
  };

  const handleFile = (file) => {
    const nombre = file.name.toLowerCase();
    if (nombre.endsWith('.zip')) {
      handleZipFile(file);
      return;
    }
    if (!nombre.endsWith('.csv')) {
      setStage('error');
      setErrorMessage(`"${file.name}" no es un archivo válido. Solo se aceptan archivos .csv o .zip.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => parseAndSet(file, String(evt.target.result || ''));
    reader.onerror = () => {
      setStage('error');
      setErrorMessage('No se pudo leer el archivo. Intenta nuevamente.');
    };
    reader.readAsText(file);
  };

  const onDragOverCsv = (e) => { e.preventDefault(); setIsDraggingCsv(true); };
  const onDragLeaveCsv = (e) => { e.preventDefault(); setIsDraggingCsv(false); };
  const onDropCsv = (e) => {
    e.preventDefault();
    setIsDraggingCsv(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        setStage('error');
        setErrorMessage(`Por favor, arrastra los archivos .zip en el cuadro de "Subir carga por lote".`);
        return;
      }
      handleFile(file);
    }
  };

  const onDragOverZip = (e) => { e.preventDefault(); setIsDraggingZip(true); };
  const onDragLeaveZip = (e) => { e.preventDefault(); setIsDraggingZip(false); };
  const onDropZip = (e) => {
    e.preventDefault();
    setIsDraggingZip(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.csv')) {
        setStage('error');
        setErrorMessage(`Por favor, arrastra los archivos .csv individuales en el cuadro de "Subir encuesta individual".`);
        return;
      }
      handleFile(file);
    }
  };

  const triggerCsvFilePicker = () => csvFileInputRef.current && csvFileInputRef.current.click();
  const triggerZipFilePicker = () => zipFileInputRef.current && zipFileInputRef.current.click();
  
  const onFileInputChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const resetUpload = () => {
    setStage('idle');
    setErrorMessage('');
    setParsedRows([]);
    setPendingFile(null);
    setResultado(null);
    setCargaEnProceso(null);
    setDeteccion(null);
    setVirtualDocente(null);
    setVirtualCurso(null);
    setEditandoContexto(false);
    setPendingZipFile(null);
    setZipEntradas([]);
    setLoteEnProceso(null);
  };

  const confirmUpload = async () => {
    if (!pendingFile || !periodo || !virtualCurso) return;
    setStage('uploading');
    const { ok, status, data } = await api.cargas.subirVirtual(periodo.id, virtualCurso.curso_grupo_docente_id, pendingFile);

    if (status === 400 || status === 404 || status === 409) {
      setStage('error');
      setErrorMessage((data && data.error) || 'No se pudo subir el archivo.');
      return;
    }
    if (!ok) {
      setStage('error');
      setErrorMessage((data && data.error) || 'Error del servidor al procesar la carga.');
      return;
    }

    // 202: registrada con estado='procesando' -- de acá en más, polling.
    setCargaEnProceso(data);
    setStage('procesando');
  };

  const cargaEnProcesoId = cargaEnProceso?.id;
  useEffect(() => {
    if (stage !== 'procesando' || !cargaEnProcesoId) return undefined;
    let cancelado = false;

    const consultar = async () => {
      const { ok, data } = await api.cargas.obtener(cargaEnProcesoId);
      if (cancelado || !ok) return;
      setCargaEnProceso(data);
      if (data.estado === 'procesando') return;

      if (data.estado === 'error' && data.mensaje_error) {
        setStage('error');
        setErrorMessage(data.mensaje_error);
        return;
      }
      setResultado(data);
      setStage('resultado');
    };

    consultar();
    const intervalo = setInterval(consultar, 3000);
    return () => { cancelado = true; clearInterval(intervalo); };
  }, [stage, cargaEnProcesoId]);

  const confirmUploadLote = async () => {
    if (!pendingZipFile || !periodo) return;
    setStage('uploading');
    const { ok, status, data } = await api.cargas.subirLoteVirtual(periodo.id, pendingZipFile);

    if (status === 400 || status === 404 || status === 409) {
      setStage('error');
      setErrorMessage((data && data.error) || 'No se pudo subir el ZIP.');
      return;
    }
    if (!ok) {
      setStage('error');
      setErrorMessage((data && data.error) || 'Error del servidor al procesar el lote.');
      return;
    }

    // 202: una fila de carga_csv por archivo, todas en 'procesando' -- de
    // acá en más, polling a GET /api/cargas/lote/:loteId (mismo espíritu
    // que el polling de una carga individual, pero contando archivos en vez
    // de filas).
    setLoteEnProceso(data);
    setStage('procesando-lote');
  };

  const loteId = loteEnProceso?.lote_id;
  useEffect(() => {
    if (stage !== 'procesando-lote' || !loteId) return undefined;
    let cancelado = false;

    const consultar = async () => {
      const { ok, data } = await api.cargas.obtenerLote(loteId);
      if (cancelado || !ok) return;
      setLoteEnProceso(data);
      const todasTerminadas = data.cargas.every((c) => c.estado !== 'procesando');
      if (todasTerminadas) setStage('resultado-lote');
    };

    consultar();
    const intervalo = setInterval(consultar, 3000);
    return () => { cancelado = true; clearInterval(intervalo); };
  }, [stage, loteId]);

  const erroresPorFila = useMemo(() => new Map((resultado?.errores || []).map((e) => [e.fila, e.mensaje])), [resultado]);
  const archivosValidosZip = useMemo(() => zipEntradas.filter((e) => e.valido), [zipEntradas]);

  const columnasTabla = stage === 'resultado'
    ? [{ key: '_estado', label: 'Estado' }, ...COLUMNAS_TABLA]
    : COLUMNAS_TABLA;

  const filasVisibles = stage === 'resultado' || showAllRows ? parsedRows : parsedRows.slice(0, FILAS_PREVIEW_CORTA);

  const renderRow = (row, idx) => {
    const numeroFila = idx + 2;
    const esError = stage === 'resultado' && erroresPorFila.has(numeroFila);
    const estadoFila = stage === 'resultado' ? (esError ? 'error' : 'insertada') : null;
    return (
      // eslint-disable-next-line react/no-array-index-key
      <tr key={idx} className={estadoFila ? layoutStyles[`rowStatus_${estadoFila}`] : undefined} title={esError ? erroresPorFila.get(numeroFila) : undefined}>
        {stage === 'resultado' && (
          <td>
            {esError
              ? <XCircle size={14} className={layoutStyles.rowStatusIconError} />
              : <CheckCircle2 size={14} className={layoutStyles.rowStatusIconOk} />}
          </td>
        )}
        {COLUMNAS_TABLA.map((c) => (
          <td key={c.key} className={c.key === COLUMNA_COMENTARIO ? layoutStyles.discardedCell : undefined}>
            {row[c.key]}
          </td>
        ))}
      </tr>
    );
  };

  const periodoLabel = periodo ? periodo.codigo : '—';

  // Valores a mostrar en los 5 boxes: si ya hay un contexto confirmado
  // (auto o manual) se muestran esos -- son los reales, de la BD. Si no,
  // se muestra lo detectado en bruto (aunque no alcance confianza) como
  // punto de partida para "Editar datos", nunca como un hecho confirmado.
  const mostrarDocente = virtualDocente?.nombre_completo || deteccion?.docente?.nombre || null;
  const mostrarPrograma = virtualCurso?.programa || deteccion?.curso_grupo_docente?.programa || null;
  const mostrarCurso = virtualCurso?.asignatura || deteccion?.curso?.nombre || null;
  const mostrarSeccion = virtualCurso?.seccion ?? deteccion?.seccion_detectada ?? null;
  const mostrarCiclo = virtualCurso?.ciclo ?? deteccion?.ciclo_detectado ?? null;

  const contextoConfirmado = !!virtualCurso;
  const badgeSeccion1 = editandoContexto ? 'editing' : (contextoConfirmado ? 'success' : 'warning');

  return (
    <>
      <div className={layoutStyles.subPageHeader}>
        <button type="button" className={layoutStyles.backLink} onClick={() => navigate('/configuracion/carga')}>
          <ArrowLeft size={16} /> Volver
        </button>
        <span className={layoutStyles.breadcrumb}>Configuración · Carga de Información · Subir Encuestas Virtuales</span>
        <h1 className={layoutStyles.pageTitle}>Subir Encuestas Virtuales</h1>
      </div>

      {periodoLoading && (
        <div className={styles.emptyCampaignBox}><Loader2 size={18} className={styles.spin} /> Cargando período académico…</div>
      )}

      {!periodoLoading && periodoError && !periodo && (
        <div className={styles.errorBox}><AlertCircle size={20} className={styles.errorIcon} /><div className={styles.errorBody}><p className={styles.errorText}>{periodoError}</p></div></div>
      )}

      {!periodoLoading && periodo && (
        <>
          <div className={layoutStyles.activePeriodBanner}>
            <Layers size={16} />
            <span>
              Vas a cargar encuestas en el período <b>{periodoLabel}</b>
              {campaniaChecked && campania && ` · Campaña: ${campania.estado === 'ABIERTA' ? 'abierta' : 'en borrador'}`}
            </span>
          </div>

          {periodoError && (
            <div className={styles.errorBox} style={{ marginBottom: 16 }}>
              <AlertCircle size={20} className={styles.errorIcon} />
              <div className={styles.errorBody}><p className={styles.errorText}>{periodoError}</p></div>
            </div>
          )}

          {!campaniaChecked && (
            <div className={styles.card}>
              <div className={styles.emptyCampaignBox}><Loader2 size={18} className={styles.spin} /> Verificando campaña de evaluación…</div>
            </div>
          )}

          {campaniaChecked && !campania && (
            <div className={styles.card}>
              <div className={styles.emptyCampaignBox}>
                <Ban size={20} className={styles.emptyCampaignIcon} />
                <p className={styles.emptyCampaignTitle}>Este período no tiene una campaña de evaluación abierta</p>
                <p className={styles.emptyCampaignText}>Abre o crea una campaña de evaluación para &quot;{periodoLabel}&quot; antes de subir encuestas.</p>
              </div>
            </div>
          )}

          {campaniaChecked && campania && stage === 'idle' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', margin: 0, height: '100%' }}>
                <div
                  className={`${styles.dropzone} ${isDraggingCsv ? styles.dropzoneDragging : ''}`}
                  onDragOver={onDragOverCsv}
                  onDragLeave={onDragLeaveCsv}
                  onDrop={onDropCsv}
                >
                  <div className={styles.dropzoneIconBox}><FileText size={24} strokeWidth={1.8} /></div>
                  <p className={styles.dropzoneTitle}>Subir encuesta individual (CSV)</p>
                  <p className={styles.dropzoneText}>
                    Arrastra tu archivo CSV aquí o <button type="button" className={styles.dropzoneLink} onClick={triggerCsvFilePicker}>selecciona desde tu equipo</button>
                  </p>
                  <p className={styles.dropzoneHint}>
                    Un archivo .csv (máx. 50 MB) — el docente, curso, ciclo y sección se detectan automáticamente de su nombre.
                  </p>
                  <input ref={csvFileInputRef} type="file" accept=".csv" className={styles.hiddenFileInput} onChange={onFileInputChange} />
                </div>
              </div>

              <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', margin: 0, height: '100%' }}>
                <div
                  className={`${styles.dropzone} ${isDraggingZip ? styles.dropzoneDragging : ''}`}
                  onDragOver={onDragOverZip}
                  onDragLeave={onDragLeaveZip}
                  onDrop={onDropZip}
                >
                  <div className={styles.dropzoneIconBox}><Archive size={24} strokeWidth={1.8} /></div>
                  <p className={styles.dropzoneTitle}>Subir carga por lote (ZIP)</p>
                  <p className={styles.dropzoneText}>
                    Arrastra tu archivo ZIP aquí o <button type="button" className={styles.dropzoneLink} onClick={triggerZipFilePicker}>selecciona desde tu equipo</button>
                  </p>
                  <p className={styles.dropzoneHint}>
                    Un archivo .zip con varios .csv (máx. 200 MB) — cada CSV detectará su propio contexto automáticamente.
                  </p>
                  <input ref={zipFileInputRef} type="file" accept=".zip" className={styles.hiddenFileInput} onChange={onFileInputChange} />
                </div>
              </div>
            </div>
          )}

          {stage === 'error' && (
            <div className={styles.card}>
              <div className={styles.errorBox}>
                <AlertCircle size={20} className={styles.errorIcon} />
                <div className={styles.errorBody}>
                  <p className={styles.errorTitle}>No se pudo procesar el archivo</p>
                  <p className={styles.errorText}>{errorMessage}</p>
                </div>
                <button type="button" className={styles.errorRetryBtn} onClick={resetUpload}>Intentar de nuevo</button>
              </div>
            </div>
          )}

          {stage === 'uploading' && (
            <div className={styles.card}>
              <div className={styles.emptyCampaignBox}>
                <Loader2 size={20} className={styles.spin} />
                <span>Subiendo &quot;{pendingFileName}&quot;…</span>
              </div>
            </div>
          )}

          {stage === 'procesando' && cargaEnProceso && (() => {
            const total = cargaEnProceso.filas_leidas || 0;
            const procesadas = Math.min(cargaEnProceso.filas_procesadas || 0, total);
            const porcentaje = total > 0 ? Math.round((procesadas / total) * 100) : 0;
            return (
              <div className={styles.card}>
                <div className={styles.emptyCampaignBox}>
                  <Loader2 size={20} className={styles.spin} />
                  <span>Procesando &quot;{pendingFileName}&quot;…</span>
                  <div className={layoutStyles.progressBarTrack}>
                    <div className={layoutStyles.progressBarFill} style={{ width: `${porcentaje}%` }} />
                  </div>
                  <span className={layoutStyles.progressCaption}>
                    {procesadas.toLocaleString('es-PE')} de {total.toLocaleString('es-PE')} filas procesadas ({porcentaje}%)
                  </span>
                </div>
              </div>
            );
          })()}

          {stage === 'preview-lote' && (
            <>
              <div className={styles.card}>
                <div className={layoutStyles.detectionHeaderRow}>
                  <div>
                    <h2 className={styles.cardTitle}>1. Archivos detectados en el lote</h2>
                    <p className={styles.cardSubtitle}>
                      {archivosValidosZip.length} archivo{archivosValidosZip.length === 1 ? '' : 's'} .csv en &quot;{pendingFileName}&quot;.
                      Cada uno detectará su propio docente y curso al procesarse — no hace falta confirmarlos uno por uno acá.
                    </p>
                  </div>
                  <div className={layoutStyles.detectionHeaderActions}>
                    <span className={`${layoutStyles.detectionBadge} ${layoutStyles.detectionBadgeSuccess}`}>
                      <Archive size={13} /> {archivosValidosZip.length} archivo{archivosValidosZip.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <div className={layoutStyles.loteFileList}>
                  {zipEntradas.map((e) => (
                    <div key={e.nombre} className={`${layoutStyles.loteFileRow} ${!e.valido ? layoutStyles.loteFileRowIgnorado : ''}`}>
                      <FileText size={14} />
                      <span className={layoutStyles.loteFileName}>{e.nombre}</span>
                      {!e.valido && <span className={layoutStyles.loteFileIgnoradoTag}>Se ignorará (no es .csv)</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.previewActions}>
                <button type="button" className={styles.btnSecondary} onClick={resetUpload}>Cancelar</button>
                <button
                  type="button"
                  className={styles.confirmBtn}
                  onClick={confirmUploadLote}
                  disabled={archivosValidosZip.length === 0}
                >
                  Continuar con la carga del lote <ArrowRight size={16} style={{ verticalAlign: 'text-bottom' }} />
                </button>
              </div>
            </>
          )}

          {stage === 'procesando-lote' && loteEnProceso && (() => {
            const total = loteEnProceso.cargas.length;
            const terminadas = loteEnProceso.cargas.filter((c) => c.estado !== 'procesando').length;
            const porcentaje = total > 0 ? Math.round((terminadas / total) * 100) : 0;
            const actual = Math.min(terminadas + 1, total);
            return (
              <div className={styles.card}>
                <div className={styles.emptyCampaignBox}>
                  <Loader2 size={20} className={styles.spin} />
                  <span>Procesando archivo {actual} de {total}…</span>
                  <div className={layoutStyles.progressBarTrack}>
                    <div className={layoutStyles.progressBarFill} style={{ width: `${porcentaje}%` }} />
                  </div>
                  <span className={layoutStyles.progressCaption}>
                    {terminadas} de {total} archivos procesados ({porcentaje}%)
                  </span>
                </div>
              </div>
            );
          })()}

          {stage === 'resultado-lote' && loteEnProceso && (() => {
            const cargas = loteEnProceso.cargas;
            const completados = cargas.filter((c) => c.estado === 'completado' || c.estado === 'completado_con_errores');
            const conError = cargas.filter((c) => c.estado === 'error');
            const pendientesRevision = cargas.filter((c) => c.estado === 'pendiente_revision');
            const huboProblemas = conError.length > 0 || pendientesRevision.length > 0;
            return (
              <>
                <div className={huboProblemas ? styles.warningBanner : styles.successBanner}>
                  {huboProblemas ? <AlertTriangle size={18} className={styles.warningIcon} /> : <CheckCircle2 size={18} className={styles.successIcon} />}
                  <span className={huboProblemas ? styles.warningText : styles.successText}>
                    {completados.length} completado{completados.length === 1 ? '' : 's'}
                    {conError.length > 0 && `, ${conError.length} con error`}
                    {pendientesRevision.length > 0 && `, ${pendientesRevision.length} pendiente${pendientesRevision.length === 1 ? '' : 's'} de revisión`}
                    {' '}de {cargas.length} archivo{cargas.length === 1 ? '' : 's'}.
                  </span>
                </div>

                <div className={styles.card}>
                  <h2 className={styles.cardTitle} style={{ marginBottom: 14 }}>
                    Resultado del lote &quot;{loteEnProceso.nombre_lote}&quot;
                  </h2>
                  <div className={layoutStyles.loteResultList}>
                    {cargas.map((c) => (
                      <div key={c.id} className={layoutStyles.loteResultRow}>
                        {c.estado === 'error' && <XCircle size={16} className={layoutStyles.loteResultIconError} />}
                        {c.estado === 'pendiente_revision' && <AlertTriangle size={16} className={layoutStyles.loteResultIconPendiente} />}
                        {(c.estado === 'completado' || c.estado === 'completado_con_errores') && <CheckCircle2 size={16} className={layoutStyles.loteResultIconOk} />}
                        <div className={layoutStyles.loteResultInfo}>
                          <span className={layoutStyles.loteResultName}>{c.archivo_nombre}</span>
                          {c.estado === 'error' && (
                            <span className={layoutStyles.loteResultMotivo}>{c.mensaje_error}</span>
                          )}
                          {c.estado === 'pendiente_revision' && (
                            <span className={layoutStyles.loteResultMotivo}>
                              {c.motivo_pendiente} Vuelve a subir este archivo por separado para resolverlo.
                            </span>
                          )}
                          {(c.estado === 'completado' || c.estado === 'completado_con_errores') && (
                            <span className={layoutStyles.loteResultMotivoOk}>
                              +{c.filas_insertadas.toLocaleString('es-PE')} registros
                              {c.filas_error > 0 && ` · ${c.filas_error} con error`}
                            </span>
                          )}
                          {c.advertencias && c.advertencias.length > 0 && (
                            <span className={layoutStyles.loteResultAdvertencia}>
                              {c.advertencias.map((a) => a.mensaje).join(' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.previewActions}>
                  <button type="button" className={styles.btnSecondary} onClick={() => navigate('/configuracion/carga')}>Volver al historial</button>
                  <button type="button" className={styles.confirmBtn} onClick={resetUpload}>Subir otro archivo</button>
                </div>
              </>
            );
          })()}

          {(stage === 'preview' || stage === 'resultado') && (
            <>
              {/* 1. Información detectada del archivo */}
              {stage === 'preview' && (
                <div className={styles.card}>
                  <div className={layoutStyles.detectionHeaderRow}>
                    <div>
                      <h2 className={styles.cardTitle}>1. Información detectada del archivo</h2>
                      <p className={styles.cardSubtitle}>Estos datos se extrajeron automáticamente del nombre del archivo.</p>
                    </div>
                    <div className={layoutStyles.detectionHeaderActions}>
                      {deteccionLoading && (
                        <span className={layoutStyles.detectionBadge}><Loader2 size={13} className={styles.spin} /> Detectando…</span>
                      )}
                      {!deteccionLoading && badgeSeccion1 === 'editing' && (
                        <span className={`${layoutStyles.detectionBadge} ${layoutStyles.detectionBadgeSuccess}`}>Editando información</span>
                      )}
                      {!deteccionLoading && badgeSeccion1 === 'success' && (
                        <span className={`${layoutStyles.detectionBadge} ${layoutStyles.detectionBadgeSuccess}`}>
                          <CheckCircle2 size={13} /> Información detectada correctamente
                        </span>
                      )}
                      {!deteccionLoading && badgeSeccion1 === 'warning' && (
                        <span className={`${layoutStyles.detectionBadge} ${layoutStyles.detectionBadgeWarning}`}>
                          <AlertTriangle size={13} /> Revisa la información detectada
                        </span>
                      )}
                      {!deteccionLoading && !editandoContexto && (
                        <button
                          type="button"
                          className={`${layoutStyles.detectionEditBtn} ${badgeSeccion1 === 'warning' ? layoutStyles.detectionEditBtnWarning : ''}`}
                          onClick={abrirEdicionContexto}
                        >
                          <Pencil size={14} /> Editar datos
                        </button>
                      )}
                      {editandoContexto && (
                        <button type="button" className={layoutStyles.detectionEditBtn} onClick={() => setEditandoContexto(false)}>
                          Cancelar edición
                        </button>
                      )}
                    </div>
                  </div>

                  {deteccion && deteccion.motivos.length > 0 && !editandoContexto && !contextoConfirmado && (
                    <p className={layoutStyles.virtualContextHint} style={{ marginTop: -6, marginBottom: 12 }}>
                      {deteccion.motivos.join(' ')}
                    </p>
                  )}

                  {!editandoContexto && (
                    <div className={layoutStyles.detectionGrid}>
                      <div className={layoutStyles.detectionBox}>
                        <div className={`${layoutStyles.detectionIconCircle} ${layoutStyles.detectionIconDocente}`}><User size={15} /></div>
                        <span className={layoutStyles.detectionLabel}>Docente</span>
                        <span className={mostrarDocente ? layoutStyles.detectionValue : `${layoutStyles.detectionValue} ${layoutStyles.detectionValueEmpty}`}>
                          {mostrarDocente || 'Sin detectar'}
                        </span>
                      </div>
                      <div className={layoutStyles.detectionBox}>
                        <div className={`${layoutStyles.detectionIconCircle} ${layoutStyles.detectionIconPrograma}`}><Building2 size={15} /></div>
                        <span className={layoutStyles.detectionLabel}>Programa</span>
                        <span className={mostrarPrograma ? layoutStyles.detectionValue : `${layoutStyles.detectionValue} ${layoutStyles.detectionValueEmpty}`}>
                          {mostrarPrograma || 'Sin detectar'}
                        </span>
                      </div>
                      <div className={layoutStyles.detectionBox}>
                        <div className={`${layoutStyles.detectionIconCircle} ${layoutStyles.detectionIconCurso}`}><BookOpen size={15} /></div>
                        <span className={layoutStyles.detectionLabel}>Curso</span>
                        <span className={mostrarCurso ? layoutStyles.detectionValue : `${layoutStyles.detectionValue} ${layoutStyles.detectionValueEmpty}`}>
                          {mostrarCurso || 'Sin detectar'}
                        </span>
                      </div>
                      <div className={layoutStyles.detectionBox}>
                        <div className={`${layoutStyles.detectionIconCircle} ${layoutStyles.detectionIconSeccion}`}><Users size={15} /></div>
                        <span className={layoutStyles.detectionLabel}>Sección</span>
                        <span className={mostrarSeccion !== null ? layoutStyles.detectionValue : `${layoutStyles.detectionValue} ${layoutStyles.detectionValueEmpty}`}>
                          {mostrarSeccion !== null ? mostrarSeccion : 'Sin detectar'}
                        </span>
                      </div>
                      <div className={layoutStyles.detectionBox}>
                        <div className={`${layoutStyles.detectionIconCircle} ${layoutStyles.detectionIconCiclo}`}><GraduationCap size={15} /></div>
                        <span className={layoutStyles.detectionLabel}>Ciclo</span>
                        <span className={mostrarCiclo !== null ? layoutStyles.detectionValue : `${layoutStyles.detectionValue} ${layoutStyles.detectionValueEmpty}`}>
                          {mostrarCiclo !== null ? mostrarCiclo : 'Sin detectar'}
                        </span>
                      </div>
                    </div>
                  )}

                  {editandoContexto && (
                    <div className={layoutStyles.virtualContextBox} style={{ padding: 0, border: 'none', background: 'none' }}>
                      {!docenteEditable ? (
                        <>
                          <div className={styles.formField}>
                            <input
                              type="text"
                              className={styles.formInput}
                              placeholder="Buscar docente por nombre o DNI…"
                              value={docenteSearch}
                              onChange={(e) => setDocenteSearch(e.target.value)}
                              autoFocus
                            />
                          </div>
                          {docenteSearching && (
                            <div className={layoutStyles.virtualContextHint}><Loader2 size={14} className={styles.spin} /> Buscando…</div>
                          )}
                          {!docenteSearching && docenteSearch.trim().length >= 2 && docenteResults.length === 0 && (
                            <div className={layoutStyles.virtualContextHint}>Sin resultados para &quot;{docenteSearch}&quot;.</div>
                          )}
                          {docenteResults.length > 0 && (
                            <div className={layoutStyles.virtualResultList}>
                              {docenteResults.map((d) => (
                                <button key={d.id} type="button" className={layoutStyles.virtualResultRow} onClick={() => seleccionarDocenteEditable(d)}>
                                  <span className={layoutStyles.virtualResultCurso}>{d.nombre_completo}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className={layoutStyles.virtualContextHint}>
                            Docente: <b>{docenteEditable.nombre_completo}</b>
                            <button type="button" className={layoutStyles.linkBtnInline} onClick={cambiarDocenteEditable}>Cambiar</button>
                          </div>
                          {docenteEditableLoading && (
                            <div className={layoutStyles.virtualContextHint}><Loader2 size={14} className={styles.spin} /> Cargando cursos…</div>
                          )}
                          {!docenteEditableLoading && (docenteEditable.cursos || []).length === 0 && (
                            <div className={layoutStyles.virtualContextHint}>Este docente no tiene cursos con carga oficial asignados.</div>
                          )}
                          {!docenteEditableLoading && (docenteEditable.cursos || []).length > 0 && (
                            <div className={layoutStyles.virtualResultList}>
                              {docenteEditable.cursos.map((c) => (
                                <button
                                  key={c.curso_grupo_docente_id}
                                  type="button"
                                  className={layoutStyles.virtualResultRow}
                                  onClick={() => elegirCursoEditable(c)}
                                >
                                  <span className={layoutStyles.virtualResultCurso}>{c.asignatura}</span>
                                  <span className={layoutStyles.virtualResultMeta}>{c.programa} · Ciclo {c.ciclo} · Sección {c.seccion}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {stage === 'resultado' && resultado && (
                <div className={resultado.filas_error > 0 ? styles.warningBanner : styles.successBanner}>
                  {resultado.filas_error > 0
                    ? <AlertTriangle size={18} className={styles.warningIcon} />
                    : <CheckCircle2 size={18} className={styles.successIcon} />}
                  <span className={resultado.filas_error > 0 ? styles.warningText : styles.successText}>
                    Se insertaron {resultado.filas_insertadas} respuestas
                    {resultado.filas_error > 0 && `, ${resultado.filas_error} con error`}.
                  </span>
                </div>
              )}

              {/* 2. Archivo cargado */}
              {stage === 'preview' && (
                <div className={styles.card}>
                  <h2 className={styles.cardTitle} style={{ marginBottom: 14 }}>2. Archivo cargado</h2>
                  <div className={layoutStyles.fileLoadedRow}>
                    <div className={layoutStyles.fileLoadedInfo}>
                      <div className={layoutStyles.fileLoadedIconBox}><FileText size={20} /></div>
                      <div>
                        <div className={layoutStyles.fileLoadedName}>{pendingFileName}</div>
                        <div className={layoutStyles.fileLoadedMeta}>{formatearTamano(pendingFile?.size)} · {parsedRows.length} registros</div>
                      </div>
                    </div>
                    <div className={layoutStyles.fileLoadedActions}>
                      <span className={`${layoutStyles.detectionBadge} ${layoutStyles.detectionBadgeSuccess}`}>
                        <CheckCircle2 size={13} /> Archivo cargado correctamente
                      </span>
                      <button type="button" className={layoutStyles.changeFileBtn} onClick={resetUpload}>
                        <RefreshCw size={14} /> Cambiar archivo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Vista previa de los datos */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>{stage === 'resultado' ? 'Resultado de la carga' : '3. Vista previa de los datos'}</h2>
                {stage === 'preview' && (
                  <p className={styles.cardSubtitle} style={{ marginBottom: 14 }}>Se muestran las primeras filas del archivo para que verifiques la información.</p>
                )}

                <DataTable columns={columnasTabla} rows={filasVisibles} renderRow={renderRow} emptyMessage="Sin filas" />

                {stage === 'preview' && parsedRows.length > FILAS_PREVIEW_CORTA && (
                  <div className={layoutStyles.tableFooterRow}>
                    <span className={layoutStyles.tableFooterCaption}>Mostrando {filasVisibles.length} de {parsedRows.length} registros</span>
                    <button type="button" className={layoutStyles.toggleRowsBtn} onClick={() => setShowAllRows((v) => !v)}>
                      <Eye size={14} /> {showAllRows ? 'Ver menos filas' : 'Ver todas las filas'}
                    </button>
                  </div>
                )}
              </div>

              {stage === 'preview' && (
                <div className={styles.previewActions}>
                  <button type="button" className={styles.btnSecondary} onClick={resetUpload}>Cancelar</button>
                  <button
                    type="button"
                    className={styles.confirmBtn}
                    onClick={confirmUpload}
                    disabled={!virtualCurso}
                    title={!virtualCurso ? 'Corrige la información detectada antes de continuar' : undefined}
                  >
                    Continuar con la carga <ArrowRight size={16} style={{ verticalAlign: 'text-bottom' }} />
                  </button>
                </div>
              )}

              {stage === 'resultado' && (
                <div className={styles.previewActions}>
                  <button type="button" className={styles.btnSecondary} onClick={() => navigate('/configuracion/carga')}>Volver al historial</button>
                  <button type="button" className={styles.confirmBtn} onClick={resetUpload}>Subir otro archivo</button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
