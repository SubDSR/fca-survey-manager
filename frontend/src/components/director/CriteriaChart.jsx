import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import BarChart from '../charts/BarChart.jsx';
import { useData } from '../../context/DataContext.jsx';
import { computeCriteriaAveragesFromView } from '../../lib/statsFromViews.js';
import { criteriaBarConfig } from '../../lib/chartConfigs.js';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderCriteriaChart (líneas 1607-1639).
   Los promedios por criterio vienen de GET /api/encuestas/criterios (v_promedio_por_criterio),
   filtrados a los grupos (docenteId+ciclo+seccion) presentes en `rows`. */

export default function CriteriaChart({ rows }) {
  const { criterios, criteriosError } = useData();
  const config = useMemo(() => {
    const { labels, avgs } = computeCriteriaAveragesFromView(criterios, rows);
    return criteriaBarConfig(avgs, labels);
  }, [criterios, rows]);

  return (
    <Card
      title="Promedio por criterio evaluado"
      note="Escala 1–20 · Dimensión I: Evaluación del desarrollo del curso"
      className={`chart-card ${cardStyles.chartCard}`}
    >
      {criteriosError ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>{criteriosError}</div>
      ) : (
        <BarChart data={config.data} options={config.options} />
      )}
    </Card>
  );
}
