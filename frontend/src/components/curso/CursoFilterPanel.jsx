import Dropdown from '../common/filters/Dropdown.jsx';
import FilterBar from '../common/filters/FilterBar.jsx';

export default function CursoFilterPanel({ sel, options, onChange, onReset }) {
  const hasActive = sel.programa || sel.curso || sel.ciclo || sel.seccion;
  const activeCount = [sel.programa, sel.curso, sel.ciclo, sel.seccion].filter(Boolean).length;

  return (
    <FilterBar activeCount={activeCount} hasActive={hasActive} onReset={onReset}>
      <Dropdown
        label="Programa"
        value={sel.programa}
        options={[{ value: '', label: 'Todos los programas' }, ...options.programa.map((v) => ({ value: v, label: v }))]}
        onChange={(v) => onChange('programa', v)}
        placeholder="Todos los programas"
      />
      <Dropdown
        label="Curso"
        value={sel.curso}
        options={[{ value: '', label: 'Seleccionar curso' }, ...options.curso.map((v) => ({ value: v, label: v }))]}
        onChange={(v) => onChange('curso', v)}
        placeholder="Seleccionar curso"
      />
      <Dropdown
        label="Ciclo"
        value={sel.ciclo}
        options={[{ value: '', label: 'Todos los ciclos' }, ...options.ciclo.map((v) => ({ value: v, label: v }))]}
        onChange={(v) => onChange('ciclo', v)}
        placeholder="Todos los ciclos"
      />
      <Dropdown
        label="Sección"
        value={sel.seccion}
        options={[{ value: '', label: 'Todas las secciones' }, ...options.seccion.map((v) => ({ value: v, label: v }))]}
        onChange={(v) => onChange('seccion', v)}
        placeholder="Todas las secciones"
      />
    </FilterBar>
  );
}
