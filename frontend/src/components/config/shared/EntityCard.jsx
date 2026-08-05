import { useEffect, useRef, useState } from 'react';
import { Pencil, Eye, MoreVertical, History } from 'lucide-react';
import styles from './EntityCard.module.css';

/* Card genérica para los tabs de catálogo (Docentes/Programas/Cursos) —
   ver docs/plans/2026-08-04-modulo-configuracion-design.md, sección 3.1.
   Deliberadamente NO comparte JSX/CSS con GestionView.jsx (decisión
   confirmada en la sección 0 del documento de diseño): esta es una vista
   administrativa nueva y distinta, GestionView sigue tal cual.

   Props:
   - icon: componente de ícono (lucide-react) para el avatar circular.
   - title: nombre/título principal (negrita).
   - subtitle: identificador secundario (DNI, código, etc.), opcional.
   - statusLabel + statusColor: punto de color + etiqueta (p.ej. condición).
   - active: boolean — si es false, la card se atenúa y muestra chip "Suspendido".
   - suspendedLabel: texto del chip cuando active=false (default "Suspendido").
   - onView / onEdit: callbacks de las dos primeras acciones.
   - onToggleActive: callback del tercer botón.
   - toggleActiveLabel: texto del tercer botón ("Suspender" / "Reactivar").
   - ToggleIcon: ícono del tercer botón (UserX/UserCheck para Docentes,
     Eye/EyeOff para Programas/Cursos — a criterio del consumidor).
   - onShowHistory: opcional. Si se pasa, agrega el menú "⋮" con la única
     opción "Ver historial de cambios" — solo Docentes lo usa por ahora
     (Programas/Cursos no pasan esta prop, así que no les aparece el menú). */
export default function EntityCard({
  icon: Icon,
  title,
  subtitle,
  statusLabel,
  statusColor,
  active = true,
  suspendedLabel = 'Suspendido',
  onView,
  onEdit,
  onToggleActive,
  toggleActiveLabel,
  ToggleIcon,
  onShowHistory,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div className={`${styles.card} ${!active ? styles.cardSuspended : ''}`}>
      {onShowHistory && (
        <div className={styles.menuWrap} ref={menuRef}>
          <button type="button" className={styles.menuBtn} onClick={() => setMenuOpen((v) => !v)} aria-label="Más acciones">
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className={styles.menuDropdown}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => { setMenuOpen(false); onShowHistory(); }}
              >
                <History size={14} /> Ver historial de cambios
              </button>
            </div>
          )}
        </div>
      )}
      <div className={styles.headerRow}>
        <div className={styles.avatar}>
          {Icon ? <Icon size={20} /> : <span>{(title || '?').charAt(0).toUpperCase()}</span>}
        </div>

        <div className={styles.headerInfo}>
          <div className={styles.title} title={title}>{title}</div>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}

          <div className={styles.statusRow}>
            {statusLabel && (
              <span className={styles.statusChip}>
                <span className={styles.statusDot} style={{ background: statusColor || 'var(--text-soft)' }} />
                {statusLabel}
              </span>
            )}
            {!active && <span className={styles.suspendedChip}>{suspendedLabel}</span>}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.actionBtn} onClick={onEdit} title="Editar">
          <Pencil size={14} />
          Editar
        </button>
        <button type="button" className={styles.actionBtn} onClick={onView} title="Ver">
          <Eye size={14} />
          Ver
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${active ? styles.actionBtnWarn : styles.actionBtnOk}`}
          onClick={onToggleActive}
          title={toggleActiveLabel}
        >
          {ToggleIcon && <ToggleIcon size={14} />}
          {toggleActiveLabel}
        </button>
      </div>
    </div>
  );
}
