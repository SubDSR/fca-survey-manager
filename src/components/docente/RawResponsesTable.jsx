import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import tableStyles from '../common/DataTable.module.css';
import styles from './DocenteView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderRawResponsesTable
   (líneas 2306-2359). Tabla transpuesta: una columna por encuestado (E1, E2, ...). */

export default function RawResponsesTable({ cursoRows, criteriaLabels, directiveLabels }) {
  const hasData = cursoRows.length > 0;

  const chunks = [];
  if (hasData) {
    for (let i = 0; i < cursoRows.length; i += 19) {
      chunks.push(cursoRows.slice(i, i + 19));
    }
  }

  const renderTable = (rowsChunk, startIndex) => (
    <div className={`table-responsive ${tableStyles.tableResponsive}`}>
      <table className={`raw-responses-table ${styles.rawResponsesTable}`}>
        {hasData && (
          <thead>
            <tr>
              <th>Criterios Evaluados</th>
              {rowsChunk.map((_, i) => <th key={i}>{`E${startIndex + i + 1}`}</th>)}
            </tr>
          </thead>
        )}
        <tbody>
          {hasData ? (
            <>
              <tr className={styles.sectionRow}>
                <td>I. Evaluación del desarrollo del curso por el docente</td>
                <td colSpan={rowsChunk.length} />
              </tr>
              {criteriaLabels.map((label, critIndex) => (
                <tr key={`crit-${critIndex}`}>
                  <td>{critIndex + 1}. {label}</td>
                  {rowsChunk.map((row, rowIndex) => {
                    const val = row.scores[critIndex];
                    return (
                      <td key={rowIndex} className={styles.centerCell}>
                        {val !== null && val !== undefined ? val : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className={styles.sectionRow}>
                <td>II. Cumplimiento de directivas</td>
                <td colSpan={rowsChunk.length} />
              </tr>
              {directiveLabels.map((label, dirIndex) => (
                <tr key={`dir-${dirIndex}`}>
                  <td>{dirIndex + 7}. {label}</td>
                  {rowsChunk.map((row, rowIndex) => {
                    const dirObj = row.directivas.find((d) => d.label === label);
                    return (
                      <td key={rowIndex} className={styles.centerCell}>
                        {dirObj ? dirObj.value : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </>
          ) : (
            <tr>
              <td className={styles.rawEmptyCell}>No hay encuestas para generar el reporte detallado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <Card
      title="Tabla de Encuestados Individuales"
      note="Detalle individual por estudiante (E1, E2, E3...) para los filtros activos."
      className={`table-card ${cardStyles.tableCard}`}
    >
      <div className="no-print">
        {renderTable(cursoRows, 0)}
      </div>
      <div className="only-print">
        {hasData ? (
          chunks.map((chunk, index) => (
            <div key={index} style={{ pageBreakInside: 'avoid', marginBottom: '24px' }}>
              {renderTable(chunk, index * 19)}
            </div>
          ))
        ) : (
          renderTable(cursoRows, 0)
        )}
      </div>
    </Card>
  );
}
