/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { ICONS } from './Icons.js';

export const FormInput = ({ label, name, type, required = true, value, onInput, error, disabled = false, theme = 'light' }) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const finalType = type === 'password' && isPasswordVisible ? 'text' : type;

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(prev => !prev);
  };

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

  const handleFocus = (e) => e.target.select();

  if (type === 'date') {
    return html`
      <div>
        <label for=${name} class="block text-sm font-medium leading-6 ${labelClasses}">${label}</label>
        <div class="mt-2 relative">
          <input 
            id=${name} 
            name=${name} 
            type="date" 
            required=${required} 
            value=${value}
            onInput=${onInput}
            onFocus=${handleFocus}
            disabled=${disabled}
            style=${{ colorScheme: 'light' }}
            class="block w-full rounded-md p-2 shadow-sm placeholder:text-gray-400 focus:outline-none sm:text-sm sm:leading-6 transition-colors duration-200 ${inputClasses} ${hasError ? errorClasses : baseClasses} ${disabledClasses}" 
            aria-invalid=${hasError}
          />
        </div>
        ${hasError && html`<p id="${name}-error" class="mt-2 text-sm text-red-600" aria-live="polite">${error}</p>`}
      </div>
    `;
  }

  if (type === 'datetime-local') {
    const handleDateTimeInput = (e) => {
        const value = e.target.value;
        onInput({ target: { name, value: value ? new Date(value).toISOString() : '' } });
    };

    const formatISOToLocalInput = (isoString) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return '';
            
            const tzoffset = (new Date()).getTimezoneOffset() * 60000;
            const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
            return localISOTime;
        } catch {
            return '';
        }
    };

    return html`
      <div>
        <label for=${name} class="block text-sm font-medium leading-6 ${labelClasses}">${label}</label>
        <div class="mt-2 relative">
          <input 
            id=${name} 
            name=${name} 
            type="datetime-local" 
            required=${required} 
            value=${formatISOToLocalInput(value)}
            onInput=${handleDateTimeInput}
            onFocus=${handleFocus}
            disabled=${disabled}
            style=${{ colorScheme: 'light' }}
            class="block w-full rounded-md p-2 shadow-sm placeholder:text-gray-400 focus:outline-none sm:text-sm sm:leading-6 transition-colors duration-200 ${inputClasses} ${hasError ? errorClasses : baseClasses} ${disabledClasses}" 
            aria-invalid=${hasError}
          />
        </div>
        ${hasError && html`<p id="${name}-error" class="mt-2 text-sm text-red-600" aria-live="polite">${error}</p>`}
      </div>
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
          onFocus=${handleFocus}
          disabled=${disabled}
          class="block w-full rounded-md shadow-sm placeholder:text-gray-400 focus:outline-none sm:text-sm sm:leading-6 transition-colors duration-200 ${inputClasses} ${hasError ? errorClasses : baseClasses} ${disabledClasses} ${paddingClasses}" 
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