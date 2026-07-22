import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import PieChart from '../charts/PieChart.jsx';
import { uniqueSorted } from '../../lib/groups.js';
import { coursePieConfig } from '../../lib/chartConfigs.js';
import styles from './DocenteView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderCoursePieChart
   (líneas 2107-2171). Gráfico "Distribución de Encuestas": por curso si no hay un
   curso específico seleccionado, o por sección si sí lo hay. */

export default function CoursePieChart({ cursoRows, curso }) {
  const groupField = curso ? 'seccion' : 'curso';
  const rawLabels = useMemo(() => uniqueSorted(cursoRows, groupField), [cursoRows, groupField]);

  if (cursoRows.length === 0 || rawLabels.length <= 1) return null;

  const prefix = curso ? 'Sección ' : 'Curso ';
  const labels = rawLabels.map((l) => {
    const s = String(l);
    return s.toLowerCase().startsWith(curso ? 'sec' : 'cur') ? s : prefix + s;
  });
  const data = rawLabels.map((l) => cursoRows.filter((r) => r[groupField] === l).length);
  const config = coursePieConfig(labels, data);
  const note = curso ? 'Distribución de encuestados por Sección' : 'Distribución de encuestados por Curso';

  return (
    <Card title="Distribución de Encuestas" note={note} className={`chart-card ${cardStyles.chartCard} ${styles.pieChartCard}`}>
      <PieChart data={config.data} options={config.options} />
    </Card>
  );
}
