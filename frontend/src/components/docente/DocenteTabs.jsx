import styles from './DocenteView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html (markup líneas 717-720). */

const TABS = [
  { key: 'resumen', label: 'Resumen de Evaluación' },
  { key: 'respuestas', label: 'Detalle de Encuestados' }
];

export default function DocenteTabs({ active, onChange }) {
  return (
    <div className={`no-print ${styles.docenteTabs}`}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={active === tab.key ? styles.active : undefined}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
