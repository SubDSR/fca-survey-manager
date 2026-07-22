import Card from '../common/Card.jsx';
import { getDocenteCategoria, categoriaSlug } from '../../data/docenteCategoria.js';
import { getDocenteFacultad } from '../../data/docenteFacultad.js';
import { uniqueSorted } from '../../lib/groups.js';
import styles from './DocenteView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderDocenteHeader
   (líneas 1900-1975) + getInitials (líneas 1891-1898). */

function getInitials(name) {
  const parts = String(name || '').split(',').map((s) => s.trim()).filter(Boolean);
  const apellido = parts[0] || '';
  const nombre = parts[1] || '';
  const a = apellido.charAt(0) || '';
  const n = nombre.charAt(0) || '';
  return (a + n).toUpperCase() || '--';
}

export default function DocenteHeader({ selected, cursoRows, programaRows }) {
  if (!selected) {
    return (
      <Card className={`docente-header ${styles.docenteHeader}`}>
        <div className={styles.docenteHeaderPlaceholder}>
          <div className={`${styles.docenteAvatar} ${styles.placeholder}`}>?</div>
          <div>
            <h2 className={styles.placeholderText}>Seleccione un docente</h2>
            <p className={styles.placeholderSub}>
              Use los filtros de arriba (Programa, Categoría, Docente, Curso) para ver su información.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (cursoRows.length === 0) {
    return (
      <Card className={`docente-header ${styles.docenteHeader}`}>
        <div className={styles.emptyState}>No hay encuestas para el filtro seleccionado.</div>
      </Card>
    );
  }

  const first = cursoRows[0];
  const ciclos = uniqueSorted(cursoRows, 'ciclo');
  const secciones = uniqueSorted(cursoRows, 'seccion');
  const aulas = uniqueSorted(cursoRows, 'aula');
  const categoria = getDocenteCategoria(first.docente);
  const facultadOrigen = categoria === 'Nombrado - OF' ? getDocenteFacultad(first.docente) : null;

  const notaDocente = cursoRows.reduce((a, r) => a + r.notaFinal, 0) / cursoRows.length;
  const notaPrograma = programaRows.length
    ? programaRows.reduce((a, r) => a + r.notaFinal, 0) / programaRows.length
    : 0;

  const delta = notaDocente - notaPrograma;
  let deltaClass = styles.neu;
  let deltaSign = '';
  if (delta > 0.3) { deltaClass = styles.pos; deltaSign = '+'; }
  else if (delta < -0.3) { deltaClass = styles.neg; deltaSign = ''; }

  const aprobado = notaDocente >= 14;

  return (
    <Card className={`docente-header ${styles.docenteHeader}`}>
      <div className={styles.docenteId}>
        <div className={styles.docenteIdTop}>
          <div className={styles.docenteAvatar}>{getInitials(first.docente)}</div>
          <div>
            <h2>{first.docente}</h2>
            <span className={`${styles.docenteCategoryPill} ${styles[categoriaSlug(categoria)] || ''}`}>{categoria}</span>
            {facultadOrigen && (
              <span className={styles.docenteFacultadTag}>Procedente de: <b>{facultadOrigen}</b></span>
            )}
          </div>
        </div>
        <div className={styles.docenteMetaPills}>
          <span className={styles.metaPill}>{first.programa}</span>
          <span className={`${styles.metaPill} ${styles.cursoPill}`}>{first.curso}</span>
          <span className={styles.metaPill}>Ciclo(s): <b>&nbsp;{ciclos.join(', ')}</b></span>
          <span className={styles.metaPill}>Sección(es): <b>&nbsp;{secciones.join(', ')}</b></span>
          <span className={styles.metaPill}>Aula(s): <b>&nbsp;{aulas.join(', ')}</b></span>
          <span className={`${styles.metaPill} ${styles.accent}`}>{cursoRows.length} encuesta(s)</span>
        </div>
      </div>
      <div className={styles.docenteScore}>
        <div className={styles.scoreBox}>
          <div className={styles.scoreValue}>{notaDocente.toFixed(1)}</div>
          <div className={styles.scoreLabel}>Nota obtenida</div>
        </div>
        <div className={styles.scoreBox}>
          <div className={styles.scoreValue} style={{ color: 'var(--text-soft)' }}>{notaPrograma.toFixed(1)}</div>
          <div className={styles.scoreLabel}>Promedio del programa</div>
        </div>
        <div className={styles.scoreStatusWrap}>
          <span className={`${styles.deltaChip} ${deltaClass}`}>{deltaSign}{delta.toFixed(1)} vs. programa</span>
          <span className={`${styles.estadoChip} ${aprobado ? styles.aprobado : styles.desaprobado}`}>
            {aprobado ? 'Aprobado' : 'Desaprobado'}
          </span>
        </div>
      </div>
    </Card>
  );
}
