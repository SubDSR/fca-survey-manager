import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, UploadCloud, FileText, AlertCircle, AlertTriangle, Loader2,
  CheckCircle2, XCircle, MinusCircle, Ban, Layers, Users, BookOpen,
} from 'lucide-react';
import { api } from '../../../services/api.js';
import DataTable from '../../common/DataTable.jsx';
import { EXPECTED_HEADERS, SAMPLE_CSV, parseCsvToRows } from './cargaFormatos.js';
import styles from '../ConfigView.module.css';
import layoutStyles from './CargaTab.module.css';

const PREGUNTAS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];
const COLUMNAS_TABLA = [
  { key: 'Programa', label: 'Programa' },
  { key: 'Docente', label: 'Docente' },
  { key: 'Curso', label: 'Curso' },
  { key: 'Ciclo', label: 'Ciclo' },
  { key: 'Seccion', label: 'Sección' },
  ...PREGUNTAS.map((p) => ({ key: p, label: p })),
];

// Página dedicada de "Subir archivo CSV" (encuestas presenciales), movida
// desde el bloque inline que vivía en CargaTab.jsx bajo las 3 action cards
// -- misma lógica de carga (api.cargas.subir), solo cambia dónde vive la UI:
// ahora hay espacio para un box de contexto reconocido + la tabla completa
// del CSV parseado (antes solo se mostraban 5 filas de muestra). El período
// activo viaja por query param (?periodo_id=) desde CargaTab -- si falta o
// es inválido (navegación directa/recarga), se recalcula el mismo default
// que CargaTab usa (período EN_CURSO, o el primero de la lista).
export default function SubirCsvPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef(null);

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

  // ---- Subida ----
  // idle | preview | uploading | procesando | resultado | error
  //   uploading  -> el POST está en vuelo (subiendo el archivo).
  //   procesando -> el backend ya registró la carga (estado='procesando')
  //                 y sigue insertando en background; acá se hace polling a
  //                 GET /api/cargas/:id hasta que el estado sea final.
  const [stage, setStage] = useState('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingFileName, setPendingFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [cargaEnProceso, setCargaEnProceso] = useState(null);

  // ---- Pendientes de revisión (fuzzy matching, ver importarEncuestas.js) ----
  // pendientesPorFila: fila_numero -> [{ id, tipo, valor_csv, candidatos }],
  // solo los que siguen con estado='pendiente' (se remueven al resolverse).
  // filaResueltaComo: fila_numero -> 'insertada'|'omitida'|'descartada', una
  // vez que TODAS las ambigüedades de esa fila quedaron resueltas.
  const [pendientesPorFila, setPendientesPorFila] = useState(new Map());
  const [filaResueltaComo, setFilaResueltaComo] = useState(new Map());
  const [resolviendoId, setResolviendoId] = useState(null);
  const [resolverError, setResolverError] = useState('');

  const parseAndSet = (file, text) => {
    const { headers, rows } = parseCsvToRows(text);
    if (rows.length === 0) {
      setStage('error');
      setErrorMessage('El archivo está vacío o no contiene filas de datos.');
      return;
    }
    const missing = EXPECTED_HEADERS.filter((h) => !headers.includes(h));
    const extra = headers.filter((h) => !EXPECTED_HEADERS.includes(h));
    if (missing.length > 0) {
      setStage('error');
      setErrorMessage(`Faltan columnas requeridas: ${missing.join(', ')}.${extra.length ? ` Columnas no reconocidas: ${extra.join(', ')}.` : ''}`);
      return;
    }
    setParsedRows(rows);
    setPendingFile(file);
    setPendingFileName(file.name);
    setResultado(null);
    setStage('preview');
  };

  const handleFile = (file) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setStage('error');
      setErrorMessage(`"${file.name}" no es un archivo CSV válido. Solo se aceptan archivos .csv.`);
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
    setStage('idle');
    setErrorMessage('');
    setParsedRows([]);
    setPendingFile(null);
    setResultado(null);
    setCargaEnProceso(null);
  };

  const confirmUpload = async () => {
    if (!pendingFile || !periodo) return;
    setStage('uploading');
    const { ok, status, data } = await api.cargas.subir(periodo.id, pendingFile);

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

    // 202: el archivo quedó validado y registrado (estado='procesando'), el
    // insertado real sigue en background -- de acá en más se hace polling.
    setCargaEnProceso(data);
    setStage('procesando');
  };

  // Polling mientras stage==='procesando'. Depende solo del id (no del
  // objeto cargaEnProceso completo, que cambia en cada tick) para no
  // reiniciar el intervalo en cada respuesta.
  const cargaEnProcesoId = cargaEnProceso?.id;
  useEffect(() => {
    if (stage !== 'procesando' || !cargaEnProcesoId) return undefined;
    let cancelado = false;

    const consultar = async () => {
      const { ok, data } = await api.cargas.obtener(cargaEnProcesoId);
      if (cancelado || !ok) return;
      setCargaEnProceso(data);

      if (data.estado === 'procesando') return;

      // 'error' cubre dos casos distintos que solo se distinguen por
      // mensaje_error (ver procesarCargaEnBackground en el backend):
      //   - mensaje_error presente: una excepción inesperada cortó el
      //     import a mitad de camino -> banner de error genérico.
      //   - mensaje_error ausente: el import terminó normal pero TODAS las
      //     filas fallaron individualmente -> mismo detalle fila-por-fila
      //     que 'completado_con_errores', para poder ver qué falló en cada
      //     una (igual que el 422 de la versión síncrona anterior).
      if (data.estado === 'error' && data.mensaje_error) {
        setStage('error');
        setErrorMessage(data.mensaje_error);
        return;
      }

      setResultado(data);
      setPendientesPorFila(new Map());
      setFilaResueltaComo(new Map());
      setStage('resultado');
    };

    consultar();
    const intervalo = setInterval(consultar, 3000);
    return () => { cancelado = true; clearInterval(intervalo); };
  }, [stage, cargaEnProcesoId]);

  useEffect(() => {
    if (stage !== 'resultado' || !resultado || !resultado.filas_pendientes) return;
    api.cargas.pendientes(resultado.id).then(({ ok, data }) => {
      if (!ok) return;
      const mapa = new Map();
      data.forEach((p) => {
        const arr = mapa.get(p.fila_numero) || [];
        arr.push(p);
        mapa.set(p.fila_numero, arr);
      });
      setPendientesPorFila(mapa);
    });
  }, [stage, resultado]);

  const resolverPendienteFila = async (pendiente, payload) => {
    setResolviendoId(pendiente.id);
    setResolverError('');
    const { ok, data } = await api.cargas.resolverPendiente(pendiente.id, payload);
    setResolviendoId(null);
    if (!ok) {
      setResolverError((data && data.error) || 'No se pudo resolver esta fila.');
      return;
    }

    setPendientesPorFila((prev) => {
      const next = new Map(prev);
      const restantes = (next.get(pendiente.fila_numero) || []).filter((p) => p.id !== pendiente.id);
      if (restantes.length > 0) next.set(pendiente.fila_numero, restantes);
      else next.delete(pendiente.fila_numero);
      return next;
    });

    const desenlaces = { fila_insertada: 'insertada', fila_omitida: 'omitida', fila_descartada: 'descartada' };
    const nuevoEstado = desenlaces[data.estado];
    if (nuevoEstado) {
      setFilaResueltaComo((prev) => new Map(prev).set(pendiente.fila_numero, nuevoEstado));
      setResultado((prev) => ({
        ...prev,
        filas_pendientes: Math.max(0, (prev.filas_pendientes || 0) - 1),
        filas_insertadas: nuevoEstado === 'insertada' ? prev.filas_insertadas + 1 : prev.filas_insertadas,
      }));
    }
    // 'resuelto_parcial': la fila sigue con otra ambigüedad pendiente -- no
    // cambia ningún contador todavía, solo se descuenta el candidato ya
    // resuelto de la lista de acciones de esa fila (arriba).
  };

  const resumen = useMemo(() => {
    if (parsedRows.length === 0) return null;
    return {
      filas: parsedRows.length,
      programas: new Set(parsedRows.map((r) => r.Programa).filter(Boolean)).size,
      docentes: new Set(parsedRows.map((r) => r.Docente).filter(Boolean)).size,
      cursos: new Set(parsedRows.map((r) => r.Curso).filter(Boolean)).size,
    };
  }, [parsedRows]);

  const erroresPorFila = useMemo(() => new Map((resultado?.errores || []).map((e) => [e.fila, e.mensaje])), [resultado]);
  const omitidasPorFila = useMemo(() => new Map((resultado?.omitidas || []).map((o) => [o.fila, o.mensaje])), [resultado]);

  const columnasTabla = stage === 'resultado'
    ? [{ key: '_estado', label: 'Estado' }, ...COLUMNAS_TABLA]
    : COLUMNAS_TABLA;

  const renderRow = (row, idx) => {
    const numeroFila = idx + 2;
    let estadoFila = null;
    let mensajeFila = '';
    const pendientesFila = pendientesPorFila.get(numeroFila) || [];

    if (stage === 'resultado') {
      if (erroresPorFila.has(numeroFila)) {
        estadoFila = 'error'; mensajeFila = erroresPorFila.get(numeroFila);
      } else if (omitidasPorFila.has(numeroFila)) {
        estadoFila = 'omitida'; mensajeFila = omitidasPorFila.get(numeroFila);
      } else if (filaResueltaComo.has(numeroFila)) {
        estadoFila = filaResueltaComo.get(numeroFila);
      } else if (pendientesFila.length > 0) {
        estadoFila = 'pendiente';
      } else {
        estadoFila = 'insertada';
      }
    }

    return (
      <Fragment key={idx}>
        <tr className={estadoFila ? layoutStyles[`rowStatus_${estadoFila}`] : undefined} title={mensajeFila || undefined}>
          {stage === 'resultado' && (
            <td>
              {estadoFila === 'error' && <XCircle size={14} className={layoutStyles.rowStatusIconError} />}
              {(estadoFila === 'omitida' || estadoFila === 'descartada') && <MinusCircle size={14} className={layoutStyles.rowStatusIconOmitida} />}
              {estadoFila === 'insertada' && <CheckCircle2 size={14} className={layoutStyles.rowStatusIconOk} />}
              {estadoFila === 'pendiente' && <AlertTriangle size={14} className={layoutStyles.rowStatusIconPendiente} />}
            </td>
          )}
          {COLUMNAS_TABLA.map((c) => <td key={c.key}>{row[c.key]}</td>)}
        </tr>
        {estadoFila === 'pendiente' && (
          <tr className={layoutStyles.rowStatus_pendiente}>
            <td colSpan={columnasTabla.length}>
              <span className={layoutStyles.pendingBadge}>Pendiente de revisión</span>
              {pendientesFila.map((p) => (
                <div key={p.id} className={layoutStyles.pendingActionsRow}>
                  <span>{p.tipo === 'docente' ? 'Docente' : 'Curso'} &quot;{p.valor_csv}&quot;:</span>
                  {p.candidatos.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`${layoutStyles.pendingActionBtn} ${layoutStyles.pendingActionBtnCandidato}`}
                      disabled={resolviendoId === p.id}
                      onClick={() => resolverPendienteFila(p, {
                        accion: 'usar_existente',
                        ...(p.tipo === 'docente' ? { docente_id: c.id } : { asignatura_id: c.id }),
                      })}
                    >
                      Usar &quot;{c.nombre}&quot; ({Math.round(c.similitud * 100)}%)
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${layoutStyles.pendingActionBtn} ${layoutStyles.pendingActionBtnNuevo}`}
                    disabled={resolviendoId === p.id}
                    onClick={() => resolverPendienteFila(p, { accion: 'crear_nuevo' })}
                  >
                    Crear como nuevo
                  </button>
                  <button
                    type="button"
                    className={`${layoutStyles.pendingActionBtn} ${layoutStyles.pendingActionBtnDescartar}`}
                    disabled={resolviendoId === p.id}
                    onClick={() => resolverPendienteFila(p, { accion: 'descartar' })}
                  >
                    {resolviendoId === p.id ? <Loader2 size={12} className={styles.spin} /> : 'Descartar'}
                  </button>
                </div>
              ))}
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const periodoLabel = periodo ? periodo.codigo : '—';

  return (
    <>
      <div className={layoutStyles.subPageHeader}>
        <button type="button" className={layoutStyles.backLink} onClick={() => navigate('/configuracion/carga')}>
          <ArrowLeft size={16} /> Volver
        </button>
        <span className={layoutStyles.breadcrumb}>Configuración · Carga de Información · Subir Archivo CSV</span>
        <h1 className={layoutStyles.pageTitle}>Subir Archivo CSV — Encuestas Presenciales</h1>
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
              {campaniaChecked && campania && ` · campaña ${campania.estado === 'ABIERTA' ? 'abierta' : 'en borrador'}`}
            </span>
          </div>

          {periodoError && (
            <div className={styles.errorBox} style={{ marginBottom: 16 }}>
              <AlertCircle size={20} className={styles.errorIcon} />
              <div className={styles.errorBody}><p className={styles.errorText}>{periodoError}</p></div>
            </div>
          )}

          <div className={styles.card}>
            {!campaniaChecked && (
              <div className={styles.emptyCampaignBox}><Loader2 size={18} className={styles.spin} /> Verificando campaña de evaluación…</div>
            )}

            {campaniaChecked && !campania && (
              <div className={styles.emptyCampaignBox}>
                <Ban size={20} className={styles.emptyCampaignIcon} />
                <p className={styles.emptyCampaignTitle}>Este período no tiene una campaña de evaluación abierta</p>
                <p className={styles.emptyCampaignText}>Abre o crea una campaña de evaluación para &quot;{periodoLabel}&quot; antes de subir encuestas.</p>
              </div>
            )}

            {campaniaChecked && campania && stage === 'idle' && (
              <div
                className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <div className={styles.dropzoneIconBox}><UploadCloud size={24} strokeWidth={1.8} /></div>
                <p className={styles.dropzoneTitle}>Arrastra tu archivo CSV aquí</p>
                <p className={styles.dropzoneText}>
                  o <button type="button" className={styles.dropzoneLink} onClick={triggerFilePicker}>selecciona desde tu equipo</button>
                </p>
                <p className={styles.dropzoneHint}>Solo archivos .csv · Máx. 50 MB</p>
                <p className={styles.dropzoneSampleWrap}>
                  <button type="button" className={styles.dropzoneSampleLink} onClick={useSampleFile}>Usar archivo de ejemplo</button>
                </p>
                <input ref={fileInputRef} type="file" accept=".csv" className={styles.hiddenFileInput} onChange={onFileInputChange} />
              </div>
            )}

            {stage === 'error' && (
              <div className={styles.errorBox}>
                <AlertCircle size={20} className={styles.errorIcon} />
                <div className={styles.errorBody}>
                  <p className={styles.errorTitle}>No se pudo procesar el archivo</p>
                  <p className={styles.errorText}>{errorMessage}</p>
                </div>
                <button type="button" className={styles.errorRetryBtn} onClick={resetUpload}>Intentar de nuevo</button>
              </div>
            )}

            {stage === 'uploading' && (
              <div className={styles.emptyCampaignBox}>
                <Loader2 size={20} className={styles.spin} />
                <span>Subiendo &quot;{pendingFileName}&quot;…</span>
              </div>
            )}

            {stage === 'procesando' && cargaEnProceso && (() => {
              const total = cargaEnProceso.filas_leidas || 0;
              const procesadas = Math.min(cargaEnProceso.filas_procesadas || 0, total);
              const porcentaje = total > 0 ? Math.round((procesadas / total) * 100) : 0;
              return (
                <div className={styles.emptyCampaignBox}>
                  <Loader2 size={20} className={styles.spin} />
                  <span>Procesando &quot;{pendingFileName}&quot;…</span>
                  <div className={layoutStyles.progressBarTrack}>
                    <div className={layoutStyles.progressBarFill} style={{ width: `${porcentaje}%` }} />
                  </div>
                  <span className={layoutStyles.progressCaption}>
                    {procesadas.toLocaleString('es-PE')} de {total.toLocaleString('es-PE')} filas procesadas ({porcentaje}%)
                  </span>
                  <span className={layoutStyles.progressCaption}>
                    Puedes salir de esta página — la carga sigue en el servidor y el historial la mostrará como &quot;En proceso&quot; hasta que termine.
                  </span>
                </div>
              );
            })()}

            {(stage === 'preview' || stage === 'resultado') && (
              <>
                {stage === 'preview' && resumen && (
                  <div className={layoutStyles.summaryGrid}>
                    <div className={layoutStyles.summaryCard}>
                      <FileText size={18} className={layoutStyles.summaryIcon} />
                      <div className={layoutStyles.summaryValue}>{resumen.filas}</div>
                      <div className={layoutStyles.summaryLabel}>Filas detectadas</div>
                    </div>
                    <div className={layoutStyles.summaryCard}>
                      <Layers size={18} className={layoutStyles.summaryIcon} />
                      <div className={layoutStyles.summaryValue}>{resumen.programas}</div>
                      <div className={layoutStyles.summaryLabel}>Programas distintos</div>
                    </div>
                    <div className={layoutStyles.summaryCard}>
                      <Users size={18} className={layoutStyles.summaryIcon} />
                      <div className={layoutStyles.summaryValue}>{resumen.docentes}</div>
                      <div className={layoutStyles.summaryLabel}>Docentes distintos</div>
                    </div>
                    <div className={layoutStyles.summaryCard}>
                      <BookOpen size={18} className={layoutStyles.summaryIcon} />
                      <div className={layoutStyles.summaryValue}>{resumen.cursos}</div>
                      <div className={layoutStyles.summaryLabel}>Cursos distintos</div>
                    </div>
                  </div>
                )}

                {stage === 'resultado' && resultado && (
                  <div className={(resultado.filas_error > 0 || resultado.filas_pendientes > 0) ? styles.warningBanner : styles.successBanner}>
                    {(resultado.filas_error > 0 || resultado.filas_pendientes > 0)
                      ? <AlertTriangle size={18} className={styles.warningIcon} />
                      : <CheckCircle2 size={18} className={styles.successIcon} />}
                    <span className={(resultado.filas_error > 0 || resultado.filas_pendientes > 0) ? styles.warningText : styles.successText}>
                      Se insertaron {resultado.filas_insertadas} filas
                      {resultado.filas_omitidas > 0 && `, ${resultado.filas_omitidas} omitidas por duplicado`}
                      {resultado.filas_error > 0 && `, ${resultado.filas_error} con error`}
                      {resultado.filas_pendientes > 0 && `, ${resultado.filas_pendientes} pendientes de revisión`}.
                    </span>
                  </div>
                )}

                {resolverError && (
                  <div className={styles.errorBox} style={{ marginBottom: 12 }}>
                    <AlertCircle size={18} className={styles.errorIcon} />
                    <div className={styles.errorBody}><p className={styles.errorText}>{resolverError}</p></div>
                  </div>
                )}

                <div className={layoutStyles.previewFileRow}>
                  <FileText size={16} /> <span>{pendingFileName}</span>
                  <span className={layoutStyles.previewFileMeta}>— {parsedRows.length} filas</span>
                </div>

                <DataTable columns={columnasTabla} rows={parsedRows} renderRow={renderRow} emptyMessage="Sin filas" />

                {stage === 'preview' && (
                  <div className={styles.previewActions}>
                    <button type="button" className={styles.btnSecondary} onClick={resetUpload}>Cancelar</button>
                    <button type="button" className={styles.confirmBtn} onClick={confirmUpload}>Confirmar carga</button>
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
          </div>
        </>
      )}
    </>
  );
}
