import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import BarChart from '../charts/BarChart.jsx';
import { computeCriteriaAverages } from '../../lib/stats.js';
import { criteriaBarConfig } from '../../lib/chartConfigs.js';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderCriteriaChart (líneas 1607-1639). */

export default function CriteriaChart({ rows, labels }) {
  const config = useMemo(() => {
    const avgs = computeCriteriaAverages(rows, labels.length);
    return criteriaBarConfig(avgs, labels);
  }, [rows, labels]);

  return (
    <Card
      title="Promedio por criterio evaluado"
      note="Escala 1–20 · Dimensión I: Evaluación del desarrollo del curso"
      className={`chart-card ${cardStyles.chartCard}`}
    >
      <BarChart data={config.data} options={config.options} />
    </Card>
  );
}
