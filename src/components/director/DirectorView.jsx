import { useMemo } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { useDirectorFilters } from '../../hooks/useDirectorFilters.js';
import { buildGroups, getFollowUpGroups } from '../../lib/groups.js';
import Filters from './Filters.jsx';
import AlertBanner from './AlertBanner.jsx';
import KpiGrid from './KpiGrid.jsx';
import CriteriaChart from './CriteriaChart.jsx';
import DirectivesChart from './DirectivesChart.jsx';
import CicloTrendChart from './CicloTrendChart.jsx';
import DetailTable from './DetailTable.jsx';
import styles from './DirectorView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderDirectorView (líneas 1827-1837)
   + markup de la sección #directorView (líneas 602-680). */

export default function DirectorView({ onOpenSeguimiento, onOpenCurso }) {
  const { rows, directiveLabels, shortCriteriaLabels } = useData();
  const {
    filters, setFilter, reset, search, setSearch, sort, setSort, filteredRows, options
  } = useDirectorFilters(rows);

  const groups = useMemo(() => buildGroups(filteredRows), [filteredRows]);
  const followUpGroups = useMemo(() => getFollowUpGroups(groups), [groups]);

  return (
    <div className={styles.directorView}>
      <Filters filters={filters} options={options} onChange={setFilter} onReset={reset} />

      <AlertBanner groups={followUpGroups} onOpenSeguimiento={() => onOpenSeguimiento?.(followUpGroups)} />

      <KpiGrid rows={filteredRows} groups={groups} />

      <div className={styles.chartsGrid}>
        <CriteriaChart rows={filteredRows} labels={shortCriteriaLabels} />
        <DirectivesChart rows={filteredRows} directiveLabels={directiveLabels} />
      </div>

      <CicloTrendChart rows={filteredRows} />

      <DetailTable
        groups={groups}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSort={setSort}
        onOpenCurso={onOpenCurso}
      />
    </div>
  );
}
