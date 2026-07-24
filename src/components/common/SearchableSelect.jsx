import { useState, useRef, useEffect } from 'react';
import styles from './SearchableSelect.module.css';
import filterStyles from './FilterSelect.module.css';

function normalizeOption(option) {
  if (typeof option === 'object' && option !== null) {
    return { value: option.value, label: option.label ?? option.value };
  }
  return { value: option, label: option };
}

export default function SearchableSelect({ label, value, options, onChange, placeholder = "Buscar..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  const normalizedOptions = options.map(normalizeOption);
  const selectedOption = normalizedOptions.find(opt => opt.value === value);
  const displayValue = isOpen ? searchTerm : (selectedOption ? selectedOption.label : '');

  const filteredOptions = normalizedOptions.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedEl = listRef.current.querySelector(`.${styles.selected}`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen]);

  const handleInputClick = () => {
    setIsOpen(true);
    setSearchTerm('');
  };

  const handleOptionClick = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={filterStyles.filterGroup} ref={wrapperRef}>
      {label && <label>{label}</label>}
      <div className={styles.inputWrapper}>
        <input
          type="text"
          value={displayValue}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          onClick={handleInputClick}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          className={styles.searchInput}
        />
        <svg className={styles.arrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        
        {isOpen && (
          <ul className={styles.dropdown} ref={listRef}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <li
                  key={opt.value}
                  className={`${styles.option} ${opt.value === value ? styles.selected : ''}`}
                  onClick={() => handleOptionClick(opt.value)}
                >
                  {opt.label}
                </li>
              ))
            ) : (
              <li className={styles.noResults}>Sin resultados</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
