import styles from './Modal.module.css';

export default function Modal({ open, title, subtitle, onClose, children, wide }) {
  if (!open) return null;

  const boxClassName = wide ? `${styles.modalBox} ${styles.modalBoxWide}` : styles.modalBox;

  return (
    <div className={`no-print ${styles.modalOverlay} ${styles.show}`} onClick={onClose}>
      <div className={boxClassName} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className={styles.modalClose}
            aria-label="Cerrar"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}
