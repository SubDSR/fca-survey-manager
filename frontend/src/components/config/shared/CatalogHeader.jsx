import { useState } from 'react';
import { Info } from 'lucide-react';
import styles from '../tabs/DocentesTab.module.css';

// Ilustración decorativa del header -- compartida por los 3 tabs de
// catálogo (Docentes/Programas/Cursos). Sin asset importado desde el diseño
// de Claude Design (Carga de Información no generó ninguno reutilizable),
// así que es un SVG propio, mismo estilo de línea/outline que el resto de
// íconos del proyecto (lucide-react).
function CatalogIllustration() {
  return (
    <svg width="120" height="72" viewBox="0 0 120 72" fill="none" aria-hidden="true">
      <circle cx="38" cy="28" r="16" stroke="#9C1F06" strokeWidth="1.6" opacity="0.18" />
      <path d="M18 62c0-11 9-18 20-18s20 7 20 18" stroke="#9C1F06" strokeWidth="1.6" opacity="0.18" strokeLinecap="round" />
      <circle cx="86" cy="22" r="11" stroke="#9C1F06" strokeWidth="1.6" opacity="0.12" />
      <path d="M68 58c0-8 8-13 18-13s18 5 18 13" stroke="#9C1F06" strokeWidth="1.6" opacity="0.12" strokeLinecap="round" />
    </svg>
  );
}

// Header propio de cada tab de catálogo (título + ícono de ayuda +
// ilustración) -- mismo patrón para Docentes/Programas/Cursos, ya no vive
// en ConfigView.jsx (ver decisión de la ronda de ajustes visuales).
export default function CatalogHeader({ title, subtitle, tooltip }) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div className={styles.header}>
      <CatalogIllustration />
      <div className={styles.headerTitleRow}>
        <h1 className={styles.headerTitle}>{title}</h1>
        <button
          type="button"
          className={styles.infoIconBtn}
          onMouseEnter={() => setInfoOpen(true)}
          onMouseLeave={() => setInfoOpen(false)}
          onClick={() => setInfoOpen((v) => !v)}
          aria-label="Ayuda"
        >
          <Info size={12} />
          {infoOpen && <span className={styles.infoTooltip}>{tooltip}</span>}
        </button>
      </div>
      <p className={styles.headerSubtitle}>{subtitle}</p>
    </div>
  );
}
