import { GraduationCap, Users, Calendar, Layers, ClipboardList } from 'lucide-react';
import Card from '../common/Card.jsx';
import ContextStrip from '../docente/ContextStrip.jsx';
import { uniqueSorted } from '../../lib/groups.js';
import styles from '../docente/DocenteView.module.css';

function getInitials(name) {
  const parts = String(name || '').split(' ').filter(Boolean);
  const a = parts[0]?.charAt(0) || '';
  const n = parts[1]?.charAt(0) || '';
  return (a + n).toUpperCase() || '--';
}

export default function CursoHeader({ selectedCurso, filteredRows, programaRows }) {
  if (!selectedCurso || filteredRows.length === 0) {
    return (
      <Card className={`docente-header ${styles.docenteHeader}`}>
        <div className={styles.docenteHeaderPlaceholder}>
          <div className={`${styles.docenteAvatar} ${styles.placeholder}`}>?</div>
          <div>
            <h2 className={styles.placeholderText}>Seleccione un curso</h2>
            <p className={styles.placeholderSub}>
              Use los filtros de arriba (Programa, Curso) para evaluar su desempeño global.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const ciclos = uniqueSorted(filteredRows, 'ciclo');
  const secciones = uniqueSorted(filteredRows, 'seccion');
  const docentesDistintos = uniqueSorted(filteredRows, 'docente');
  const programasDistintos = uniqueSorted(filteredRows, 'programa');
  
  const programaMetaLabel = programasDistintos.join(', ');

  const notaCurso = filteredRows.reduce((a, r) => a + r.notaFinal, 0) / filteredRows.length;
  const notaPrograma = programaRows.length
    ? programaRows.reduce((a, r) => a + r.notaFinal, 0) / programaRows.length
    : 0;

  const delta = notaCurso - notaPrograma;
  let deltaClass = styles.neu;
  let deltaSign = '';
  if (delta > 0.3) { deltaClass = styles.pos; deltaSign = '+'; }
  else if (delta < -0.3) { deltaClass = styles.neg; deltaSign = ''; }

  const aprobado = notaCurso >= 14;

  const shortName = (selectedCurso.split(' ')[0] || selectedCurso).toUpperCase();
  const pctPrograma = Math.max(2, Math.min(100, (notaPrograma / 20) * 100));
  const pctCurso = Math.max(2, Math.min(100, (notaCurso / 20) * 100));

  return (
    <>
      <Card className={`docente-header ${styles.docenteHeader}`}>
        {/* Sección 1 · Identidad del Curso */}
        <div className={styles.profileIdentity}>
          <div className={styles.docenteAvatar}>{getInitials(selectedCurso)}</div>
          <div className={styles.docenteIdInfo}>
            <h2 className={styles.profileName}>{selectedCurso}</h2>
            <ul className={styles.profileMeta}>
              <li>
                <span className={styles.profileMetaLabel}>Programa(s):</span>
                <span className={styles.profileMetaValue}>{programaMetaLabel}</span>
              </li>
              <li>
                <span className={styles.profileMetaLabel}>Docentes distintos que lo dictaron:</span>
                <b className={styles.profileMetaValue}>{docentesDistintos.length}</b>
              </li>
            </ul>
          </div>
        </div>

        {/* Sección 2 · Nota individual */}
        <div className={styles.profileScore}>
          <div className={styles.scoreOval}>{notaCurso.toFixed(1)}</div>
          <div className={styles.scoreLabel}>Nota obtenida por el curso</div>
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
              <span className={styles.compareBarLabel}>{shortName.slice(0, 8)}</span>
              <div className={styles.compareTrack}>
                <div className={styles.compareFillDoc} style={{ width: `${pctCurso}%` }} />
              </div>
            </div>
            <div className={styles.compareDelta}>
              <span className={styles.compareDeltaLabel}>Desviación</span>
              <span className={`${styles.deltaChip} ${deltaClass}`}>{deltaSign}{delta.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </Card>

      <ContextStrip
        items={[
          { icon: GraduationCap, label: 'PROGRAMA', value: programaMetaLabel },
          { icon: Users, label: 'DOCENTES', value: String(docentesDistintos.length) },
          { icon: Calendar, label: 'CICLO', value: ciclos.join(', ') },
          { icon: Layers, label: 'SECCIONES', value: secciones.join(', ') },
          { icon: ClipboardList, label: 'ENCUESTAS', value: String(filteredRows.length) },
        ]}
      />
    </>
  );
}
