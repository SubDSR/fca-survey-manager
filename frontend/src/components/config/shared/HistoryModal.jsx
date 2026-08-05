import { useEffect, useState } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import Modal from '../../common/Modal.jsx';
import { api } from '../../../services/api.js';
import styles from '../tabs/DocentesTab.module.css';

const ACCION_LABEL = {
  INSERT: 'Registro creado',
  UPDATE: 'Datos editados',
  SUSPEND: 'Suspendido',
  REACTIVATE: 'Reactivado',
};

const CAMPOS_IGNORADOS = new Set(['id', 'created_at', 'updated_at', 'clave_busqueda']);

// Diff simple entre datos_anteriores/datos_nuevos de una fila de audit_log --
// no hace falta un visor genérico, solo listar qué campos cambiaron.
function describirCambios(entry) {
  if (entry.accion === 'INSERT' || !entry.datos_anteriores) return [];
  const antes = entry.datos_anteriores || {};
  const despues = entry.datos_nuevos || {};
  const campos = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  const cambios = [];
  campos.forEach((campo) => {
    if (CAMPOS_IGNORADOS.has(campo)) return;
    const valorAntes = antes[campo];
    const valorDespues = despues[campo];
    if (JSON.stringify(valorAntes) !== JSON.stringify(valorDespues)) {
      cambios.push({ campo, antes: valorAntes, despues: valorDespues });
    }
  });
  return cambios;
}

function formatFechaHora(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Modal de "Ver historial de cambios" (menú ⋮ de EntityCard) -- compartido
// por Docentes/Programas/Cursos, todas cubiertas por los triggers de
// audit_log (migración 2026-08-04-audit-log.sql). `tabla` es el valor de
// audit_log.tabla ('docente' | 'programa' | 'asignatura'), `target` es la
// fila seleccionada (o null si el modal está cerrado) y debe traer `id` +
// el campo que se use como `subtitle`.
export default function HistoryModal({ tabla, target, subtitle, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!target) return;
    setEntries([]);
    setError('');
    setLoading(true);
    api.auditLog.listar(tabla, target.id)
      .then(setEntries)
      .catch((err) => setError(err.message || 'No se pudo cargar el historial de cambios.'))
      .finally(() => setLoading(false));
  }, [tabla, target]);

  return (
    <Modal open={!!target} onClose={onClose} title="Historial de cambios" subtitle={subtitle}>
      {loading && (
        <div className={styles.emptyState}><Loader2 size={18} className={styles.spin} /> Cargando historial…</div>
      )}
      {!loading && error && <div className={styles.emptyState}>{error}</div>}
      {!loading && !error && entries.length === 0 && (
        <div className={styles.emptyState}>Sin cambios registrados todavía.</div>
      )}
      {!loading && !error && entries.length > 0 && (
        <ul className={styles.historyList}>
          {entries.map((entry) => {
            const cambios = describirCambios(entry);
            return (
              <li key={entry.id} className={styles.historyEntry}>
                <div className={styles.historyEntryHeader}>
                  <Clock size={13} />
                  <span className={styles.historyEntryAccion}>{ACCION_LABEL[entry.accion] || entry.accion}</span>
                  <span className={styles.historyEntryFecha}>{formatFechaHora(entry.created_at)}</span>
                </div>
                {cambios.length > 0 && (
                  <ul className={styles.historyDiffList}>
                    {cambios.map((c) => (
                      <li key={c.campo}><b>{c.campo}</b>: {String(c.antes ?? '—')} → {String(c.despues ?? '—')}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
