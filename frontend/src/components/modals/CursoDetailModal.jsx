import { useEffect, useMemo, useState } from 'react';
import Modal from '../common/Modal.jsx';
import { useData } from '../../context/DataContext.jsx';
import { normKey } from '../../lib/csv.js';
import { api } from '../../services/api.js';
import { buildRawResponseRows } from '../../lib/rawResponsesFromView.js';
import styles from './CursoDetailModal.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderCursoDetailModal
   (líneas 2233-2305) + helpers notaBadgeClass/answerPillHtml/shortDirectiveLabel
   (líneas 2212-2231) + markup del modal (líneas 818-830, modal-box-wide -> prop `wide`).

   `group` es el payload que envían DetailTable (Vista Director), CoursesTable
   (Vista Docente) y DocentesTable (Vista Curso): un grupo de
   lib/directorGroups.js#toSummaryGroup (docente/curso/programa/ciclo/seccion/
   aula/nota/cumplimiento/n, vía GET /api/encuestas/consolidado) con los ids
   docenteId/asignaturaId/grupoId de su sección exacta. El detalle por
   encuestado (una fila por E1..En) se pide aparte a GET /api/encuestas/respuestas
   filtrado por docenteId+asignaturaId (sin grupoId: buildRawResponseRows ya
   acota a la sección exacta vía secciones_origen) — ver lib/rawResponsesFromView.js. */

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

  const [respuestas, setRespuestas] = useState([]);
  useEffect(() => {
    if (!open || !group) { setRespuestas([]); return; }
    let cancelled = false;
    // No se filtra por grupo_id: un grupo consolidado puede juntar varias
    // secciones dispersas con su propio grupo_id (ver secciones_origen en
    // lib/rawResponsesFromView.js) -- filtrar aquí por el grupo_id "oficial"
    // dejaría fuera esas respuestas. buildRawResponseRows ya acota el
    // resultado a docente+asignatura+ciclo+sección exactos.
    api.encuestas.respuestas({
      docente_id: group.docenteId,
      asignatura_id: group.asignaturaId,
    })
      .then((data) => { if (!cancelled) setRespuestas(data); })
      .catch((err) => { console.error('No se pudo cargar /api/encuestas/respuestas:', err); if (!cancelled) setRespuestas([]); });
    return () => { cancelled = true; };
  }, [open, group]);

  const rows = useMemo(
    () => (group ? buildRawResponseRows(respuestas, [group], directiveLabels) : []),
    [respuestas, group, directiveLabels]
  );
  const hasRows = rows.length > 0;

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
  if (group) {
    pctClass = group.cumplimiento >= 70 ? 'green' : (group.cumplimiento >= 40 ? 'yellow' : 'red');
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
              <div className={styles.cdmStatValue}>{group.nValidas}</div>
              <div className={styles.cdmStatLabel}>Encuestas realizadas</div>
            </div>
            <div className={styles.cdmStat}>
              <div className={`${styles.cdmStatValue} ${styles[notaClass]}`}>{group.nota.toFixed(1)}</div>
              <div className={styles.cdmStatLabel}>Nota Dim I promedio</div>
            </div>
            <div className={styles.cdmStat}>
              <div className={`${styles.cdmStatValue} ${styles[pctClass]}`}>{group.cumplimiento}%</div>
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
                {rows.map((r, i) => {
                  const validScores = r.scores.filter((s) => s !== null && s !== undefined);
                  const notaFinal = validScores.length
                    ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 2 * 10) / 10
                    : null;
                  return (
                  <tr key={r.codigo || i}>
                    <td>{r.codigo || '–'}</td>
                    <td style={{ fontWeight: 700 }}>{`E${i + 1}`}</td>
                    {r.scores.map((s, si) => (
                      <td key={si} style={{ textAlign: 'center' }}>{s !== null ? s : '–'}</td>
                    ))}
                    <td style={{ textAlign: 'center' }}>
                      {notaFinal !== null ? (
                        <span className={`${styles.notaBadge} ${styles[notaBadgeClass(notaFinal)]}`}>
                          {notaFinal.toFixed(1)}
                        </span>
                      ) : '–'}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
