import styles from './Card.module.css';

export default function Card({ title, note, headerAction, children, className }) {
  /* 'card' es una clase plana (no de módulo), añadida junto a styles.card
     únicamente para que las reglas de impresión de global.css (Tarea 14)
     puedan seleccionar `.card` como en el reference original: CSS Modules
     ofusca styles.card en build, por lo que un selector `.card` en una
     hoja global no lo encontraría sin este alias literal.

     headerAction (opcional): nodo React que se muestra en la esquina
     superior derecha, junto al título (p.ej. un selector Radar/Barras). */
  return (
    <div className={['card', styles.card, className].filter(Boolean).join(' ')}>
      {(title || headerAction) && (
        <div className={styles.cardHeaderRow}>
          {title && <h3>{title}</h3>}
          {headerAction}
        </div>
      )}
      {note && <p className={styles.chartNote}>{note}</p>}
      {children}
    </div>
  );
}
