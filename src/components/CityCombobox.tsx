import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { formatCitySubtitle, searchCities, type GeoCandidate } from '../services/geocoding';

const COORD_RE = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
const DEBOUNCE_MS = 300;

interface CityComboboxProps {
  value: string;
  label: string;
  placeholder?: string;
  className?: string;
  onValueChange: (value: string) => void;
  onSelect: (candidate: GeoCandidate) => void;
}

type SearchStatus = 'idle' | 'loading' | 'done' | 'error';

/**
 * City input with debounced autocomplete. Suggestions show the administrative
 * context (北京朝阳 vs 辽宁朝阳) and the exact coordinates that will be applied,
 * so the user never has to guess whether the name they typed resolved.
 */
export default function CityCombobox({
  value,
  label,
  placeholder,
  className,
  onValueChange,
  onSelect,
}: CityComboboxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<GeoCandidate[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Only search once the user actually engages with the field: existing route
  // entries must not pop a dropdown (or hit the network) on mount.
  const [isEngaged, setIsEngaged] = useState(false);
  // Distinguishes "typed something, so show results" from "user dismissed the list".
  const userClosedRef = useRef(false);

  const query = value.trim();
  const isCoordinate = COORD_RE.test(query);

  useEffect(() => {
    if (!isEngaged || !query || isCoordinate) {
      setSuggestions([]);
      setStatus('idle');
      setIsOpen(false);
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');
    // Show "搜索中…" right away: the geocoder can take seconds on mobile networks,
    // and a silent field is what made the old input feel broken.
    if (!userClosedRef.current) setIsOpen(true);

    const timer = window.setTimeout(() => {
      searchCities(query)
        .then((results) => {
          if (cancelled) return;
          setSuggestions(results);
          setStatus('done');
          setActiveIndex(-1);
          if (!userClosedRef.current) setIsOpen(true);
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
          setStatus('error');
          if (!userClosedRef.current) setIsOpen(true);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, isCoordinate, isEngaged]);

  // Keep the highlighted row inside the scrollable list.
  useLayoutEffect(() => {
    if (activeIndex < 0) return;
    const active = inputRef.current
      ?.closest('.city-combobox')
      ?.querySelector<HTMLElement>(`[data-suggestion-index="${activeIndex}"]`);
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const choose = useCallback(
    (candidate: GeoCandidate) => {
      userClosedRef.current = true;
      setIsOpen(false);
      setSuggestions([]);
      setStatus('idle');
      onSelect(candidate);
    },
    [onSelect],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      userClosedRef.current = true;
      setIsOpen(false);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setIsOpen(true);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        const next = current + delta;
        if (next < 0) return suggestions.length - 1;
        if (next >= suggestions.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === 'Enter') {
      const candidate = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      if (isOpen && candidate) {
        event.preventDefault();
        choose(candidate);
      }
    }
  };

  const showNoMatch = isOpen && status === 'done' && suggestions.length === 0;
  const showError = isOpen && status === 'error';
  const showLoading = isOpen && status === 'loading';

  return (
    <div className="city-combobox">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
        autoComplete="off"
        spellCheck={false}
        className={className ? `city-combobox-input ${className}` : 'city-combobox-input'}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          userClosedRef.current = false;
          setIsEngaged(true);
          onValueChange(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          userClosedRef.current = false;
          setIsEngaged(true);
          if (suggestions.length > 0 || status === 'done' || status === 'error') setIsOpen(true);
        }}
        onBlur={() => {
          userClosedRef.current = true;
          setIsOpen(false);
          setIsEngaged(false);
        }}
      />

      {isOpen && (showLoading || showNoMatch || showError || suggestions.length > 0) && (
        <ul className="city-suggestions" id={listId} role="listbox" aria-label={`${label}候选`}>
          {showLoading && <li className="city-suggestions-hint">搜索中…</li>}
          {showError && (
            <li className="city-suggestions-hint">地名服务暂时不可用，可直接输入 纬度,经度</li>
          )}
          {showNoMatch && (
            <li className="city-suggestions-hint">
              没有匹配「{query}」，换个写法或直接输入 纬度,经度
            </li>
          )}
          {suggestions.map((candidate, index) => {
            const subtitle = formatCitySubtitle(candidate);
            return (
              <li key={`${candidate.latitude},${candidate.longitude},${candidate.name}`}>
                <button
                  type="button"
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  data-suggestion-index={index}
                  className={
                    index === activeIndex ? 'city-suggestion is-active' : 'city-suggestion'
                  }
                  // mousedown would blur the input before the click lands
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(candidate)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className="city-suggestion-main">
                    <span className="city-suggestion-name">{candidate.name}</span>
                    {subtitle && <span className="city-suggestion-subtitle">{subtitle}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
