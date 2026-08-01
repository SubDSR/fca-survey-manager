import styles from './DataTable.module.css';

export default function DataTable({ columns, rows, sort, onSort, renderRow, emptyMessage = 'Sin datos' }) {
  return (
    <div className={`table-responsive ${styles.tableResponsive}`}>
      <table>
        <thead>
          <tr>
            {columns.map((column) => {
              const isSorted = sort && sort.key === column.key;
              return (
                <th
                  key={column.key}
                  data-key={column.key}
                  onClick={() => onSort && onSort(column.key)}
                >
                  {column.label}
                  {isSorted && (
                    <span className={styles.arrow}>{sort.dir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className={styles.emptyRow}>
              <td colSpan={columns.length}>{emptyMessage}</td>
            </tr>
          ) : (
            rows.map(renderRow)
          )}
        </tbody>
      </table>
    </div>
  );
}
