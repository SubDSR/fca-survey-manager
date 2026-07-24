import React, { useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { useCursoFilters } from '../../hooks/useCursoFilters.js';
import { exportCursoToExcel } from '../../lib/excel.js';
import PrintHeader from '../common/PrintHeader.jsx';
import CursoSelectors from './CursoSelectors.jsx';
import CursoHeader from './CursoHeader.jsx';
import DocenteTabs from '../docente/DocenteTabs.jsx';
import RadarPanel from '../docente/RadarPanel.jsx';
import DirectivesChecklist from '../docente/DirectivesChecklist.jsx';
import CoursePieChart from '../docente/CoursePieChart.jsx';
import DocentesTable from './DocentesTable.jsx';
import RawResponsesTable from '../docente/RawResponsesTable.jsx';
import PrintStatBox from '../docente/PrintStatBox.jsx';
import styles from '../docente/DocenteView.module.css';

export default function CursoView({ onOpenCriteriaInfo, onOpenDocente }) {
  const { rows, criteriaLabels, directiveLabels, shortCriteriaLabels } = useData();
  const { sel, setSel, reset, options, filteredRows, programaRows } = useCursoFilters(rows);
  const [tab, setTab] = useState('resumen');
  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    if (!sel.curso || filteredRows.length === 0 || exporting) return;
    setExporting(true);
    try {
      await exportCursoToExcel({
        programa: sel.programa,
        curso: sel.curso,
        rows: filteredRows,
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
    <div className={styles.docenteView}>
      <PrintHeader docente={sel.curso || 'Todos los cursos'} curso="" filters={false} />

      <CursoSelectors
        sel={sel}
        options={options}
        onChange={setSel}
      />

      <CursoHeader
        selectedCurso={sel.curso}
        filteredRows={filteredRows}
        programaRows={programaRows}
      />

      {filteredRows.length > 0 && sel.curso && (
        <>
          <PrintStatBox cursoRows={filteredRows} programaRows={programaRows} criteriaLabels={criteriaLabels} />

          <DocenteTabs active={tab} onChange={setTab} />

          <div className="tab-resumen" style={{ display: tab === 'resumen' ? undefined : 'none' }}>
            <div className={`charts-grid ${styles.chartsGrid}`}>
              <RadarPanel
                cursoRows={filteredRows}
                programaRows={programaRows}
                shortCriteriaLabels={shortCriteriaLabels}
                nCrit={criteriaLabels.length}
                onOpenCriteriaInfo={onOpenCriteriaInfo}
              />
              <DirectivesChecklist cursoRows={filteredRows} directiveLabels={directiveLabels} />
            </div>

            <CoursePieChart cursoRows={filteredRows} curso={sel.curso} />

            <DocentesTable filteredRows={filteredRows} onOpenDocente={onOpenDocente} />
          </div>

          <div className="tab-respuestas" style={{ display: tab === 'respuestas' ? undefined : 'none' }}>
            <RawResponsesTable cursoRows={filteredRows} criteriaLabels={criteriaLabels} directiveLabels={directiveLabels} />
          </div>

          <div className={`no-print ${styles.printBar}`}>
            <button
              type="button"
              className={`${styles.btnPrimary} ${styles.excelBtn}`}
              onClick={handleExportExcel}
              disabled={exporting}
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
              document.title = `Reporte_Curso_${sel.curso.replace(/\s+/g, '_')}`;
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
        </>
      )}

      <p className={styles.docenteFootnote}>
        Los porcentajes y promedios se calculan sobre las encuestas que cumplen los filtros
        activos. Verifique siempre el N° de encuestas antes de interpretar un resultado.
      </p>
    </div>
  );
}
