/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { ICONS } from './Icons.js';

export const FormInput = ({ label, name, type, required = true, value, onInput, error, disabled = false }) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const finalType = type === 'password' && isPasswordVisible ? 'text' : type;

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(prev => !prev);
  };

  const hasError = !!error;

  const labelClasses = 'text-gray-900';
  const baseRingClasses = 'ring-gray-300 focus:ring-primary';
  const errorRingClasses = 'ring-red-500 focus:ring-red-500';
  const inputClasses = `bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500`;
  const disabledClasses = disabled ? 'cursor-not-allowed' : '';
  const buttonClasses = 'text-gray-500 hover:text-gray-700';

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
          class="block w-full rounded-md border-0 p-2 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition-colors duration-200 ${inputClasses} ${hasError ? errorRingClasses : baseRingClasses} ${disabledClasses}" 
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