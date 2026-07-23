import FilterSelect from '../common/FilterSelect.jsx';
import SearchableSelect from '../common/SearchableSelect.jsx';
import filterStyles from '../common/FilterSelect.module.css';
import styles from './DirectorView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html (markup líneas 605-627). */

const FIELDS = [
  { key: 'categoria', label: 'Categoría', placeholder: 'Todas las categorías' },
  { key: 'programa', label: 'Programa', placeholder: 'Todos los programas' },
  { key: 'ciclo', label: 'Ciclo', placeholder: 'Todos los ciclos' },
  { key: 'seccion', label: 'Sección', placeholder: 'Todas las secciones' },
  { key: 'docente', label: 'Docente', placeholder: 'Todos los docentes' }
];

export default function Filters({ filters, options, onChange, onReset }) {
  return (
    <div className={`no-print ${styles.filtersBar}`}>
      {FIELDS.map(({ key, label, placeholder }) => {
        const isSearchable = key === 'docente' || key === 'programa' || key === 'categoria';
        const SelectComponent = isSearchable ? SearchableSelect : FilterSelect;
        return (
          <SelectComponent
            key={key}
            label={label}
            value={filters[key]}
            options={[{ value: '', label: placeholder }, ...options[key].map((v) => ({ value: v, label: v }))]}
            onChange={(value) => onChange(key, value)}
            {...(isSearchable ? { placeholder: `Buscar ${label.toLowerCase()}...` } : {})}
          />
        );
      })}
      
      <div className={`${filterStyles.filterGroup} ${styles.filterGroupChecks}`}>
        <label>Estado</label>
        <div className={styles.estadoChecks}>
          <label className={`${styles.estadoCheckLabel} ${styles.aprobado} ${filters.estado === 'aprobado' ? styles.active : ''}`}>
            <input
              type="checkbox"
              checked={filters.estado === 'aprobado'}
              onChange={() => onChange('estado', 'aprobado')}
            /> 
            <span>Aprobados</span>
          </label>
          <label className={`${styles.estadoCheckLabel} ${styles.desaprobado} ${filters.estado === 'desaprobado' ? styles.active : ''}`}>
            <input
              type="checkbox"
              checked={filters.estado === 'desaprobado'}
              onChange={() => onChange('estado', 'desaprobado')}
            /> 
            <span>Desaprobados</span>
          </label>
        </div>
      </div>

      <button type="button" className={filterStyles.btnReset} onClick={onReset}>Limpiar filtros</button>
    </div>
  );
}
