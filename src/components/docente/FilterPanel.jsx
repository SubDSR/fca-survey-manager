import Dropdown from '../common/filters/Dropdown.jsx';
import EstadoToggle from '../common/filters/EstadoToggle.jsx';
import CicloMultiSelect from '../common/filters/CicloMultiSelect.jsx';
import FilterBar from '../common/filters/FilterBar.jsx';

export default function FilterPanel({ sel, options, onChange, onToggleCiclo, onClearCiclo, onReset }) {
  const hasActive = sel.programa || sel.categoria || sel.selected || sel.curso || sel.estado || sel.ciclo.length > 0 || sel.seccion;
  const activeCount = [sel.programa, sel.categoria, sel.selected, sel.curso, sel.estado, sel.seccion].filter(Boolean).length
    + (sel.ciclo.length > 0 ? 1 : 0);

  return (
    <FilterBar activeCount={activeCount} hasActive={hasActive} onReset={onReset}>
      <Dropdown
        label="Programa académico"
        value={sel.programa}
        options={[{ value: '', label: 'Todos los programas' }, ...options.programa.map((v) => ({ value: v, label: v }))]}
        onChange={(v) => onChange('programa', v)}
        placeholder="Todos los programas"
      />
      <Dropdown
        label="Categoría docente"
        value={sel.categoria}
        options={[{ value: '', label: 'Todas las categorías' }, ...options.categoria.map((v) => ({ value: v, label: v }))]}
        onChange={(v) => onChange('categoria', v)}
        placeholder="Todas las categorías"
      />
      <Dropdown
        label="Docente"
        value={sel.selected}
        options={[{ value: '', label: 'Seleccionar docente' }, ...options.docente.map((v) => ({ value: v, label: v }))]}
        onChange={(v) => onChange('selected', v)}
        placeholder="Seleccionar docente"
      />
      <Dropdown
        label="Curso"
        value={sel.curso}
        options={[{ value: '', label: 'Todos los cursos' }, ...options.curso]}
        onChange={(v) => onChange('curso', v)}
        placeholder="Todos los cursos"
      />
      <CicloMultiSelect ciclos={sel.ciclo} options={options.ciclo} onToggle={onToggleCiclo} onClear={onClearCiclo} />
      <Dropdown
        label="Sección"
        value={sel.seccion}
        options={[{ value: '', label: 'Todas las secciones' }, ...options.seccion.map((v) => ({ value: v, label: v }))]}
        onChange={(v) => onChange('seccion', v)}
        placeholder="Todas las secciones"
      />
      <EstadoToggle estado={sel.estado} onChange={onChange} />
    </FilterBar>
  );
}
