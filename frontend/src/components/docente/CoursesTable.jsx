import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import DataTable from '../common/DataTable.jsx';
import styles from './DocenteView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderCoursesTable
   (líneas 2173-2208) + markup (líneas 748-760). El clic abre la modal de detalle
   del curso (Tarea 12) vía onOpenCurso(group).

   `groups` viene de GET /api/encuestas/consolidado (groupRows, ya acotado al
   docente vigente — ver DocenteView.jsx), un registro por curso+ciclo+sección
   ya agregado en el backend: no hace falta reagrupar respuestas crudas. */

const COLUMNS = [
  { key: 'curso', label: 'Curso' },
  { key: 'ciclo', label: 'Ciclo' },
  { key: 'seccion', label: 'Sección' },
  { key: 'nota', label: 'Nota Dim I' },
  { key: 'cumplimiento', label: '% Cumpl. (Sí)' },
  { key: 'n', label: 'N° Encuestas' }
];

export default function CoursesTable({ groups: groupsProp, onOpenCurso }) {
  const groups = useMemo(() => (
    [...groupsProp].sort((a, b) => (
      String(b.ciclo).localeCompare(String(a.ciclo), 'es') || a.curso.localeCompare(b.curso, 'es')
    ))
  ), [groupsProp]);

  return (
    <Card 
      title="Cursos dictados por el docente"
      className={`table-card ${cardStyles.tableCard}`}
    >
      <DataTable
        columns={COLUMNS}
        rows={groups}
        emptyMessage="No hay cursos registrados para este filtro."
        renderRow={(g) => (
          <tr key={[g.curso, g.ciclo, g.seccion, g.aula].join('|||')}>
            <td
              className={styles.clickableCurso}
              title="Ver las encuestas realizadas en este curso"
              onClick={() => onOpenCurso?.(g)}
            >
              {g.curso}
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
            <td>{g.nValidas}</td>
          </tr>
        )}
      />
    </Card>
  );
}
