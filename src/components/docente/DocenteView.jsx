import { useState } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { exportToExcel } from '../../lib/excel.js';
import PrintHeader from '../common/PrintHeader.jsx';
import FilterPanel from './FilterPanel.jsx';
import DocenteHeader from './DocenteHeader.jsx';
import DocenteTabs from './DocenteTabs.jsx';
import RadarPanel from './RadarPanel.jsx';
import DirectivesChecklist from './DirectivesChecklist.jsx';
import CoursePieChart from './CoursePieChart.jsx';
import CoursesTable from './CoursesTable.jsx';
import RawResponsesTable from './RawResponsesTable.jsx';
import PrintStatBox from './PrintStatBox.jsx';
import styles from './DocenteView.module.css';
import appStyles from '../../App.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderDocenteView
   (líneas 2453-2480) + markup de la sección #docenteView (líneas 682-785).
   El botón Excel se conecta en la Tarea 13 (exportToExcel, src/lib/excel.js).

   Tarea 14 (impresión/PDF): el reference mantiene #tabResumen y #tabRespuestas
   siempre presentes en el DOM y usa `@media print { #tabResumen, #tabRespuestas
   { display:block !important; } }` (línea 502) para que el PDF incluya ambas
   secciones sin importar qué pestaña esté activa en pantalla ("Plantilla fija").
   Para replicar eso con las pestañas controladas por estado de React, ambos
   paneles se montan siempre y el que no está activo se oculta en pantalla con
   `style={{ display: 'none' }}` (no con render condicional); las reglas de
   impresión en global.css fuerzan `display: block !important` sobre
   `.tab-resumen`/`.tab-respuestas`, lo que gana sobre el `display:none` inline
   porque una declaración `!important` de la hoja de estilos vence a un estilo
   inline no-important. */

export default function DocenteView({
  onOpenCriteriaInfo, onOpenCurso,
  sel, cursoLabel, setSel, reset, options, docenteRows, cursoRows, programaRows,
  onToggleCiclo, onClearCiclo,
}) {
  const { criteriaLabels, directiveLabels, shortCriteriaLabels } = useData();
  const cursoDisplay = sel.curso ? cursoLabel : '';
  const [tab, setTab] = useState('resumen');
  const [exporting, setExporting] = useState(false);
  const [criteriaView, setCriteriaView] = useState('radar');

  const handleExportExcel = async () => {
    if (!sel.selected || cursoRows.length === 0 || exporting) return;
    setExporting(true);
    try {
      await exportToExcel({
        programa: sel.programa,
        docente: sel.selected,
        curso: cursoDisplay,
        rows: cursoRows,
        allDocenteRows: docenteRows,
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
      <PrintHeader docente={sel.selected} curso={cursoDisplay} />

      <FilterPanel
        sel={sel} options={options} onChange={setSel}
        onToggleCiclo={onToggleCiclo} onClearCiclo={onClearCiclo}
        onReset={reset}
      />

      <div className={`content-shell ${appStyles.shell}`}>
        <DocenteHeader selected={sel.selected} cursoRows={cursoRows} programaRows={programaRows} />

        <PrintStatBox cursoRows={cursoRows} programaRows={programaRows} criteriaLabels={criteriaLabels} />

        <DocenteTabs active={tab} onChange={setTab} />

        <div className="tab-resumen" style={{ display: tab === 'resumen' ? undefined : 'none' }}>
          <div className={`charts-grid ${styles.chartsGrid}`}>
            <RadarPanel
              cursoRows={cursoRows}
              programaRows={programaRows}
              shortCriteriaLabels={shortCriteriaLabels}
              criteriaLabels={criteriaLabels}
              nCrit={criteriaLabels.length}
              onOpenCriteriaInfo={onOpenCriteriaInfo}
              view={criteriaView}
              onViewChange={setCriteriaView}
            />
            <DirectivesChecklist cursoRows={cursoRows} directiveLabels={directiveLabels} tall={criteriaView === 'radar'} />
          </div>

          <CoursePieChart cursoRows={cursoRows} curso={sel.curso} />

          <CoursesTable docenteRows={docenteRows} onOpenCurso={onOpenCurso} />
        </div>

        <div className="tab-respuestas" style={{ display: tab === 'respuestas' ? undefined : 'none' }}>
          <RawResponsesTable cursoRows={cursoRows} criteriaLabels={criteriaLabels} directiveLabels={directiveLabels} />
        </div>

        <div className={`no-print ${styles.printBar}`}>
          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.excelBtn}`}
            onClick={handleExportExcel}
            disabled={!sel.selected || cursoRows.length === 0 || exporting}
          >
            {exporting ? 'Generando Excel...' : 'Descargar Excel (Formato Oficial)'}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => window.print()}>
            Imprimir / Exportar a PDF
          </button>
        </div>

        {/* Acotación al pie (visible también en el PDF): recuerda que los cálculos
            dependen de los filtros activos. Portado del HTML original. */}
        <p className={styles.docenteFootnote}>
          Los porcentajes y promedios se calculan sobre las encuestas que cumplen los filtros
          activos. Verifique siempre el N° de encuestas antes de interpretar un resultado.
        </p>
      </div>
    </div>
  );
}
