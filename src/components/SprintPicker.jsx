import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { absToQS, formatSprintRange, qsToAbs } from '../lib/schedule.js';

export default function SprintPicker({ value, onChange, quarters, calendar }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = absToQS(value, quarters);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const handlePillClick = (quarterId, sprintInQuarter) => {
    const abs = qsToAbs(quarterId, sprintInQuarter, quarters);
    if (abs != null) onChange(abs);
    setOpen(false);
  };

  const buttonLabel = current
    ? `${current.quarter.name} S${current.sprint} · ${formatSprintRange(value, calendar)}`
    : '— select sprint —';

  return (
    <div className="sprint-picker" ref={ref}>
      <button
        type="button"
        className="sprint-picker-button field-input"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="sprint-picker-button-label">{buttonLabel}</span>
        <ChevronDown size={16} className="sprint-picker-chevron" />
      </button>

      {open && (
        <div className="sprint-picker-panel" role="listbox">
          {quarters.map((q) => (
            <div
              key={q.id}
              className="sprint-picker-row"
              style={{ borderLeftColor: `#${q.color}` }}
            >
              <span className="sprint-picker-row-label">{q.name}</span>
              <div className="sprint-picker-pills">
                {Array.from({ length: q.sprintCount }, (_, i) => {
                  const sprintInQuarter = i + 1;
                  const abs = qsToAbs(q.id, sprintInQuarter, quarters);
                  const isSelected = abs === value;
                  return (
                    <button
                      type="button"
                      key={i}
                      className={`sprint-pill${isSelected ? ' sprint-pill-selected' : ''}`}
                      style={
                        isSelected
                          ? { backgroundColor: `#${q.color}` }
                          : undefined
                      }
                      onClick={() => handlePillClick(q.id, sprintInQuarter)}
                      aria-label={`${q.name} S${sprintInQuarter}`}
                      aria-selected={isSelected}
                    >
                      S{sprintInQuarter}
                      <div className="sprint-tooltip" role="tooltip">
                        <div className="sprint-tooltip-label">
                          {q.name} S{sprintInQuarter}
                        </div>
                        <div className="sprint-tooltip-date">
                          {formatSprintRange(abs, calendar)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
