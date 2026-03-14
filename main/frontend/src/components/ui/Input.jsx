import { forwardRef } from 'react';
import { classNames } from '../../utils/helpers';

export const Input = forwardRef(({
  label,
  error,
  icon: Icon,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Icon className="w-5 h-5 text-gray-500" />
          </div>
        )}
        <input
          ref={ref}
          className={classNames(
            'w-full bg-dark-700 border rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all',
            Icon && 'pl-12',
            error ? 'border-red-500/50' : 'border-white/10',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export const TextArea = forwardRef(({
  label,
  error,
  className = '',
  containerClassName = '',
  rows = 4,
  ...props
}, ref) => {
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={classNames(
          'w-full bg-dark-700 border rounded-xl px-4 py-3 text-gray-100 placeholder-gray-500 resize-none',
          'focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all',
          error ? 'border-red-500/50' : 'border-white/10',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
});

TextArea.displayName = 'TextArea';

export const Select = forwardRef(({
  label,
  error,
  options = [],
  placeholder,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={classNames(
          'w-full bg-dark-700 border rounded-xl px-4 py-3 text-gray-100',
          'focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all',
          'appearance-none cursor-pointer',
          error ? 'border-red-500/50' : 'border-white/10',
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" className="text-gray-500">{placeholder}</option>
        )}
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value}
            className="bg-dark-700"
          >
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1.5 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export function Checkbox({ label, checked, onChange, className = '' }) {
  return (
    <label className={classNames('flex items-center gap-3 cursor-pointer', className)}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <div className={classNames(
          'w-5 h-5 border rounded transition-all',
          checked 
            ? 'bg-cyan-500 border-cyan-500' 
            : 'bg-dark-700 border-white/20'
        )}>
          {checked && (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
      <span className="text-gray-300">{label}</span>
    </label>
  );
}
