import { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import Card from '../common/Card.jsx';
import { api } from '../../services/api.js';
import styles from './DirectorView.module.css';

const VISIBLE_LIMIT = 8;
const NIVEL_ORDEN = { CRITICO: 0, ADVERTENCIA: 1 };

/* Panel de docentes en seguimiento a nivel DOCENTE (no grupo docente/curso):
   consume GET /api/encuestas/seguimiento (v_seguimiento), ya filtrada en el
   backend a la campaña ABIERTA y a los umbrales de politica_evaluacion --
   deliberadamente distinto de AlertBanner/SeguimientoModal (que trabajan a
   nivel grupo docente+curso+ciclo+sección, con umbrales fijos en JS). No
   comparten datos ni lógica a propósito: son dos vistas distintas de
   "seguimiento" ya existentes antes de esta tarea. */
export default function SeguimientoDocentesCard({ onIrAGestion }) {
  const [docentes, setDocentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    api.encuestas.seguimiento()
      .then((data) => {
        const ordenados = [...(data || [])].sort((a, b) => {
          const nivelDiff = (NIVEL_ORDEN[a.nivel_alerta] ?? 2) - (NIVEL_ORDEN[b.nivel_alerta] ?? 2);
          if (nivelDiff !== 0) return nivelDiff;
          return Number(a.nota_promedio) - Number(b.nota_promedio);
        });
        setDocentes(ordenados);
      })
      .catch((err) => setError(err.message || 'No se pudo cargar el seguimiento de docentes.'))
      .finally(() => setLoading(false));
  }, []);

  const visibles = showAll ? docentes : docentes.slice(0, VISIBLE_LIMIT);
  const hayMas = docentes.length > VISIBLE_LIMIT;

  return (
    <Card
      title="Docentes en seguimiento"
      note={'Campaña abierta actual · nota promedio o % de respuestas "No" por debajo del umbral esperado.'}
      className={styles.seguimientoCard}
    >
      {loading && (
        <div className={styles.seguimientoLoading}><Loader2 size={16} className={styles.spin} /> Cargando…</div>
      )}
      {!loading && error && <div className={styles.seguimientoLoading}>{error}</div>}
      {!loading && !error && docentes.length === 0 && (
        <div className={styles.seguimientoEmpty}>
          <CheckCircle2 size={22} className={styles.seguimientoEmptyIcon} />
          <span>Ningún docente en seguimiento actualmente.</span>
        </div>
      )}
      {!loading && !error && docentes.length > 0 && (
        <>
          <ul className={styles.seguimientoList}>
            {visibles.map((d) => {
              const critico = d.nivel_alerta === 'CRITICO';
              const clickable = typeof onIrAGestion === 'function';
              return (
                <li
                  key={d.docente_id}
                  className={`${styles.seguimientoRow} ${clickable ? styles.seguimientoRowClickable : ''}`}
                  onClick={clickable ? () => onIrAGestion(d.docente_id) : undefined}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onIrAGestion(d.docente_id); } } : undefined}
                >
                  <span className={`${styles.seguimientoBadge} ${critico ? styles.seguimientoBadgeCritico : styles.seguimientoBadgeAdvertencia}`}>
                    {critico ? <AlertCircle size={12} /> : <AlertTriangle size={12} />}
                    {critico ? 'Crítico' : 'Advertencia'}
                  </span>
                  <span className={styles.seguimientoNombre} title={d.nombre_completo}>{d.nombre_completo}</span>
                  <span className={styles.seguimientoMetric}>
                    Nota <b>{Number(d.nota_promedio).toFixed(1)}</b>
                  </span>
                  <span className={styles.seguimientoMetric}>
                    <b>{d.pct_no != null ? Math.round(Number(d.pct_no)) : '—'}%</b> &quot;No&quot;
                  </span>
                </li>
              );
            })}
          </ul>
          {hayMas && !showAll && (
            <button type="button" className={styles.seguimientoVerTodos} onClick={() => setShowAll(true)}>
              Ver todos ({docentes.length})
            </button>
          )}
        </>
      )}
    </Card>
  );
}
