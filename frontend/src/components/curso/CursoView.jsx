import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext.jsx';
import { useCursoFilters } from '../../hooks/useCursoFilters.js';
import { exportCursoToExcel } from '../../lib/excel.js';
import { api } from '../../services/api.js';
import { buildRawResponseRows, buildDetailedResponseRows } from '../../lib/rawResponsesFromView.js';
import { toSummaryGroup } from '../../lib/directorGroups.js';
import { computeCriteriaAveragesFromView } from '../../lib/statsFromViews.js';
import PrintHeader from '../common/PrintHeader.jsx';
import CursoFilterPanel from './CursoFilterPanel.jsx';
import CursoHeader from './CursoHeader.jsx';
import DocenteTabs from '../docente/DocenteTabs.jsx';
import RadarPanel from '../docente/RadarPanel.jsx';
import DirectivesChecklist from '../docente/DirectivesChecklist.jsx';
import CoursePieChart from '../docente/CoursePieChart.jsx';
import DocentesTable from './DocentesTable.jsx';
import RawResponsesTable from '../docente/RawResponsesTable.jsx';
import PrintStatBox from '../docente/PrintStatBox.jsx';
import styles from '../docente/DocenteView.module.css';
import appStyles from '../../App.module.css';

export default function CursoView({ onOpenCriteriaInfo, onOpenDocente }) {
  const { criteriaLabels, directiveLabels, shortCriteriaLabels, groupRows, criterios } = useData();

  // Catálogo completo de programas/cursos (GET /api/programas + GET
  // /api/asignaturas), independiente de qué tenga encuestas cargadas — ver
  // useCursoFilters.js.
  const [catalogo, setCatalogo] = useState({ programas: [], asignaturas: [] });
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.programas.listar(), api.asignaturas.listar()])
      .then(([programas, asignaturas]) => { if (!cancelled) setCatalogo({ programas, asignaturas }); })
      .catch((err) => console.error('No se pudo cargar el catálogo de programas/asignaturas:', err));
    return () => { cancelled = true; };
  }, []);

  const { sel, setSel, reset, options, filteredRows, programaRows } = useCursoFilters(groupRows, catalogo);
  const [tab, setTab] = useState('resumen');
  const [exporting, setExporting] = useState(false);
  const [criteriaView, setCriteriaView] = useState('radar');

  // CoursePieChart: distribución por sección dentro del curso seleccionado,
  // vía GET /api/encuestas/consolidado (groupRows, ver lib/directorGroups.js).
  const pieChartGroups = useMemo(
    () => groupRows.filter((g) => g.curso === sel.curso),
    [groupRows, sel.curso]
  );

  // DocentesTable ("Docentes que dictaron este curso"): mismos grupos del
  // pie chart, mapeados a nota/cumplimiento (ver lib/directorGroups.js).
  const docentesTableGroups = useMemo(
    () => pieChartGroups.map(toSummaryGroup),
    [pieChartGroups]
  );

  // Export a Excel: /api/encuestas/respuestas filtrado por asignatura_id
  // (filteredRows ya es consolidado, trae asignaturaId directo — ver
  // context/DataContext.jsx), acotado a las secciones vigentes en pantalla
  // vía lib/rawResponsesFromView.js.
  const asignaturaId = filteredRows[0]?.asignaturaId;
  const [respuestasCurso, setRespuestasCurso] = useState([]);
  useEffect(() => {
    if (!asignaturaId) { setRespuestasCurso([]); return; }
    let cancelled = false;
    api.encuestas.respuestas({ asignatura_id: asignaturaId })
      .then((data) => { if (!cancelled) setRespuestasCurso(data); })
      .catch((err) => { console.error('No se pudo cargar /api/encuestas/respuestas:', err); if (!cancelled) setRespuestasCurso([]); });
    return () => { cancelled = true; };
  }, [asignaturaId]);

  const rawResponseRowsCurso = useMemo(
    () => buildRawResponseRows(respuestasCurso, filteredRows, directiveLabels),
    [respuestasCurso, filteredRows, directiveLabels]
  );
  const detailedResponseRowsCurso = useMemo(
    () => buildDetailedResponseRows(respuestasCurso, filteredRows, directiveLabels, groupRows),
    [respuestasCurso, filteredRows, directiveLabels, groupRows]
  );

  // PrintStatBox (Tabla "Detalle por criterio", solo en el PDF): el promedio
  // del programa se calcula desde la vista de criterios (v_promedio_por_criterio),
  // no desde filas crudas -- programaRows ya es consolidado (grupos, sin .scores).
  const programaAvgs = useMemo(
    () => computeCriteriaAveragesFromView(criterios, programaRows).avgs,
    [criterios, programaRows]
  );

  const handleExportExcel = async () => {
    if (!sel.curso || filteredRows.length === 0 || exporting) return;
    setExporting(true);
    try {
      await exportCursoToExcel({
        programa: sel.programa,
        curso: sel.curso,
        rows: detailedResponseRowsCurso,
        rawRows: rawResponseRowsCurso,
        docentesTableGroups,
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

      <CursoFilterPanel
        sel={sel} options={options} onChange={setSel} onReset={reset}
      />

      <div className={`content-shell ${appStyles.shell}`}>
        <CursoHeader
          selectedCurso={sel.curso}
          filteredRows={filteredRows}
          programaRows={programaRows}
        />

        {filteredRows.length > 0 && sel.curso && (
          <>
            <PrintStatBox cursoRows={detailedResponseRowsCurso} programaAvgs={programaAvgs} criteriaLabels={criteriaLabels} />

            <DocenteTabs active={tab} onChange={setTab} />

            <div className="tab-resumen" style={{ display: tab === 'resumen' ? undefined : 'none' }}>
              <div className={`charts-grid ${styles.chartsGrid}`}>
                <RadarPanel
                  cursoRows={filteredRows}
                  programaRows={programaRows}
                  onOpenCriteriaInfo={() => onOpenCriteriaInfo(detailedResponseRowsCurso)}
                  view={criteriaView}
                  onViewChange={setCriteriaView}
                />
                <DirectivesChecklist cursoRows={filteredRows} tall={criteriaView === 'radar'} />
              </div>

              <CoursePieChart groups={pieChartGroups} curso={sel.curso} />

              <DocentesTable groups={docentesTableGroups} onOpenDocente={onOpenDocente} />
            </div>

            <div className="tab-respuestas" style={{ display: tab === 'respuestas' ? undefined : 'none' }}>
              <RawResponsesTable cursoRows={rawResponseRowsCurso} criteriaLabels={criteriaLabels} directiveLabels={directiveLabels} />
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
    </div>
  );
}
