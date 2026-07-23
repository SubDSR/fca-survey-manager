import { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { useDirectorFilters } from '../../hooks/useDirectorFilters.js';
import { buildGroups, getFollowUpGroups } from '../../lib/groups.js';
import { exportDirectorToExcel } from '../../lib/excel.js';
import PrintHeader from '../common/PrintHeader.jsx';
import Filters from './Filters.jsx';
import AlertBanner from './AlertBanner.jsx';
import KpiGrid from './KpiGrid.jsx';
import CriteriaChart from './CriteriaChart.jsx';
import DirectivesChart from './DirectivesChart.jsx';
import CicloTrendChart from './CicloTrendChart.jsx';
import DetailTable from './DetailTable.jsx';
import styles from './DirectorView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderDirectorView (líneas 1827-1837)
   + markup de la sección #directorView (líneas 602-680). Se añade la exportación general
   (Excel + PDF) de la vista, análoga a la de la Vista Docente Individual. */

export default function DirectorView({ onOpenSeguimiento, onSelectDocente }) {
  const { rows, criteriaLabels, directiveLabels, shortCriteriaLabels } = useData();
  const {
    filters, setFilter, reset, search, setSearch, sort, setSort, filteredRows, options
  } = useDirectorFilters(rows);

  const groups = useMemo(() => buildGroups(filteredRows), [filteredRows]);
  const followUpGroups = useMemo(() => getFollowUpGroups(groups), [groups]);
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if (filteredRows.length === 0 || exporting) return;
    setExporting(true);
    try {
      await exportDirectorToExcel({
        rows: filteredRows,
        groups,
        criteriaLabels,
        directiveLabels,
        shortCriteriaLabels,
        filters,
      });
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al generar el archivo Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.directorView}>
      <PrintHeader filters={filters} />
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
        onSelectDocente={onSelectDocente}
        actions={
          <div className={`no-print ${styles.printBarHeader}`}>
            <button
              type="button"
              className={`${styles.btnPrimary} ${styles.excelBtn}`}
              onClick={handleExportExcel}
              disabled={filteredRows.length === 0 || exporting}
            >
              {exporting ? (
                'Exportando...'
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <path d="M8 13h8"></path>
                    <path d="M8 17h8"></path>
                    <path d="M12 13v8"></path>
                  </svg>
                  Excel
                </>
              )}
            </button>
            <button type="button" className={styles.btnPrimary} onClick={() => {
              const originalTitle = document.title;
              document.title = 'Reporte_General_Director';
              window.print();
              setTimeout(() => { document.title = originalTitle; }, 500);
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              PDF
            </button>
          </div>
        }
      />
    </div>
  );
}
