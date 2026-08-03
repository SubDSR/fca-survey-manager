import { useMemo, useState, useEffect } from 'react';
import Card from '../common/Card.jsx';
import cardStyles from '../common/Card.module.css';
import DataTable from '../common/DataTable.jsx';
import { normKey } from '../../lib/csv.js';
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
  const allFilteredRows = useMemo(() => {
    // 1. Group by docente, ponderando nota/cumplimiento por n (n° de
    // encuestas de cada grupo docente+curso+ciclo+sección; `groups` ya viene
    // agregado desde el backend, ver lib/directorGroups.js).
    const map = new Map();
    groups.forEach(g => {
      if (!map.has(g.docente)) {
        map.set(g.docente, {
          docente: g.docente,
          programa: new Set(),
          curso: new Set(),
          notaSum: 0,
          cumplSum: 0,
          nSum: 0,
          nValidasSum: 0,
        });
      }
      const d = map.get(g.docente);
      if (g.programa) d.programa.add(g.programa);
      if (g.curso) d.curso.add(g.curso);
      d.notaSum += g.nota * g.n;
      d.cumplSum += g.cumplimiento * g.n;
      d.nSum += g.n;
      d.nValidasSum += g.nValidas || 0;
    });

    const docenteGroups = Array.from(map.values()).map(d => ({
      docente: d.docente,
      programa: Array.from(d.programa).join(', '),
      curso: Array.from(d.curso), // Keep as array for rendering
      nota: d.nSum ? d.notaSum / d.nSum : 0,
      cumplimiento: d.nSum ? Math.round(d.cumplSum / d.nSum) : 0,
      n: d.nValidasSum,
    }));

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

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [groups, search, sort]);

  const totalPages = Math.ceil(allFilteredRows.length / itemsPerPage);
  const paginatedRows = allFilteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderRow = (g) => (
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
  );

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
      
      {/* Tabla visible en pantalla (paginada) */}
      <div className="no-print">
        <DataTable
          columns={COLUMNS}
          rows={paginatedRows}
          sort={sort}
          onSort={onSort}
          emptyMessage="No se encontraron resultados para los filtros seleccionados."
          renderRow={renderRow}
        />
      </div>

      {/* Tabla invisible (fantasma) para impresión (completa) */}
      <div className="only-print" aria-hidden="true">
        <DataTable
          columns={COLUMNS}
          rows={allFilteredRows}
          sort={sort}
          onSort={onSort}
          emptyMessage="No se encontraron resultados para los filtros seleccionados."
          renderRow={renderRow}
        />
      </div>
      {totalPages > 1 && (
        <div className={`no-print ${styles.paginationContainer}`}>
          <span className={styles.pageInfo}>
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, allFilteredRows.length)} de {allFilteredRows.length} docentes
          </span>
          <div className={styles.pageControls}>
            <button 
              className={styles.pageButton} 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span className={styles.pageIndicator}>Página {currentPage} de {totalPages}</span>
            <button 
              className={styles.pageButton} 
              disabled={currentPage === totalPages} 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
