import Modal from '../common/Modal.jsx';
import styles from './SeguimientoModal.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderSeguimientoModal
   (líneas 1553-1596) + markup del modal (líneas 791-803).

   El botón "Ver detalle →" (línea 1581) invoca onVerDetalle(group), que en App.jsx
   levanta STATE.docente.* equivalente (programa/categoria/estado/selected/curso),
   cierra el modal y cambia a la vista Docente — ver hooks/useDocenteSelection.js. */

export default function SeguimientoModal({ open, onClose, groups, onVerDetalle, politica }) {
  const items = groups || [];
  const subtitle = politica
    ? `Se marcan aquí los grupos docente/curso con nota Dim. I menor a ${politica.umbral_aprobacion}, o con ${politica.umbral_seguimiento_pct_no}% o más de respuestas "No" en el cumplimiento de directivas.`
    : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Docentes que requieren seguimiento"
      subtitle={subtitle}
    >
      {items.length === 0 ? (
        <div className={styles.modalEmpty}>No hay docentes en seguimiento para los filtros activos.</div>
      ) : (
        items.map((g, idx) => (
          <div className={styles.seguimientoItem} key={idx}>
            <div>
              <div className={styles.docenteName}>{g.docente}</div>
              <div className={styles.docenteMeta}>
                {g.curso} &middot; {g.programa} &middot; Ciclo {g.ciclo} &middot; Sección {g.seccion} &middot; Aula {g.aula} &middot; {g.n} encuesta(s)
              </div>
              <div className={styles.seguimientoReasons}>
                {g.reasons.map((r, i) => (
                  <span
                    key={i}
                    className={r.level === 'yellow' ? `${styles.reasonChip} ${styles.yellow}` : styles.reasonChip}
                  >
                    {r.label}
                  </span>
                ))}
              </div>
            </div>
            <div className={styles.seguimientoMetrics}>
              <div>
                <div className={g.nota < politica.umbral_aprobacion ? `${styles.metricValue} ${styles.bad}` : styles.metricValue}>
                  {g.nota.toFixed(1)}
                </div>
                <div className={styles.metricLabel}>Nota Dim I</div>
              </div>
              <div>
                <div className={g.pctNo >= politica.umbral_seguimiento_pct_no ? `${styles.metricValue} ${styles.bad}` : styles.metricValue}>
                  {Math.round(g.pctNo)}%
                </div>
                <div className={styles.metricLabel}>% de "No"</div>
              </div>
            </div>
            <button type="button" className={styles.btnSegDetail} onClick={() => onVerDetalle(g)}>
              Ver detalle →
            </button>
          </div>
        ))
      )}
    </Modal>
  );
}
