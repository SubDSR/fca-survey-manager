import styles from './EmptyState.module.css';

export default function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <svg
        className={styles.icon}
        width="64"
        height="64"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="12" y1="18" x2="12" y2="12"></line>
        <line x1="9" y1="15" x2="15" y2="15"></line>
      </svg>
      <h2>Bienvenido al Dashboard de Evaluación Docente</h2>
      <p>
        Para comenzar a analizar los datos, por favor cargue un archivo CSV extraído del sistema
        de encuestas. Toda la información se procesará localmente en su navegador.
      </p>
      <label htmlFor="csvFile" className={styles.uploadBtn}>Seleccionar Archivo CSV</label>
    </div>
  );
}
