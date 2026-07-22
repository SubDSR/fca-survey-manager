import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import LineChart from '../charts/LineChart.jsx';
import { computeDirectiveCounts } from '../../lib/stats.js';
import { cicloTrendConfig, cicloSortValue } from '../../lib/chartConfigs.js';
import styles from './CicloTrendChart.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderCicloTrendChart (líneas 1687-1764). */

function uniqueValues(rows, field) {
  return Array.from(new Set(rows.map((r) => r[field])));
}

export default function CicloTrendChart({ rows }) {
  const rowsByCiclo = useMemo(() => {
    const ciclos = uniqueValues(rows, 'ciclo').sort((a, b) => cicloSortValue(a) - cicloSortValue(b));
    return ciclos.map((ciclo) => {
      const cicloRows = rows.filter((r) => r.ciclo === ciclo);
      const nota = cicloRows.length
        ? Math.round((cicloRows.reduce((a, r) => a + r.notaFinal, 0) / cicloRows.length) * 10) / 10
        : 0;
      const cumplimiento = Math.round(computeDirectiveCounts(cicloRows).pctSi);
      return { ciclo, nota, cumplimiento };
    });
  }, [rows]);

  // Si hay 0 o 1 ciclo no hay tendencia que mostrar: se oculta la tarjeta (igual que el original).
  if (rowsByCiclo.length <= 1) return null;

  const config = cicloTrendConfig(rowsByCiclo);

  return (
    <Card
      title="Evolución de Nota Promedio y Cumplimiento por Ciclo"
      note="Comparación entre ciclos académicos · línea punteada = nota mínima aceptable (11)"
      className={['chart-card', cardStyles.chartCard, styles.cicloTrendCard].join(' ')}
    >
      <LineChart data={config.data} options={config.options} />
    </Card>
  );
}
