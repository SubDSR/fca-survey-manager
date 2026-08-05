import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from '../tabs/DocentesTab.module.css';

// UI de paginación compartida por los tabs de catálogo -- ver usePagination.js.
export default function Pagination({ page, totalPages, setPage, totalItems, pageSize, itemLabel }) {
  if (totalItems === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className={styles.pagination}>
      <span className={styles.paginationLabel}>
        Mostrando {from} a {to} de {totalItems} {itemLabel}
      </span>
      <div className={styles.paginationControls}>
        <button
          type="button"
          className={styles.pageBtn}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          <ChevronLeft size={14} /> Anterior
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={`${styles.pageBtn} ${styles.pageNumBtn} ${n === page ? styles.pageNumBtnActive : ''}`}
            onClick={() => setPage(n)}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className={styles.pageBtn}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          Siguiente <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
