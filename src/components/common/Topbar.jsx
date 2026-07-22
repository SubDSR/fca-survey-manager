import styles from './Topbar.module.css';
import { LOGO_UNMSM } from '../../assets/logos.js';
import { useCsvLoader } from '../../hooks/useCsvLoader.js';

/* fileStatusText/link portados desde reference/dashboard_evaluacion_docente.html:
   renderFileStatus (líneas 1210-1229). El enlace "(N excluidas, ver detalle)" abre
   ExcludedModal (Tarea 12) vía onOpenExcluded. */

function fileStatusText(csvMeta) {
  if (!csvMeta) return 'Esperando archivo CSV...';
  return `${csvMeta.fileName} · ${csvMeta.validCount} de ${csvMeta.totalParsed} encuestas válidas`;
}

export default function Topbar({ view, onViewChange, showToggle, onOpenExcluded }) {
  const { onFileChange, csvMeta } = useCsvLoader();

  return (
    <header className={`no-print ${styles.topbar}`}>
      <div className={styles.brandGroup}>
        <img src={LOGO_UNMSM} alt="UNMSM FCA" className={styles.logo} />
        <div className={styles.brand}>
          <h1>Reporte de Encuesta Docente</h1>
          <span>Unidad de Posgrado · Facultad de Ciencias Administrativas</span>
        </div>
      </div>

      {showToggle && (
        <div className={styles.viewToggle} role="tablist">
          <button
            type="button"
            role="tab"
            className={view === 'director' ? styles.active : undefined}
            onClick={() => onViewChange('director')}
          >
            Vista Director de Carrera
          </button>
          <button
            type="button"
            role="tab"
            className={view === 'docente' ? styles.active : undefined}
            onClick={() => onViewChange('docente')}
          >
            Vista Docente Individual
          </button>
        </div>
      )}

      <div className={styles.upload}>
        <label htmlFor="csvFile" className={styles.uploadBtn}>Cargar CSV</label>
        <input type="file" id="csvFile" accept=".csv" hidden onChange={onFileChange} />
        <span className={styles.fileStatus}>
          {fileStatusText(csvMeta)}
          {csvMeta && csvMeta.excludedCount > 0 && (
            <button type="button" className={styles.excludedLink} onClick={onOpenExcluded}>
              {` (${csvMeta.excludedCount} sin ninguna respuesta, ver detalle)`}
            </button>
          )}
        </span>
      </div>
    </header>
  );
}
