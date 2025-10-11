/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { ICONS } from './Icons.js';

export const FormInput = ({ label, name, type, required = true, value, onInput, error, disabled = false, theme = 'light', icon, rightElement, ...props }) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const { className, ...restProps } = props;

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(prev => !prev);
  };
  
  // --- Determine props based on input type ---
  let inputType = type;
  let inputValue = value;
  let onInputHandler = onInput;
  // FIX: Explicitly typed 'otherInputProps' as 'any' to allow adding properties like 'style' dynamically, resolving the TypeScript error.
  const otherInputProps: any = {};

  if (type === 'password' && isPasswordVisible) {
    inputType = 'text';
  }

  if (type === 'date' || type === 'datetime-local') {
    otherInputProps.style = { colorScheme: 'light' };
  }

  if (type === 'datetime-local') {
    const formatISOToLocalInput = (isoString) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return '';
            const tzoffset = (new Date()).getTimezoneOffset() * 60000;
            return new Date(date.getTime() - tzoffset).toISOString().slice(0, 16);
        } catch { return ''; }
    };
    inputValue = formatISOToLocalInput(value);
  }

  // --- Class definitions ---
  const hasError = !!error;
  const isDark = theme === 'dark';

  const labelClasses = isDark ? 'text-gray-300' : 'text-gray-900';
  const baseClasses = isDark 
    ? 'ring-1 ring-inset ring-gray-500 focus:ring-primary' 
    : 'border border-gray-300 focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25';
  
  const errorClasses = isDark 
    ? 'ring-1 ring-inset ring-red-500 focus:ring-red-500'
    : 'border border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/25';
    
  const inputClasses = isDark 
    ? 'bg-gray-700/50 text-white placeholder-gray-400' 
    : 'bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500';
  
  const disabledClasses = disabled ? 'cursor-not-allowed' : '';
  const buttonClasses = isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700';
  
  let paddingClasses = 'p-2';
  if (icon) {
      paddingClasses += ' pl-10';
  }
  if (type === 'password' || rightElement) {
      paddingClasses += ' pr-10';
  }

  const fullClass = `block w-full rounded-md shadow-sm placeholder:text-gray-400 focus:outline-none sm:text-sm sm:leading-6 transition-colors duration-200 ${inputClasses} ${hasError ? errorClasses : baseClasses} ${disabledClasses} ${paddingClasses} ${className || ''}`;

  return html`
    <div>
      ${label && html`<label for=${name} class="block text-sm font-medium leading-6 ${labelClasses}">${label}</label>`}
      <div class=${label ? 'mt-2' : ''}>
        <div class="relative">
            ${icon && html`
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <div class="text-gray-400">${icon}</div>
                </div>
            `}
            <input 
              id=${name} 
              name=${name} 
              type=${inputType} 
              required=${required} 
              value=${inputValue}
              onInput=${onInputHandler}
              onFocus=${(e) => e.target.select()}
              disabled=${disabled}
              class=${fullClass}
              aria-invalid=${hasError}
              aria-describedby=${hasError ? `${name}-error` : undefined}
              ...${otherInputProps}
              ...${restProps}
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
            ${rightElement && html`
                <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                    ${rightElement}
                </div>
            `}
        </div>
      </div>
      ${hasError && html`<p id="${name}-error" class="mt-2 text-sm text-red-600" aria-live="polite">${error}</p>`}
    </div>
  `;
};

export const FormSelect = ({ label, name, value, onInput, options, children, required = true, disabled = false, className = '' }) => {
  const selectClasses = 'block w-full rounded-md border border-gray-300 p-2 bg-white text-gray-900 shadow-sm focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm';

  return html`
    <div>
      ${label && html`<label for=${name} class="block text-sm font-medium leading-6 text-gray-900">${label}</label>`}
      <div class=${label ? 'mt-2' : ''}>
        <select
          id=${name}
          name=${name}
          value=${value}
          onInput=${onInput}
          required=${required}
          disabled=${disabled}
          class="${selectClasses} ${className}"
        >
          ${options ? options.map(opt => html`<option key=${opt.value} value=${opt.value}>${opt.label}</option>`) : children}
        </select>
      </div>
    </div>
  `;
};


export const FormButtons = ({ onBack, backText = 'Volver', nextText = 'Siguiente' }) => html`
  <div class="mt-8 flex justify-between">
    ${onBack ? html`<button type="button" onClick=${onBack} class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">${backText}</button>` : html`<div></div>`}
    <button type="submit" class="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">${nextText}</button>
  </div>
`;