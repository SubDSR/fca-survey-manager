import SearchableSelect from '../common/SearchableSelect.jsx';
import filterStyles from '../common/FilterSelect.module.css';
import styles from '../docente/DocenteView.module.css';

export default function CursoSelectors({ sel, options, onChange, actions }) {
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
        label="Curso"
        value={sel.curso}
        options={[{ value: '', label: 'Seleccionar curso' }, ...options.curso.map((v) => ({ value: v, label: v }))]}
        onChange={(value) => onChange('curso', value)}
        placeholder="Buscar curso..."
      />
      <SearchableSelect
        label="Ciclo"
        value={sel.ciclo}
        options={[{ value: '', label: 'Todos los ciclos' }, ...options.ciclo.map((v) => ({ value: v, label: v }))]}
        onChange={(value) => onChange('ciclo', value)}
        placeholder="Buscar ciclo..."
      />
      <SearchableSelect
        label="Sección"
        value={sel.seccion}
        options={[{ value: '', label: 'Todas las secciones' }, ...options.seccion.map((v) => ({ value: v, label: v }))]}
        onChange={(value) => onChange('seccion', value)}
        placeholder="Buscar sección..."
      />
      {actions && <div className={styles.actionsWrapper}>{actions}</div>}
    </div>
  );
}
