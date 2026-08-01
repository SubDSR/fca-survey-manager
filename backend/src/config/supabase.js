import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env'
  );
}

// service_role: bypasea RLS, solo para uso en el backend — nunca exponer al frontend.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PAGE_SIZE = 1000;

// PostgREST limita cada respuesta a 1000 filas por defecto: sin paginar, tablas
// o vistas más grandes (p. ej. v_encuesta_directivas, con una fila por encuesta
// por pregunta) se devuelven truncadas sin ningún error visible. Pagina con
// .range() hasta que una página vuelva incompleta.
// `filters` (opcional): objeto columna->valor aplicado con .eq() antes de paginar.
export async function fetchAllRows(table, filters = {}) {
  const rows = [];
  let from = 0;
  for (;;) {
    let query = supabase.from(table).select('*');
    for (const [column, value] of Object.entries(filters)) {
      query = query.eq(column, value);
    }
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}
