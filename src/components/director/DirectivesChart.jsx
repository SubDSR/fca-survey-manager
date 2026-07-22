import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import BarChart from '../charts/BarChart.jsx';
import { computeDirectiveBreakdown } from '../../lib/stats.js';
import { directivesBarConfig } from '../../lib/chartConfigs.js';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderDirectivesChart (líneas 1640-1669). */

export default function DirectivesChart({ rows, directiveLabels }) {
  const config = useMemo(() => {
    const breakdown = computeDirectiveBreakdown(rows, directiveLabels);
    return directivesBarConfig(breakdown);
  }, [rows, directiveLabels]);

  return (
    <Card
      title="Cumplimiento de directivas académicas"
      note="Distribución de respuestas por directiva"
      className={`chart-card ${cardStyles.chartCard}`}
    >
      <BarChart data={config.data} options={config.options} />
    </Card>
  );
}
