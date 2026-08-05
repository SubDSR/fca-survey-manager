import { useEffect, useState } from 'react';

// Paginación client-side genérica para los tabs de catálogo -- la lista
// completa ya se trae del backend (volumen chico, decenas a un par de
// cientos de filas), así que no hace falta paginar en el servidor.
// `resetKeys` reinicia a la página 1 cuando cambian filtros/búsqueda.
export function usePagination(items, pageSize, resetKeys = []) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = items.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, resetKeys);

  return { page: pageSafe, setPage, totalPages, pageItems };
}
