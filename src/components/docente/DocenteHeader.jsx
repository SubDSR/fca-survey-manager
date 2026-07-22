import Card from '../common/Card.jsx';
import { categoriaSlug } from '../../data/constants.js';
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

export default function DocenteHeader({ selected, cursoRows, programaRows, onMoreInfo }) {
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
  // Con "Todos los cursos" el perfil abarca varios cursos/programas; se muestra
  // una etiqueta agregada en lugar del primero.
  const cursosDistintos = uniqueSorted(cursoRows, 'curso');
  const programasDistintos = uniqueSorted(cursoRows, 'programa');
  const cursoMetaLabel = cursosDistintos.length === 1 ? cursosDistintos[0] : `Todos los cursos (${cursosDistintos.length})`;
  const programaMetaLabel = programasDistintos.join(', ');
  // categoría y facultad vienen enriquecidas en la fila desde el roster (docentes.csv).
  const categoria = first.categoria || 'Sin categoría';
  // Se muestra la procedencia para todos los docentes (por consistencia): los
  // "Nombrado - OF" traen su facultad de origen y el resto, Ciencias Administrativas.
  const facultadOrigen = first.facultad;

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

  // Apellido para la barra comparativa (p. ej. "Olivares Taipe, Paulo César" -> "OLIVARES").
  const apellidoLabel = (String(first.docente).split(',')[0].trim().split(/\s+/)[0] || first.docente).toUpperCase();
  // Anchos de barra en escala 0–20 (mínimo visible del 2%).
  const pctPrograma = Math.max(2, Math.min(100, (notaPrograma / 20) * 100));
  const pctDocente = Math.max(2, Math.min(100, (notaDocente / 20) * 100));

  return (
    <>
      <Card className={`docente-header ${styles.docenteHeader}`}>
        {/* Sección 1 · Identidad del docente */}
        <div className={styles.profileIdentity}>
          <div className={styles.docenteAvatar}>{getInitials(first.docente)}</div>
          <div className={styles.docenteIdInfo}>
            <h2 className={styles.profileName}>{first.docente}</h2>
            <ul className={styles.profileMeta}>
              <li>
                <span className={styles.profileMetaLabel}>Estado:</span>
                <span className={`${styles.docenteCategoryPill} ${styles[categoriaSlug(categoria)] || ''}`}>{categoria}</span>
              </li>
              {/* Procedencia (facultad) del docente, se muestra siempre que exista. */}
              {facultadOrigen && (
                <li>
                  <span className={styles.profileMetaLabel}>Procedencia:</span>
                  <b className={styles.profileMetaValue}>{facultadOrigen}</b>
                </li>
              )}
            </ul>
            {/* Placeholder: abrirá un modal con el perfil detallado del docente (por implementar). */}
            <button
              type="button"
              className={`no-print ${styles.btnProfile}`}
              onClick={() => onMoreInfo?.(first)}
            >
              Ver Perfil Detallado
            </button>
          </div>
        </div>

        {/* Sección 2 · Nota individual */}
        <div className={styles.profileScore}>
          <div className={styles.scoreOval}>{notaDocente.toFixed(1)}</div>
          <div className={styles.scoreLabel}>Nota individual obtenida</div>
          <span className={`${styles.estadoChip} ${aprobado ? styles.aprobado : styles.desaprobado}`}>
            {aprobado ? 'Aprobado ✓' : 'Desaprobado'}
          </span>
        </div>

        {/* Sección 3 · Comparativa con el promedio del programa */}
        <div className={styles.profileCompare}>
          <div className={`${styles.scoreOval} ${styles.scoreOvalSoft}`}>{notaPrograma.toFixed(1)}</div>
          <div className={styles.scoreLabel}>Promedio del programa</div>
          <div className={styles.compareBars}>
            <div className={styles.compareRow}>
              <span className={styles.compareBarLabel}>Prog.</span>
              <div className={styles.compareTrack}>
                <div className={styles.compareFillProg} style={{ width: `${pctPrograma}%` }} />
              </div>
            </div>
            <div className={styles.compareRow}>
              <span className={styles.compareBarLabel}>{apellidoLabel}</span>
              <div className={styles.compareTrack}>
                <div className={styles.compareFillDoc} style={{ width: `${pctDocente}%` }} />
              </div>
            </div>
            <div className={styles.compareDelta}>
              <span className={styles.compareDeltaLabel}>Desviación</span>
              <span className={`${styles.deltaChip} ${deltaClass}`}>{deltaSign}{delta.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Perfil de curso integrado (debajo del card): programa, curso, ciclo/sección
          y la métrica de total de encuestas. Sin aula (a pedido). */}
      <div className={styles.docenteMetaBar}>
        <div className={styles.metaProfile}>
          <span className={styles.metaProgramaLabel}>Programa académico: <b>{programaMetaLabel}</b></span>
          <div className={styles.metaCursoRow}>
            <span className={styles.metaSmallLabel}>Curso:</span>
            <span className={styles.metaCursoName}>{cursoMetaLabel}</span>
          </div>
          <div className={styles.metaCicloSeccion}>
            <span>Ciclo(s): <b>{ciclos.join(', ')}</b></span>
            <span className={styles.metaDot}>·</span>
            <span>Sección(es): <b>{secciones.join(', ')}</b></span>
          </div>
        </div>
        <div className={styles.metaMetric}>
          <div className={styles.metaMetricValue}>{cursoRows.length}</div>
          <div className={styles.metaMetricLabel}>Total de encuestas</div>
        </div>
      </div>
    </>
  );
}
