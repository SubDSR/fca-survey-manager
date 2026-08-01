import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import PieChart from '../charts/PieChart.jsx';
import { coursePieConfig } from '../../lib/chartConfigs.js';
import styles from './DocenteView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderCoursePieChart
   (líneas 2107-2171). Gráfico "Distribución de Encuestas": por curso si no hay un
   curso específico seleccionado, o por sección si sí lo hay.

   Fuente: GET /api/encuestas/consolidado (groupRows, ver lib/directorGroups.js):
   cada fila ya es un grupo docente+asignatura+sección con su propio n_encuestas,
   así que no hace falta contar filas de dataset.csv. El llamador (DocenteView,
   CursoView) es responsable de acotar `groups` al docente o curso vigente antes
   de pasarlo aquí. */

function uniqueSortedBy(items, field) {
  return Array.from(new Set(items.map((i) => i[field]))).sort((a, b) => String(a).localeCompare(String(b), 'es'));
}

export default function CoursePieChart({ groups, curso }) {
  const groupField = curso ? 'seccion' : 'curso';
  const rawLabels = useMemo(() => uniqueSortedBy(groups, groupField), [groups, groupField]);

  if (groups.length === 0 || rawLabels.length <= 1) return null;

  const prefix = curso ? 'Sección ' : 'Curso ';
  const labels = rawLabels.map((l) => {
    const s = String(l);
    return s.toLowerCase().startsWith(curso ? 'sec' : 'cur') ? s : prefix + s;
  });
  const data = rawLabels.map((l) => groups.filter((g) => g[groupField] === l).reduce((a, g) => a + g.n, 0));
  const config = coursePieConfig(labels, data);
  const note = curso ? 'Distribución de encuestados por Sección' : 'Distribución de encuestados por Curso';

  return (
    <Card title="Distribución de Encuestas" note={note} className={`chart-card ${cardStyles.chartCard} ${styles.pieChartCard}`}>
      <PieChart data={config.data} options={config.options} />
    </Card>
  );
}
