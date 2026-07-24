import { useMemo } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import DataTable from '../common/DataTable.jsx';
import { normKey } from '../../lib/csv.js';
import { computeGroupStats } from '../../lib/stats.js';
import styles from './DetailTable.module.css';

const COLUMNS = [
  { key: 'docente', label: 'Docente' },
  { key: 'programa', label: 'Programa' },
  { key: 'curso', label: 'Cursos' },
  { key: 'nota', label: 'Nota Dim I' },
  { key: 'cumplimiento', label: '% Cumpl. (Sí)' },
  { key: 'n', label: 'N° Encuestas' }
];

export default function DetailTable({ groups, search, onSearchChange, sort, onSort, onSelectDocente, actions }) {
  const rows = useMemo(() => {
    // 1. Group by docente
    const map = new Map();
    groups.forEach(g => {
      if (!map.has(g.docente)) {
        map.set(g.docente, {
          docente: g.docente,
          programa: new Set(),
          curso: new Set(),
          allRows: []
        });
      }
      const d = map.get(g.docente);
      if (g.programa) d.programa.add(g.programa);
      if (g.curso) d.curso.add(g.curso);
      d.allRows.push(...g.rows);
    });

    const docenteGroups = Array.from(map.values()).map(d => {
      const stats = computeGroupStats(d.allRows);
      return {
        docente: d.docente,
        programa: Array.from(d.programa).join(', '),
        curso: Array.from(d.curso), // Keep as array for rendering
        nota: stats.nota,
        cumplimiento: stats.cumplimiento,
        n: stats.n
      };
    });

    const term = normKey(search);
    let filtered = docenteGroups.filter((g) => {
      if (!term) return true;
      const haystack = normKey([g.docente, ...g.curso, g.programa].join(' '));
      return haystack.includes(term);
    });

    filtered = filtered.slice().sort((a, b) => {
      let va = a[sort.key];
      let vb = b[sort.key];
      if (sort.key === 'curso') {
        va = a.curso.join(' ');
        vb = b.curso.join(' ');
      }
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
        <h3>Detalle por docente</h3>
        <div className={styles.headerControls}>
          {actions}
          <input
            type="search"
            className="no-print"
            placeholder="Buscar docente, curso, programa..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
      <DataTable
        columns={COLUMNS}
        rows={rows}
        sort={sort}
        onSort={onSort}
        emptyMessage="No se encontraron resultados para los filtros seleccionados."
        renderRow={(g) => (
          <tr key={[g.docente, g.programa].join('|||')}>
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
            <td>
              {g.curso.map((c, i) => (
                <div key={i} style={{ marginBottom: i < g.curso.length - 1 ? '4px' : 0 }}>
                  {c}
                </div>
              ))}
            </td>
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
