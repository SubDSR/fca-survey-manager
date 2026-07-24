import styles from './FilterSelect.module.css';

function normalizeOption(option) {
  if (typeof option === 'object' && option !== null) {
    return { value: option.value, label: option.label ?? option.value };
  }
  return { value: option, label: option };
}

export default function FilterSelect({ label, value, options, onChange }) {
  return (
    <div className={styles.filterGroup}>
      {label && <label>{label}</label>}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(normalizeOption).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
