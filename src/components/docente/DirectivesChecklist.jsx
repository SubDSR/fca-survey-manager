import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import PieChart from '../charts/PieChart.jsx';
import { computeDirectiveBreakdown, computeDirectiveCounts } from '../../lib/stats.js';
import { directivesPieConfig } from '../../lib/chartConfigs.js';
import styles from './DocenteView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderDirectivesChecklist
   (líneas 2033-2057) + renderDirectivesPieChart (líneas 2059-2105). */

export default function DirectivesChecklist({ cursoRows, directiveLabels, tall }) {
  const breakdown = useMemo(
    () => computeDirectiveBreakdown(cursoRows, directiveLabels),
    [cursoRows, directiveLabels]
  );
  const counts = useMemo(() => computeDirectiveCounts(cursoRows), [cursoRows]);
  const pieConfig = useMemo(() => directivesPieConfig(counts), [counts]);

  const hasChecklistData = breakdown.some((b) => b.total > 0);

  return (
    <Card
      title="Cumplimiento de directivas"
      note="Respuestas obtenidas en el grupo filtrado"
      className={`chart-card ${cardStyles.chartCard}`}
    >
      {hasChecklistData ? (
        <div className={styles.directivesList}>
          {breakdown.map((b) => (
            <div key={b.label} className={styles.directiveRow}>
              <div className={styles.directiveName}>
                <span>{b.label}</span>
                <span className={styles.pct}>{Math.round(b.pctSi)}% Sí</span>
              </div>
              <div className={styles.stackedMini}>
                <div className={styles.si} style={{ width: `${b.pctSi}%` }} />
                <div className={styles.av} style={{ width: `${b.pctAv}%` }} />
                <div className={styles.no} style={{ width: `${b.pctNo}%` }} />
              </div>
            </div>
          ))}
          <div className={styles.miniLegend}>
            <span className={styles.si}><i />Sí</span>
            <span className={styles.av}><i />A veces</span>
            <span className={styles.no}><i />No</span>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>Sin datos de directivas para este grupo.</div>
      )}
      {counts.total > 0 && (
        <div className={`${styles.directivesPieWrap} ${tall ? styles.directivesPieWrapTall : ''}`}>
          <PieChart data={pieConfig.data} options={pieConfig.options} />
        </div>
      )}
    </Card>
  );
}
