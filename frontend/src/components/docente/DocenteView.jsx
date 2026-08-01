import { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { exportToExcel } from '../../lib/excel.js';
import { api } from '../../services/api.js';
import { buildRawResponseRows, buildDetailedResponseRows } from '../../lib/rawResponsesFromView.js';
import { toSummaryGroup } from '../../lib/directorGroups.js';
import { computeCriteriaAveragesFromView } from '../../lib/statsFromViews.js';
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
  const { criteriaLabels, directiveLabels, shortCriteriaLabels, groupRows, criterios } = useData();
  const cursoDisplay = sel.curso ? cursoLabel : '';
  const [tab, setTab] = useState('resumen');
  const [exporting, setExporting] = useState(false);
  const [criteriaView, setCriteriaView] = useState('radar');

  // Detalle de Encuestados (tab "respuestas"): viene de GET /api/encuestas/respuestas
  // filtrado por docente_id en el backend; el recorte a la sección exacta
  // (curso/ciclo/sección activos) se hace en el cliente vía buildRawResponseRows,
  // uniendo por docenteId+asignaturaId+grupoId igual que lib/statsFromViews.js.
  // docenteRows ya es consolidado (GET /api/encuestas/consolidado, ver
  // context/DataContext.jsx), así que el docenteId viene directo de la fila.
  const docenteId = docenteRows[0]?.docenteId ?? null;
  const [respuestas, setRespuestas] = useState([]);
  useEffect(() => {
    if (!docenteId) { setRespuestas([]); return; }
    let cancelled = false;
    api.encuestas.respuestas({ docente_id: docenteId })
      .then((data) => { if (!cancelled) setRespuestas(data); })
      .catch((err) => { console.error('No se pudo cargar /api/encuestas/respuestas:', err); if (!cancelled) setRespuestas([]); });
    return () => { cancelled = true; };
  }, [docenteId]);

  const rawResponseRows = useMemo(
    () => buildRawResponseRows(respuestas, cursoRows, directiveLabels),
    [respuestas, cursoRows, directiveLabels]
  );

  // Export a Excel: filas con shape de dataset.csv (docente/programa/curso/
  // aula/ciclo/seccion/scores/notaFinal/directivas), construidas desde
  // /api/encuestas/respuestas — ver lib/rawResponsesFromView.js.
  const detailedCursoRows = useMemo(
    () => buildDetailedResponseRows(respuestas, cursoRows, directiveLabels, groupRows),
    [respuestas, cursoRows, directiveLabels, groupRows]
  );
  const detailedDocenteRows = useMemo(
    () => buildDetailedResponseRows(respuestas, docenteRows, directiveLabels, groupRows),
    [respuestas, docenteRows, directiveLabels, groupRows]
  );

  // PrintStatBox (Tabla "Detalle por criterio", solo en el PDF): el promedio
  // del programa se calcula desde la vista de criterios (v_promedio_por_criterio),
  // no desde filas crudas -- programaRows ya es consolidado (grupos, sin .scores).
  const programaAvgs = useMemo(
    () => computeCriteriaAveragesFromView(criterios, programaRows).avgs,
    [criterios, programaRows]
  );

  // Grupos de este docente vía GET /api/encuestas/consolidado (groupRows):
  // base para CoursePieChart y CoursesTable ("Cursos dictados por el docente").
  const docenteGroups = useMemo(
    () => groupRows.filter((g) => g.docenteId === docenteId),
    [groupRows, docenteId]
  );
  const coursesTableGroups = useMemo(
    () => docenteGroups.map(toSummaryGroup),
    [docenteGroups]
  );

  // CoursePieChart: se acota además, si hay un curso específico seleccionado,
  // a su asignaturaId (cursoRows ya es consolidado, trae asignaturaId directo —
  // ver context/DataContext.jsx).
  const pieChartGroups = useMemo(() => {
    if (!sel.curso) return docenteGroups;
    const asignaturaId = cursoRows[0]?.asignaturaId;
    return asignaturaId != null ? docenteGroups.filter((g) => g.asignaturaId === asignaturaId) : docenteGroups;
  }, [docenteGroups, sel.curso, cursoRows]);

  const handleExportExcel = async () => {
    if (!sel.selected || cursoRows.length === 0 || exporting) return;
    setExporting(true);
    try {
      await exportToExcel({
        programa: sel.programa,
        docente: sel.selected,
        curso: cursoDisplay,
        rows: detailedCursoRows,
        rawRows: rawResponseRows,
        allDocenteRows: detailedDocenteRows,
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
      <PrintHeader docente={sel.selected} curso={cursoDisplay} filters={false} />

      <FilterPanel
        sel={sel} options={options} onChange={setSel}
        onToggleCiclo={onToggleCiclo} onClearCiclo={onClearCiclo}
        onReset={reset}
      />

      <div className={`content-shell ${appStyles.shell}`}>
        <DocenteHeader selected={sel.selected} cursoRows={cursoRows} programaRows={programaRows} />

        <PrintStatBox cursoRows={detailedCursoRows} programaAvgs={programaAvgs} criteriaLabels={criteriaLabels} />

        <DocenteTabs active={tab} onChange={setTab} />

        <div className="tab-resumen" style={{ display: tab === 'resumen' ? undefined : 'none' }}>
          <div className={`charts-grid ${styles.chartsGrid}`}>
            <RadarPanel
              cursoRows={cursoRows}
              programaRows={programaRows}
              onOpenCriteriaInfo={() => onOpenCriteriaInfo(detailedCursoRows)}
              view={criteriaView}
              onViewChange={setCriteriaView}
            />
            <DirectivesChecklist cursoRows={cursoRows} tall={criteriaView === 'radar'} />
          </div>

          <CoursePieChart groups={pieChartGroups} curso={sel.curso} />

          <CoursesTable groups={coursesTableGroups} onOpenCurso={onOpenCurso} />
        </div>

        <div className="tab-respuestas" style={{ display: tab === 'respuestas' ? undefined : 'none' }}>
          <RawResponsesTable cursoRows={rawResponseRows} criteriaLabels={criteriaLabels} directiveLabels={directiveLabels} />
        </div>

        <div className={`no-print ${styles.printBar}`}>
          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.excelBtn}`}
            onClick={handleExportExcel}
            disabled={!sel.selected || cursoRows.length === 0 || exporting}
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
            document.title = `Reporte_${sel.selected.replace(/\s+/g, '_')}`;
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
