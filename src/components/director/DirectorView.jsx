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
      <PrintHeader />
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
      />

      <div className={`no-print ${styles.printBar}`}>
        <button
          type="button"
          className={`${styles.btnPrimary} ${styles.excelBtn}`}
          onClick={handleExportExcel}
          disabled={filteredRows.length === 0 || exporting}
        >
          {exporting ? 'Generando Excel...' : 'Descargar Excel (Vista General)'}
        </button>
        <button type="button" className={styles.btnPrimary} onClick={() => window.print()}>
          Imprimir / Exportar a PDF
        </button>
      </div>
    </div>
  );
}
