import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import DataTable from '../common/DataTable.jsx';
import styles from '../docente/DocenteView.module.css';

/* `groups` viene de GET /api/encuestas/consolidado (groupRows, ya acotado al
   curso vigente — ver CursoView.jsx), un registro por docente+ciclo+sección
   ya agregado en el backend: no hace falta reagrupar respuestas crudas. */

const COLUMNS = [
  { key: 'docente', label: 'Docente' },
  { key: 'ciclo', label: 'Ciclo' },
  { key: 'seccion', label: 'Sección' },
  { key: 'nota', label: 'Nota Dim I' },
  { key: 'cumplimiento', label: '% Cumpl. (Sí)' },
  { key: 'n', label: 'N° Encuestas' }
];

export default function DocentesTable({ groups: groupsProp, onOpenDocente }) {
  const groups = useMemo(() => (
    [...groupsProp].sort((a, b) => (
      a.docente.localeCompare(b.docente, 'es') || String(a.ciclo).localeCompare(String(b.ciclo), 'es')
    ))
  ), [groupsProp]);

  return (
    <Card 
      title="Docentes que dictaron este curso"
      className={`table-card ${cardStyles.tableCard}`}
    >
      <DataTable
        columns={COLUMNS}
        rows={groups}
        emptyMessage="No hay docentes registrados para este curso."
        renderRow={(g) => (
          <tr key={[g.docente, g.curso, g.ciclo, g.seccion, g.aula].join('|||')}>
            <td
              className={styles.clickableCurso}
              title="Ver las encuestas realizadas a este docente en este curso"
              onClick={() => onOpenDocente?.(g)}
            >
              {g.docente}
            </td>
            <td>{g.ciclo}</td>
            <td>{g.seccion}</td>
            <td>
              <div className={styles.tableBarWrapper}>
                <div className={styles.tableBarBg}>
                  <div className={`${styles.tableBarFill} ${styles.blue}`} style={{ width: `${(g.nota / 20) * 100}%` }} />
                </div>
                <div className={styles.tableBarValue}>{g.nota.toFixed(1)}</div>
              </div>
            </td>
            <td>
              <div className={styles.tableBarWrapper}>
                <div className={styles.tableBarBg}>
                  <div className={`${styles.tableBarFill} ${styles.green}`} style={{ width: `${g.cumplimiento}%` }} />
                </div>
                <div className={styles.tableBarValue}>{g.cumplimiento}%</div>
              </div>
            </td>
            <td>{g.n}</td>
          </tr>
        )}
      />
    </Card>
  );
}
