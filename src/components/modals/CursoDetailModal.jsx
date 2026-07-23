import Modal from '../common/Modal.jsx';
import { useData } from '../../context/DataContext.jsx';
import { computeDirectiveCounts } from '../../lib/stats.js';
import { normKey } from '../../lib/csv.js';
import styles from './CursoDetailModal.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderCursoDetailModal
   (líneas 2233-2305) + helpers notaBadgeClass/answerPillHtml/shortDirectiveLabel
   (líneas 2212-2231) + markup del modal (líneas 818-830, modal-box-wide -> prop `wide`).

   `group` es el payload que envían DetailTable (Vista Director) y CoursesTable
   (Vista Docente) vía onOpenCurso(g): un grupo de lib/groups.js#buildGroups, con
   `.rows` = encuestas individuales de ese docente/curso/sección. */

function notaBadgeClass(nota) {
  if (nota >= 16) return 'green';
  if (nota >= 11) return 'yellow';
  return 'red';
}

function shortDirectiveLabel(label) {
  const k = normKey(label);
  if (k.includes('puntualidad')) return 'Puntualidad';
  if (k.includes('silabus') || k.includes('silabo')) return 'Sílabus';
  if (k.includes('material')) return 'Material del curso';
  return label.length > 20 ? `${label.slice(0, 18)}…` : label;
}

function AnswerPill({ value }) {
  if (value === 'Sí') return <span className={`${styles.answerPill} ${styles.si}`}>Sí</span>;
  if (value === 'No') return <span className={`${styles.answerPill} ${styles.no}`}>No</span>;
  if (value === 'A veces') return <span className={`${styles.answerPill} ${styles.aveces}`}>A veces</span>;
  return <span className={`${styles.answerPill} ${styles.na}`}>&ndash;</span>;
}

export default function CursoDetailModal({ open, onClose, group, viewMode = 'docente' }) {
  const { criteriaLabels, shortCriteriaLabels, directiveLabels } = useData();
  const hasRows = group && group.rows && group.rows.length > 0;
  
  let title = 'Encuestas';
  let subtitle = '';
  if (group) {
    if (viewMode === 'curso') {
      title = `Encuestas al docente: ${group.docente}`;
      subtitle = 'Cada fila corresponde a una encuesta individual realizada a este docente en este curso/sección.';
    } else {
      title = `Encuestas del curso: ${group.curso}`;
      subtitle = 'Cada fila corresponde a una encuesta individual realizada en este curso/sección.';
    }
  }

  let pctClass;
  let notaClass;
  let pctSi = 0;
  if (hasRows) {
    ({ pctSi } = computeDirectiveCounts(group.rows));
    pctClass = pctSi >= 70 ? 'green' : (pctSi >= 40 ? 'yellow' : 'red');
    notaClass = notaBadgeClass(group.nota);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={title}
      subtitle={subtitle}
    >
      {!hasRows ? (
        <div className={styles.modalEmpty}>No hay encuestas.</div>
      ) : (
        <>
          <p className={styles.cdmContext}>
            {viewMode === 'curso' ? (
              <><b>{group.curso}</b> &middot; {group.programa} &middot; Ciclo {group.ciclo} &middot; Sección {group.seccion} &middot; Aula {group.aula}</>
            ) : (
              <><b>{group.docente}</b> &middot; {group.programa} &middot; Ciclo {group.ciclo} &middot; Sección {group.seccion} &middot; Aula {group.aula}</>
            )}
          </p>
          <div className={styles.cursoDetailStats}>
            <div className={styles.cdmStat}>
              <div className={styles.cdmStatValue}>{group.rows.length}</div>
              <div className={styles.cdmStatLabel}>Encuestas realizadas</div>
            </div>
            <div className={styles.cdmStat}>
              <div className={`${styles.cdmStatValue} ${styles[notaClass]}`}>{group.nota.toFixed(1)}</div>
              <div className={styles.cdmStatLabel}>Nota Dim I promedio</div>
            </div>
            <div className={styles.cdmStat}>
              <div className={`${styles.cdmStatValue} ${styles[pctClass]}`}>{Math.round(pctSi)}%</div>
              <div className={styles.cdmStatLabel}>Cumplimiento de directivas</div>
            </div>
          </div>

          <div className={styles.tableResponsive}>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>#</th>
                  {shortCriteriaLabels.map((label, i) => (
                    <th key={`crit-${i}`} title={criteriaLabels[i]}>{label}</th>
                  ))}
                  <th>Nota Dim I</th>
                  {directiveLabels.map((label, i) => (
                    <th key={`dir-${i}`} title={label}>{shortDirectiveLabel(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((r, i) => (
                  <tr key={r.codigo || i}>
                    <td>{r.codigo || '–'}</td>
                    <td style={{ fontWeight: 700 }}>{`E${i + 1}`}</td>
                    {r.scores.map((s, si) => (
                      <td key={si} style={{ textAlign: 'center' }}>{s !== null ? s : '–'}</td>
                    ))}
                    <td style={{ textAlign: 'center' }}>
                      <span className={`${styles.notaBadge} ${styles[notaBadgeClass(r.notaFinal)]}`}>
                        {r.notaFinal.toFixed(1)}
                      </span>
                    </td>
                    {directiveLabels.map((label, di) => {
                      const d = r.directivas.find((dd) => dd.label === label);
                      return (
                        <td key={di} style={{ textAlign: 'center' }}>
                          <AnswerPill value={d ? d.value : null} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
