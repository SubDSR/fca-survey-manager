import FilterSelect from '../common/FilterSelect.jsx';
import filterStyles from '../common/FilterSelect.module.css';
import styles from './DocenteView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html (markup líneas 685-709). */

export default function Selectors({ sel, options, onChange }) {
  return (
    <div className={`no-print ${styles.filtersBar} ${styles.docenteSelectBar}`}>
      <FilterSelect
        label="Programa"
        value={sel.programa}
        options={[{ value: '', label: 'Todos los programas' }, ...options.programa.map((v) => ({ value: v, label: v }))]}
        onChange={(value) => onChange('programa', value)}
      />
      <FilterSelect
        label="Categoría"
        value={sel.categoria}
        options={[{ value: '', label: 'Todas las categorías' }, ...options.categoria.map((v) => ({ value: v, label: v }))]}
        onChange={(value) => onChange('categoria', value)}
      />
      <FilterSelect
        label="Docente"
        value={sel.selected}
        options={[{ value: '', label: 'Seleccione un docente' }, ...options.docente.map((v) => ({ value: v, label: v }))]}
        onChange={(value) => onChange('selected', value)}
      />
      <FilterSelect
        label="Curso"
        value={sel.curso}
        options={[{ value: '', label: 'Todos los cursos' }, ...options.curso]}
        onChange={(value) => onChange('curso', value)}
      />
      <div className={`${filterStyles.filterGroup} ${styles.filterGroupChecks}`}>
        <label>Estado</label>
        <div className={styles.estadoChecks}>
          <label className={styles.estadoCheckLabel}>
            <input
              type="checkbox"
              checked={sel.estado.aprobado}
              onChange={(e) => onChange('estadoAprobado', e.target.checked)}
            /> Aprobados
          </label>
          <label className={styles.estadoCheckLabel}>
            <input
              type="checkbox"
              checked={sel.estado.desaprobado}
              onChange={(e) => onChange('estadoDesaprobado', e.target.checked)}
            /> Desaprobados
          </label>
        </div>
      </div>
    </div>
  );
}
