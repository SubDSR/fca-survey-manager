import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import BarChart from '../charts/BarChart.jsx';
import { useData } from '../../context/DataContext.jsx';
import { computeDirectiveBreakdownFromView } from '../../lib/statsFromViews.js';
import { directivesBarConfig } from '../../lib/chartConfigs.js';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderDirectivesChart (líneas 1640-1669).
   El desglose por directiva viene de GET /api/encuestas/directivas (v_encuesta_directivas),
   filtrado a los grupos (docenteId+ciclo+seccion) presentes en `rows`. */

export default function DirectivesChart({ rows }) {
  const { directivas } = useData();
  const config = useMemo(() => {
    const breakdown = computeDirectiveBreakdownFromView(directivas, rows);
    return directivesBarConfig(breakdown);
  }, [directivas, rows]);

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
