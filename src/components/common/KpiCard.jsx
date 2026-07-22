import styles from './KpiCard.module.css';

const TONE_CLASS = {
  pos: styles.pos,
  neg: styles.neg,
};

export default function KpiCard({ label, value, tone, note }) {
  const valueClassName = [styles.kpiValue, TONE_CLASS[tone]].filter(Boolean).join(' ');

  return (
    <div className={styles.kpiCard}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={valueClassName}>{value}</span>
      {note && <span className={styles.kpiSub}>{note}</span>}
    </div>
  );
}
