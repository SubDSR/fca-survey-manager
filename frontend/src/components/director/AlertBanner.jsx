import styles from './DirectorView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html:
   renderAlertBanner (líneas 1516-1549) + listener de click (línea 3068) + markup (629-633).
   `groups` es el resultado de getFollowUpGroups(buildDirectorGroups(...)) (lib/directorGroups.js). */

export default function AlertBanner({ groups, onOpenSeguimiento, politica }) {
  const flaggedDocentes = new Set(groups.map((g) => g.docente)).size;

  if (flaggedDocentes === 0) return null;

  const motivo = `nota menor a ${politica.umbral_aprobacion} o alto porcentaje de respuestas "No"`;
  const text = flaggedDocentes === 1
    ? `1 docente requiere seguimiento (${motivo}).`
    : `${flaggedDocentes} docentes requieren seguimiento (${motivo}).`;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenSeguimiento();
    }
  };

  return (
    <div
      className={`no-print ${styles.alertBanner}`}
      onClick={onOpenSeguimiento}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <span className={styles.dot} />
      <span>{text}</span>
      <span className={styles.alertLink}>Ver detalle →</span>
    </div>
  );
}
