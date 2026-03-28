import React, { useId } from 'react';

interface InputGroupProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
}

export const InputGroup: React.FC<InputGroupProps> = ({ label, value, onChange, unit, step = 1, min = 0, max }) => {
  const id = useId();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</label>
      <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
        <input
          id={id}
          type="number"
          value={value}
          onChange={(e) => {
            const num = Number(e.target.value);
            if (!Number.isNaN(num) && Number.isFinite(num)) {
              onChange(Math.max(min, max !== undefined ? Math.min(num, max) : num));
            }
          }}
          step={step}
          min={min}
          max={max}
          className="flex-1 px-3 py-2 outline-none text-gray-800 text-sm font-medium w-full"
        />
        {unit && (
          <span className="bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-500 border-l border-gray-300">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};
