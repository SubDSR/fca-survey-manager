import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import RadarChart from '../charts/RadarChart.jsx';
import { useData } from '../../context/DataContext.jsx';
import { computeCriteriaAveragesFromView } from '../../lib/statsFromViews.js';
import { radarConfig } from '../../lib/chartConfigs.js';
import styles from './DocenteView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderRadarChart
   (líneas 1976-2032) + botón "Más información" (línea 729, buildCriteriaInfoHtml
   líneas 2375-2417 -> se delega a onOpenCriteriaInfo, la modal es Tarea 12).

   Un toggle en la esquina superior derecha de la card alterna entre dos
   vistas del mismo par de datos (Docente vs. Promedio del programa):
   "Radar" muestra solo el gráfico de radar; "Barras" muestra solo el
   desglose por criterio (nota, barra 0-20 y desviación vs. el programa)
   — mismos docenteAvgs/programaAvgs que ya alimentan el radar, sin cálculo
   nuevo. Nunca se muestran los dos a la vez. */

export default function RadarPanel({ cursoRows, programaRows, onOpenCriteriaInfo, view, onViewChange }) {
  const { criterios } = useData();

  const { config, docenteAvgs, programaAvgs, labels } = useMemo(() => {
    const docente = computeCriteriaAveragesFromView(criterios, cursoRows);
    const programa = computeCriteriaAveragesFromView(criterios, programaRows);
    return {
      config: radarConfig(docente.labels, docente.avgs, programa.avgs),
      docenteAvgs: docente.avgs,
      programaAvgs: programa.avgs,
      labels: docente.labels,
    };
  }, [criterios, cursoRows, programaRows]);

  const hasData = cursoRows.length > 0;

  const headerAction = (
    <div className={`no-print ${styles.chartTypeToggle}`}>
      <button
        type="button"
        className={view === 'radar' ? styles.chartTypeActive : undefined}
        onClick={() => onViewChange('radar')}
      >
        Radar
      </button>
      <button
        type="button"
        className={view === 'barras' ? styles.chartTypeActive : undefined}
        onClick={() => onViewChange('barras')}
      >
        Barras
      </button>
    </div>
  );

  return (
    <Card
      title="Desempeño por criterio"
      note="Su promedio vs. promedio general del programa · escala 20"
      headerAction={headerAction}
      className={`chart-card ${cardStyles.chartCard}`}
    >
      {hasData && view === 'radar' && (
        <div className={styles.radarChartCol}>
          <RadarChart data={config.data} options={config.options} />
        </div>
      )}
      {hasData && view === 'barras' && (
        <div className={styles.criteriaBreakdown}>
          {labels.map((label, i) => {
            const value = docenteAvgs[i] || 0;
            const progValue = programaAvgs[i] || 0;
            const delta = Math.round((value - progValue) * 10) / 10;
            const deltaSign = delta > 0 ? '+' : '';
            const deltaClass = delta > 0.2 ? styles.criteriaBreakdownDeltaPos
              : delta < -0.2 ? styles.criteriaBreakdownDeltaNeg
              : styles.criteriaBreakdownDeltaNeu;
            const pct = Math.max(2, Math.min(100, (value / 20) * 100));
            return (
              <div key={label} className={styles.criteriaBreakdownRow}>
                <div className={styles.criteriaBreakdownHeader}>
                  <span className={styles.criteriaBreakdownShort}>{label}</span>
                  <span className={styles.criteriaBreakdownFull} title={label}>{label}</span>
                  <span className={styles.criteriaBreakdownValue}>{value.toFixed(1)}</span>
                  <span className={`${styles.criteriaBreakdownDelta} ${deltaClass}`}>{deltaSign}{delta.toFixed(1)}</span>
                </div>
                <span className={styles.criteriaBreakdownTrack}>
                  <span className={styles.criteriaBreakdownFill} style={{ width: `${pct}%` }} />
                </span>
              </div>
            );
          })}
        </div>
      )}
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
