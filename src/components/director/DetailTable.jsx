import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import DataTable from '../common/DataTable.jsx';
import { normKey } from '../../lib/csv.js';
import styles from './DetailTable.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderDetailTable (líneas 1765-1826)
   + markup de la tabla (líneas 656-679). Igual que el original, sólo el nombre del docente es
   clickeable y lleva a la Vista Docente Individual con ese profesor preseleccionado
   (listener de .clickable-docente en líneas 1815-1824). */

const COLUMNS = [
  { key: 'docente', label: 'Docente' },
  { key: 'programa', label: 'Programa' },
  { key: 'ciclo', label: 'Ciclo' },
  { key: 'seccion', label: 'Sección' },
  { key: 'aula', label: 'Aula' },
  { key: 'curso', label: 'Curso' },
  { key: 'nota', label: 'Nota Dim I' },
  { key: 'cumplimiento', label: '% Cumpl. (Sí)' },
  { key: 'n', label: 'N° Encuestas' }
];

export default function DetailTable({ groups, search, onSearchChange, sort, onSort, onSelectDocente }) {
  const rows = useMemo(() => {
    const term = normKey(search);
    let filtered = groups.filter((g) => {
      if (!term) return true;
      const haystack = normKey([g.docente, g.curso, g.programa, g.ciclo, g.seccion, g.aula].join(' '));
      return haystack.includes(term);
    });

    filtered = filtered.slice().sort((a, b) => {
      let va = a[sort.key];
      let vb = b[sort.key];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return sort.dir === 'asc' ? -1 : 1;
      if (va > vb) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [groups, search, sort]);

  return (
    <Card className={`table-card ${cardStyles.tableCard}`}>
      <div className={styles.tableHeader}>
        <h3>Detalle por docente / curso</h3>
        <input
          type="search"
          className="no-print"
          placeholder="Buscar docente, curso, sección, aula..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <DataTable
        columns={COLUMNS}
        rows={rows}
        sort={sort}
        onSort={onSort}
        emptyMessage="No se encontraron resultados para los filtros seleccionados."
        renderRow={(g) => (
          <tr key={[g.docente, g.curso, g.programa, g.ciclo, g.seccion, g.aula].join('|||')}>
            <td
              className={styles.clickableDocente}
              role="button"
              tabIndex={0}
              title="Ver desempeño individual de este docente"
              onClick={() => onSelectDocente(g)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectDocente(g); }
              }}
            >
              {g.docente}
            </td>
            <td>{g.programa}</td>
            <td>{g.ciclo}</td>
            <td>{g.seccion}</td>
            <td>{g.aula}</td>
            <td>{g.curso}</td>
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
