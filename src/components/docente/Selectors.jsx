import FilterSelect from '../common/FilterSelect.jsx';
import SearchableSelect from '../common/SearchableSelect.jsx';
import filterStyles from '../common/FilterSelect.module.css';
import styles from './DocenteView.module.css';

/* Portado desde reference/dashboard_evaluacion_docente.html (markup líneas 685-709). */

export default function Selectors({ sel, options, onChange }) {
  return (
    <div className={`no-print ${styles.filtersBar} ${styles.docenteSelectBar}`}>
      <SearchableSelect
        label="Programa"
        value={sel.programa}
        options={[{ value: '', label: 'Todos los programas' }, ...options.programa.map((v) => ({ value: v, label: v }))]}
        onChange={(value) => onChange('programa', value)}
        placeholder="Buscar programa..."
      />
      <SearchableSelect
        label="Categoría"
        value={sel.categoria}
        options={[{ value: '', label: 'Todas las categorías' }, ...options.categoria.map((v) => ({ value: v, label: v }))]}
        onChange={(value) => onChange('categoria', value)}
        placeholder="Buscar categoría..."
      />
      <SearchableSelect
        label="Docente"
        value={sel.selected}
        options={[{ value: '', label: 'Seleccionar docente' }, ...options.docente.map((v) => ({ value: v, label: v }))]}
        onChange={(value) => onChange('selected', value)}
        placeholder="Buscar docente..."
      />
      <SearchableSelect
        label="Curso"
        value={sel.curso}
        options={[{ value: '', label: 'Todos los cursos' }, ...options.curso]}
        onChange={(value) => onChange('curso', value)}
        placeholder="Buscar curso..."
      />
    </div>
  );
}
