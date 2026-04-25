import { startTransition, useDeferredValue, useState } from "react";

function isSelected(value, optionValue, multi) {
  if (multi) {
    return Array.isArray(value) && value.includes(optionValue);
  }

  return value === optionValue;
}

export default function SearchBar({
  label,
  placeholder,
  options,
  value,
  onChange,
  multi = true,
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedValue = multi ? (Array.isArray(value) ? value : []) : value;
  const selectedOptions = multi
    ? options.filter((option) => normalizedValue.includes(option.value))
    : options.filter((option) => option.value === normalizedValue);
  const visibleOptions = options
    .filter((option) =>
      option.label.toLowerCase().includes(deferredQuery.trim().toLowerCase())
    )
    .slice(0, 24);

  function handleQueryChange(event) {
    const nextQuery = event.target.value;
    startTransition(() => {
      setQuery(nextQuery);
    });
  }

  function handleToggle(optionValue) {
    if (multi) {
      const currentValue = normalizedValue;
      const nextValue = currentValue.includes(optionValue)
        ? currentValue.filter((entry) => entry !== optionValue)
        : [...currentValue, optionValue];
      onChange(nextValue);
      return;
    }

    onChange(optionValue === value ? null : optionValue);
  }

  function handleRemove(optionValue) {
    if (multi) {
      onChange(normalizedValue.filter((entry) => entry !== optionValue));
      return;
    }

    onChange(null);
  }

  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <input
        className="search-input"
        value={query}
        onChange={handleQueryChange}
        placeholder={placeholder}
      />

      {selectedOptions.length ? (
        <div className="selected-grid">
          {selectedOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className="selected-chip"
              onClick={() => handleRemove(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="search-results">
        {visibleOptions.map((option) => (
          <button
            type="button"
            key={option.value}
            className={`search-option ${
              isSelected(value, option.value, multi) ? "search-option--active" : ""
            }`}
            onClick={() => handleToggle(option.value)}
          >
            <div className="search-option__label">
              {option.imageUrl ? <img src={option.imageUrl} alt="" aria-hidden="true" /> : null}
              <span>{option.label}</span>
            </div>
            <small>{option.meta || (multi ? "Multi-select" : "Single-select")}</small>
          </button>
        ))}

        {!visibleOptions.length ? (
          <p className="empty-state empty-state--inline">No matches found.</p>
        ) : null}
      </div>
    </div>
  );
}
