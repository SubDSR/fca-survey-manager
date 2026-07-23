import FilterSelect from '../common/FilterSelect.jsx';
import SearchableSelect from '../common/SearchableSelect.jsx';
import filterStyles from '../common/FilterSelect.module.css';
import styles from './DirectorView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html (markup líneas 605-627). */

const FIELDS = [
  { key: 'programa', label: 'Programa', placeholder: 'Todos los programas' },
  { key: 'ciclo', label: 'Ciclo', placeholder: 'Todos los ciclos' },
  { key: 'seccion', label: 'Sección', placeholder: 'Todas las secciones' },
  { key: 'aula', label: 'Aula', placeholder: 'Todas las aulas' },
  { key: 'docente', label: 'Docente', placeholder: 'Todos los docentes' }
];

export default function Filters({ filters, options, onChange, onReset }) {
  return (
    <div className={`no-print ${styles.filtersBar}`}>
      {FIELDS.map(({ key, label, placeholder }) => {
        const SelectComponent = (key === 'docente' || key === 'programa') ? SearchableSelect : FilterSelect;
        return (
          <SelectComponent
            key={key}
            label={label}
            value={filters[key]}
            options={[{ value: '', label: placeholder }, ...options[key].map((v) => ({ value: v, label: v }))]}
            onChange={(value) => onChange(key, value)}
            {...((key === 'docente' || key === 'programa') ? { placeholder: `Buscar ${label.toLowerCase()}...` } : {})}
          />
        );
      })}
      <button type="button" className={filterStyles.btnReset} onClick={onReset}>Limpiar filtros</button>
    </div>
  );
}
