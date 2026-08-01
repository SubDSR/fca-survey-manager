import { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { buildDirectorGroups, getFollowUpGroups } from '../../lib/directorGroups.js';
import { buildGroups } from '../../lib/groups.js';
import { buildDetailedResponseRows } from '../../lib/rawResponsesFromView.js';
import { api } from '../../services/api.js';
import { exportDirectorToExcel } from '../../lib/excel.js';
import PrintHeader from '../common/PrintHeader.jsx';
import Filters from './Filters.jsx';
import AlertBanner from './AlertBanner.jsx';
import KpiGrid from './KpiGrid.jsx';
import CriteriaChart from './CriteriaChart.jsx';
import DirectivesChart from './DirectivesChart.jsx';
import CicloTrendChart from './CicloTrendChart.jsx';
import DetailTable from './DetailTable.jsx';
import appStyles from '../../App.module.css';
import styles from './DirectorView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderDirectorView (líneas 1827-1837)
   + markup de la sección #directorView (líneas 602-680). Se añade la exportación general
   (Excel + PDF) de la vista, análoga a la de la Vista Docente Individual.

   Los filtros (Categoría/Programa/Ciclo/Sección/Docente/Estado) vienen de
   sharedFilters (useSharedFilters, instanciado en App.jsx y compartido con
   Evaluación Docente) — ver docs/superpowers/specs/2026-07-23-filtros-compartidos-design.md.
   search/sort son locales a esta vista, no son filtros compartidos.

   El contenido no-filtro va envuelto en content-shell/appStyles.shell (el
   mismo max-width que antes tenía <main>, ahora aplicado por cada vista) para
   que Filters quede fuera de esa restricción y llegue edge-to-edge como el
   TopbarRed (ver Tarea 2 del plan). */

export default function DirectorView({ onOpenSeguimiento, onSelectDocente, sharedFilters }) {
  const { criteriaLabels, directiveLabels, shortCriteriaLabels, directivas } = useData();
  const { filters, setFilter, toggleCiclo, clearCiclo, reset, options, filteredRows } = sharedFilters;

  const [search, setSearch] = useState('');
  const [sort, setSortState] = useState({ key: 'nota', dir: 'desc' });
  const setSort = (key) => setSortState((prev) => (
    prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
  ));

  // filteredRows viene de GET /api/encuestas/consolidado (groupRows), ya
  // agregado por grupo docente+curso+ciclo+sección: no hace falta reagrupar,
  // solo calcular el % de "No" (vía la vista de directivas) para el aviso de
  // seguimiento — ver lib/directorGroups.js.
  const groups = useMemo(() => buildDirectorGroups(filteredRows, directivas), [filteredRows, directivas]);
  const followUpGroups = useMemo(() => getFollowUpGroups(groups), [groups]);
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if (filteredRows.length === 0 || exporting) return;
    setExporting(true);
    try {
      // El Excel necesita el detalle por encuesta (criterios/directivas por
      // respuesta): se pide bajo demanda a GET /api/encuestas/respuestas y se
      // acota a las secciones vigentes en `filteredRows` (groupRows filtrado
      // por los filtros compartidos) por docenteId+asignaturaId+grupoId — ver
      // lib/rawResponsesFromView.js. `filteredRows` también sirve como fuente
      // de docente/programa/curso/aula por sección exacta.
      const respuestas = await api.encuestas.respuestas();
      const detailedRows = buildDetailedResponseRows(respuestas, filteredRows, directiveLabels, filteredRows);
      await exportDirectorToExcel({
        rows: detailedRows,
        groups: buildGroups(detailedRows),
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
      <Filters
        filters={filters} options={options} onChange={setFilter}
        onToggleCiclo={toggleCiclo} onClearCiclo={clearCiclo} onReset={reset}
      />

      <div className={`content-shell ${appStyles.shell}`}>
        <AlertBanner groups={followUpGroups} onOpenSeguimiento={() => onOpenSeguimiento?.(followUpGroups)} />

        <KpiGrid groups={groups} />

        <div className={styles.chartsGrid}>
          <CriteriaChart rows={filteredRows} />
          <DirectivesChart rows={filteredRows} />
        </div>

        <CicloTrendChart rows={groups} />

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
    </div>
  );
}
