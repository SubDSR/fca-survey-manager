import Dropdown from '../common/filters/Dropdown.jsx';
import EstadoToggle from '../common/filters/EstadoToggle.jsx';
import CicloMultiSelect from '../common/filters/CicloMultiSelect.jsx';
import FilterBar from '../common/filters/FilterBar.jsx';

export default function Filters({ filters, options, onChange, onToggleCiclo, onClearCiclo, onReset }) {
  const hasActive = filters.categoria || filters.programa || filters.ciclo.length > 0 || filters.seccion || filters.docente || filters.estado;
  const activeCount = [filters.categoria, filters.programa, filters.seccion, filters.docente, filters.estado].filter(Boolean).length
    + (filters.ciclo.length > 0 ? 1 : 0);

  return (
    <FilterBar activeCount={activeCount} hasActive={hasActive} onReset={onReset}>
      <Dropdown
        label="Categoría"
        value={filters.categoria}
        options={[{ value: '', label: 'Todas las categorías' }, ...options.categoria.map((v) => ({ value: v, label: v }))]}
        onChange={(v) => onChange('categoria', v)}
        placeholder="Todas las categorías"
      />
      <Dropdown
        label="Programa"
        value={filters.programa}
        options={[{ value: '', label: 'Todos los programas' }, ...options.programa.map((v) => ({ value: v, label: v }))]}
        onChange={(v) => onChange('programa', v)}
        placeholder="Todos los programas"
      />
      <CicloMultiSelect ciclos={filters.ciclo} options={options.ciclo} onToggle={onToggleCiclo} onClear={onClearCiclo} />
      <Dropdown
        label="Sección"
        value={filters.seccion}
        options={[{ value: '', label: 'Todas las secciones' }, ...options.seccion.map((v) => ({ value: v, label: v }))]}
        onChange={(v) => onChange('seccion', v)}
        placeholder="Todas las secciones"
      />
      <Dropdown
        label="Docente"
        value={filters.docente}
        options={[{ value: '', label: 'Todos los docentes' }, ...options.docente.map((v) => ({ value: v, label: v }))]}
        onChange={(v) => onChange('docente', v)}
        placeholder="Todos los docentes"
      />
      <EstadoToggle estado={filters.estado} onChange={onChange} />
    </FilterBar>
  );
}
