import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import RadarChart from '../charts/RadarChart.jsx';
import { computeCriteriaAverages } from '../../lib/stats.js';
import { radarConfig } from '../../lib/chartConfigs.js';
import styles from './DocenteView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderRadarChart
   (líneas 1976-2032) + botón "Más información" (línea 729, buildCriteriaInfoHtml
   líneas 2375-2417 -> se delega a onOpenCriteriaInfo, la modal es Tarea 12). */

export default function RadarPanel({ cursoRows, programaRows, shortCriteriaLabels, nCrit, onOpenCriteriaInfo }) {
  const config = useMemo(() => {
    const docenteAvgs = computeCriteriaAverages(cursoRows, nCrit);
    const programaAvgs = computeCriteriaAverages(programaRows, nCrit);
    return radarConfig(shortCriteriaLabels, docenteAvgs, programaAvgs);
  }, [cursoRows, programaRows, shortCriteriaLabels, nCrit]);

  const hasData = cursoRows.length > 0;

  return (
    <Card
      title="Desempeño por criterio"
      note="Su promedio vs. promedio general del programa · escala 20"
      className={`chart-card ${cardStyles.chartCard}`}
    >
      {hasData && <RadarChart data={config.data} options={config.options} />}
      <button
        type="button"
        className={`no-print ${styles.btnMoreInfo}`}
        onClick={() => onOpenCriteriaInfo?.(cursoRows)}
      >
        Más información ▾
      </button>
    </Card>
  );
}
