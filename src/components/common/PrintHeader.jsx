import { LOGO_UNMSM } from '../../assets/logos.js';

/* Portado desde reference/dashboard_evaluacion_docente.html: markup de la
   cabecera/pie de impresión (líneas 573-587) + preparePrintMeta (líneas
   3095-3113), adaptado a React: en vez de escribir el DOM imperativamente
   antes de imprimir, la fecha y el alcance se calculan en cada render a
   partir de la selección de docente/curso vigente (props), así que ya están
   listos cuando el usuario dispara window.print() (Tarea 14, DocenteView.jsx).

   Oculto en pantalla vía `.print-header`/`.print-footer { display: none }`
   en global.css; visible solo dentro de `@media print`. */

function formatPrintDate(date) {
  const opcionesFecha = { year: 'numeric', month: 'long', day: 'numeric' };
  return 'Fecha de reporte: ' + date.toLocaleDateString('es-ES', opcionesFecha);
}

export default function PrintHeader({ docente, curso, filters }) {
  const subtitle = docente
    ? 'Reporte Individual de Desempeño Docente'
    : 'Unidad de Posgrado · Facultad de Ciencias Administrativas';

  const scope = docente
    ? 'Docente: ' + docente + (curso ? ' · Curso: ' + curso : ' · Todos sus cursos')
    : 'Reporte consolidado por programa/ciclo/sección';

  return (
    <>
      <div className="print-header">
        <img src={LOGO_UNMSM} alt="UNMSM FCA" />
        <div className="print-header-text">
          <h2>Reporte Oficial de Evaluación Docente</h2>
          <p className="print-subtitle">{subtitle}</p>
        </div>
        <div className="print-header-right">
          <p>{formatPrintDate(new Date())}</p>
          <p>{scope}</p>
        </div>
      </div>
      
      {filters && (
        <div className="print-metadata-box">
          <strong className="metadata-title">Filtros aplicados en este reporte:</strong>
          <ul>
            <li><strong>Categoría:</strong> {filters.categoria || 'Todas'}</li>
            <li><strong>Estado:</strong> {filters.estado ? (filters.estado === 'aprobado' ? 'Aprobados' : 'Desaprobados') : 'Todos'}</li>
            <li><strong>Programa:</strong> {filters.programa || 'Todos los programas'}</li>
            {filters.ciclo && <li><strong>Ciclo:</strong> {filters.ciclo}</li>}
            {filters.seccion && <li><strong>Sección:</strong> {filters.seccion}</li>}
            {filters.aula && <li><strong>Aula:</strong> {filters.aula}</li>}
            {filters.docente && <li><strong>Docente:</strong> {filters.docente}</li>}
          </ul>
        </div>
      )}
      <div className="print-footer">
        Reporte generado por el Dashboard de Evaluación Docente · Unidad de Posgrado, Facultad de Ciencias Administrativas · UNMSM
      </div>
    </>
  );
}
