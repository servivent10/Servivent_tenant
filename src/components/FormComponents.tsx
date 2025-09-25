/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { ICONS } from './Icons.js';
import { CalendarModal } from './CalendarModal.js';

export const FormInput = ({ label, name, type, required = true, value, onInput, error, disabled = false, theme = 'light' }) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const finalType = type === 'password' && isPasswordVisible ? 'text' : type;

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(prev => !prev);
  };

  const hasError = !!error;
  const isDark = theme === 'dark';

  const labelClasses = isDark ? 'text-gray-300' : 'text-gray-900';
  const baseRingClasses = isDark ? 'ring-gray-500 focus:ring-primary' : 'ring-gray-300 focus:ring-primary';
  const errorRingClasses = 'ring-red-500 focus:ring-red-500';
  const inputClasses = isDark 
    ? 'bg-gray-700/50 text-white placeholder-gray-400' 
    : 'bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500';
  
  const disabledClasses = disabled ? 'cursor-not-allowed' : '';
  const buttonClasses = isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700';

  if (type === 'date') {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [displayValue, setDisplayValue] = useState('');

    useEffect(() => {
        try {
            if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                const [year, month, day] = value.split('-');
                // JavaScript Date constructor with parts is local timezone
                const date = new Date(year, parseInt(month) - 1, day);
                if (!isNaN(date.getTime())) {
                    setDisplayValue(date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }));
                } else {
                    setDisplayValue(value); // Fallback to raw value if invalid
                }
            } else {
                setDisplayValue(value || '');
            }
        } catch (e) {
            setDisplayValue(value || '');
        }
    }, [value]);
    
    const handleDateSelect = (date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        if (onInput) {
            onInput({ target: { name, value: formattedDate } });
        }
        setIsCalendarOpen(false);
    };

    const handleTextInput = (e) => {
        const textValue = e.target.value;
        setDisplayValue(textValue); // Update display immediately

        // Try to parse dd/mm/yyyy into yyyy-mm-dd
        const parts = textValue.split('/');
        if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
            const [day, month, year] = parts;
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            if (!isNaN(date.getTime()) && date.getFullYear() == year && date.getMonth() + 1 == month && date.getDate() == day) {
                const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                if (onInput && value !== formattedDate) {
                     onInput({ target: { name, value: formattedDate } });
                }
            }
        }
    };


    return html`
      <div>
        <label for=${name} class="block text-sm font-medium leading-6 ${labelClasses}">${label}</label>
        <div class="mt-2 relative">
          <input 
            type="text" 
            required=${required} 
            value=${displayValue}
            onInput=${handleTextInput}
            placeholder="dd/mm/aaaa"
            disabled=${disabled}
            class="block w-full rounded-md border-0 p-2 pr-10 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition-colors duration-200 ${inputClasses} ${hasError ? errorRingClasses : baseRingClasses} ${disabledClasses}" 
            aria-invalid=${hasError}
          />
          <button 
            type="button" 
            onClick=${() => !disabled && setIsCalendarOpen(true)}
            class="absolute inset-y-0 right-0 flex items-center pr-3 ${buttonClasses} ${disabledClasses}"
            aria-label="Abrir calendario"
          >
            ${ICONS.calendar_month}
          </button>
        </div>
        ${hasError && html`<p id="${name}-error" class="mt-2 text-sm text-red-600" aria-live="polite">${error}</p>`}
      </div>
      <${CalendarModal}
        isOpen=${isCalendarOpen}
        onClose=${() => setIsCalendarOpen(false)}
        currentDate=${value ? new Date(value.replace(/-/g, '/')) : new Date()}
        onDateSelect=${handleDateSelect}
      />
    `;
  }
  
  const paddingClasses = type === 'password' ? 'p-2 pr-10' : 'p-2';

  return html`
    <div>
      <label for=${name} class="block text-sm font-medium leading-6 ${labelClasses}">${label}</label>
      <div class="mt-2 relative">
        <input 
          id=${name} 
          name=${name} 
          type=${finalType} 
          required=${required} 
          value=${value}
          onInput=${onInput}
          disabled=${disabled}
          class="block w-full rounded-md border-0 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition-colors duration-200 ${inputClasses} ${hasError ? errorRingClasses : baseRingClasses} ${disabledClasses} ${paddingClasses}" 
          aria-invalid=${hasError}
          aria-describedby=${hasError ? `${name}-error` : undefined}
        />
        ${type === 'password' && html`
          <button 
            type="button" 
            onClick=${togglePasswordVisibility}
            class="absolute inset-y-0 right-0 flex items-center pr-3 ${buttonClasses}"
            aria-label=${isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            ${isPasswordVisible ? ICONS.eyeSlash : ICONS.eye}
          </button>
        `}
      </div>
      ${hasError && html`<p id="${name}-error" class="mt-2 text-sm text-red-600" aria-live="polite">${error}</p>`}
    </div>
  `;
};

export const FormButtons = ({ onBack, backText = 'Volver', nextText = 'Siguiente' }) => html`
  <div class="mt-8 flex justify-between">
    ${onBack ? html`<button type="button" onClick=${onBack} class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">${backText}</button>` : html`<div></div>`}
    <button type="submit" class="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">${nextText}</button>
  </div>
`;