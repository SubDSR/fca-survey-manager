import { useEffect, useState } from 'react';
import {
  ArrowRightLeft, CheckCircle2, XCircle, Loader2, AlertTriangle,
  Calendar, BookOpen, GraduationCap, AlertCircle, Info,
} from 'lucide-react';
import Modal from '../common/Modal.jsx';
import { api } from '../../services/api.js';
import styles from './RevisionResolverModal.module.css';

const ACCIONES = [
  { key: 'reasignar', label: 'Reasignar', icon: ArrowRightLeft },
  { key: 'confirmar', label: 'Confirmar como correcta', icon: CheckCircle2 },
  { key: 'descartar', label: 'Descartar', icon: XCircle },
];

function formatFecha(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function pluralEncuestas(n) {
  return `${n} encuesta${n === 1 ? '' : 's'}`;
}

// Modal de resolución de una incidencia de v_asignaciones_sin_respaldo,
// abierto desde la campana de notificaciones (TopbarRed.jsx). Cada una de
// las 3 acciones llama a POST /api/revisiones/:id/resolver con su propio
// flujo -- ver docs de la migración 2026-08-04-revision-asignacion.sql para
// el significado de cada estado resultante.
//
// La lista de "cursos que sí dicta oficialmente" (detalle.opcionesReasignar,
// ya la trae GET /api/revisiones/:id desde la tarea anterior) cumple doble
// función acá: explica el contexto de la incidencia Y sirve de selector de
// destino para "Reasignar" (click en una card = destino elegido) -- se evitó
// duplicar la misma lista en un <select> aparte.
export default function RevisionResolverModal({ revisionId, onClose, onResolved }) {
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accion, setAccion] = useState(null);
  const [destino, setDestino] = useState('');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviarError, setEnviarError] = useState('');

  useEffect(() => {
    if (!revisionId) return;
    setDetalle(null);
    setAccion(null);
    setDestino('');
    setNotas('');
    setEnviarError('');
    setError('');
    setLoading(true);
    api.revisiones.obtener(revisionId)
      .then(setDetalle)
      .catch((err) => setError(err.message || 'No se pudo cargar la incidencia.'))
      .finally(() => setLoading(false));
  }, [revisionId]);

  const ejecutar = async (payload) => {
    setEnviando(true);
    setEnviarError('');
    const { ok, data } = await api.revisiones.resolver(revisionId, payload);
    setEnviando(false);
    if (!ok) {
      setEnviarError((data && data.error) || 'No se pudo resolver la incidencia.');
      return;
    }
    onResolved();
  };

  const sinOficiales = !!detalle && detalle.opcionesReasignar.length === 0;

  const elegirDestino = (id) => {
    setDestino(String(id));
    setAccion('reasignar');
    setEnviarError('');
  };

  return (
    <Modal
      open={!!revisionId}
      onClose={onClose}
      title={detalle?.docente}
      subtitle={detalle ? (
        <span className={styles.subtitleWithIcon}>
          <Calendar size={12} /> Incidencia detectada el {formatFecha(detalle.created_at)}
        </span>
      ) : undefined}
      wide
    >
      {loading && (
        <div className={styles.centerState}><Loader2 size={18} className={styles.spin} /> Cargando incidencia…</div>
      )}
      {!loading && error && <div className={styles.centerState}>{error}</div>}

      {!loading && detalle && (
        <>
          <div className={styles.explainBanner}>
            <AlertTriangle size={18} className={styles.explainIcon} />
            <p>
              Este curso no está respaldado por la carga oficial de este docente. Probablemente un
              estudiante marcó al docente correcto pero con el curso equivocado al llenar la encuesta.
            </p>
          </div>

          <span className={styles.sectionLabel}><BookOpen size={12} /> Curso reportado en la encuesta</span>
          <div className={styles.reportedCard}>
            <div className={styles.reportedIconBox}><GraduationCap size={18} /></div>
            <div className={styles.reportedInfo}>
              <div className={styles.reportedCourseName}>{detalle.curso}</div>
              <div className={styles.reportedMeta}>
                {detalle.programa} · Ciclo {detalle.ciclo} Sección {detalle.seccion}
              </div>
              <div className={styles.reportedCount}>
                <AlertCircle size={12} /> {pluralEncuestas(detalle.n_encuestas)} afectada{detalle.n_encuestas === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          <span className={styles.sectionLabel}><CheckCircle2 size={12} /> Cursos que sí dicta oficialmente</span>
          {sinOficiales ? (
            <div className={styles.noOficialesBox}>
              Este docente no tiene cursos en la carga oficial — revisa directamente con el
              coordinador antes de reasignar.
            </div>
          ) : (
            <div
              className={styles.oficialesGrid}
              style={{ gridTemplateColumns: `repeat(${Math.min(detalle.opcionesReasignar.length, 3)}, 1fr)` }}
            >
              {detalle.opcionesReasignar.map((o) => {
                const seleccionado = accion === 'reasignar' && destino === String(o.curso_grupo_docente_id);
                return (
                  <button
                    key={o.curso_grupo_docente_id}
                    type="button"
                    className={seleccionado ? `${styles.oficialCard} ${styles.oficialCardSelected}` : styles.oficialCard}
                    onClick={() => elegirDestino(o.curso_grupo_docente_id)}
                  >
                    <div className={styles.oficialIconBox}><GraduationCap size={18} /></div>
                    <div className={styles.oficialInfo}>
                      <div className={styles.oficialCourseName}>{o.curso}</div>
                      <div className={styles.oficialMeta}>{o.programa} · Ciclo {o.ciclo} Sección {o.seccion}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className={styles.helpBanner}>
            <div className={styles.helpIconBox}><Info size={16} /></div>
            <div>
              <div className={styles.helpTitle}>¿Qué puedes hacer?</div>
              <p className={styles.helpText}>
                Puedes reasignar esta encuesta al curso correcto o confirmar que la asignación es correcta.
              </p>
            </div>
          </div>

          <div className={styles.accionTabs}>
            {ACCIONES.map((a) => {
              const disabled = a.key === 'reasignar' && sinOficiales;
              const classes = [
                styles.accionTab,
                styles[`accionTab_${a.key}`],
                accion === a.key ? styles.accionTabActive : '',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={a.key}
                  type="button"
                  disabled={disabled}
                  className={classes}
                  onClick={() => { setAccion(a.key); setEnviarError(''); }}
                >
                  <a.icon size={14} />
                  {a.label}
                </button>
              );
            })}
          </div>

          {accion === 'reasignar' && (
            <div className={styles.accionBody}>
              <p className={styles.hint}>
                {destino
                  ? 'Curso destino seleccionado arriba — al mover, las encuestas pasan a contar ahí.'
                  : 'Elige un curso destino de la lista de arriba.'}
              </p>
              {enviarError && <div className={styles.formError}>{enviarError}</div>}
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={!destino || enviando}
                  onClick={() => ejecutar({ accion: 'reasignar', curso_grupo_docente_destino_id: Number(destino) })}
                >
                  {enviando ? <Loader2 size={16} className={styles.spin} /> : 'Mover encuestas'}
                </button>
              </div>
            </div>
          )}

          {accion === 'confirmar' && (
            <div className={styles.accionBody}>
              <p className={styles.confirmText}>
                ¿Confirmas que <b>{detalle.docente}</b> sí dicta <b>{detalle.curso}</b>{' '}
                ({detalle.programa}, Ciclo {detalle.ciclo} Sección {detalle.seccion})?
                Las encuestas volverán a contar en las estadísticas.
              </p>
              {enviarError && <div className={styles.formError}>{enviarError}</div>}
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.btnConfirm}
                  disabled={enviando}
                  onClick={() => ejecutar({ accion: 'confirmar' })}
                >
                  {enviando ? <Loader2 size={16} className={styles.spin} /> : 'Sí, es correcto'}
                </button>
              </div>
            </div>
          )}

          {accion === 'descartar' && (
            <div className={styles.accionBody}>
              <p className={styles.hint}>
                Usa esta opción cuando el dato no se pueda reconstruir. Explica brevemente por qué.
              </p>
              <textarea
                className={styles.textarea}
                rows={3}
                placeholder="Ej: encuestado marcó el docente equivocado, no hay forma de saber a quién evaluó realmente."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
              {enviarError && <div className={styles.formError}>{enviarError}</div>}
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.btnDanger}
                  disabled={!notas.trim() || enviando}
                  onClick={() => ejecutar({ accion: 'descartar', notas })}
                >
                  {enviando ? <Loader2 size={16} className={styles.spin} /> : 'Descartar incidencia'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
