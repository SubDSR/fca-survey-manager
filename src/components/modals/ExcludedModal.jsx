import Modal from '../common/Modal.jsx';
import { useData } from '../../context/DataContext.jsx';
import styles from './ExcludedModal.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html: renderExcludedModal
   (líneas 1233-1266) + markup del modal (líneas 833-845).

   Se dispara desde el enlace "(N excluidas, ver detalle)" en Topbar (área de
   estado del archivo CSV), igual que el link generado en renderFileStatus
   (líneas 1220-1228 del reference). */

export default function ExcludedModal({ open, onClose }) {
  const { excludedRows } = useData();
  const rows = excludedRows || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registros excluidos del análisis"
      subtitle="Encuestas que no se pudieron incluir por falta de datos en los criterios evaluados."
    >
      {rows.length === 0 ? (
        <div className={styles.modalEmpty}>No hay registros excluidos.</div>
      ) : (
        <>
          <p className={styles.note}>
            Estas {rows.length} encuesta(s) no respondieron <b>ninguna</b> de las 6 preguntas de la Dimensión I
            (P1&ndash;P6), por lo que no hay ningún valor con el cual calcular una Nota Final y se excluyen del análisis.
            Las encuestas que sí respondieron al menos una pregunta <b>sí se incluyen</b>: su nota se calcula únicamente
            con las preguntas que fueron respondidas, sin contar las que quedaron en blanco.
          </p>
          <div className={styles.tableResponsive}>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Docente</th>
                  <th>Programa</th>
                  <th>Ciclo</th>
                  <th>Sección</th>
                  <th>Aula</th>
                  <th>Curso</th>
                  <th>Criterios sin responder</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.codigo || '–'}</td>
                    <td>{r.docente}</td>
                    <td>{r.programa}</td>
                    <td>{r.ciclo}</td>
                    <td>{r.seccion}</td>
                    <td>{r.aula}</td>
                    <td>{r.curso}</td>
                    <td>{r.missing.join(', ').toUpperCase()}</td>
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
