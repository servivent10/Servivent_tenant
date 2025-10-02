/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { ICONS } from './Icons.js';

export const SearchableMultiSelectDropdown = ({ label, options, selectedValues, onSelectionChange, name }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            // Focus the input when the dropdown opens
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setSearchTerm(''); // Clear search on close
        }
    }, [isOpen]);

    const handleCheckboxChange = (value) => {
        const newValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onSelectionChange({ target: { name, value: newValues } });
    };

    const filteredOptions = useMemo(() => {
        if (!searchTerm) {
            return options;
        }
        const lowercasedFilter = searchTerm.toLowerCase();
        return options.filter(option =>
            option.label.toLowerCase().includes(lowercasedFilter)
        );
    }, [options, searchTerm]);

    const handleClear = () => {
        onSelectionChange({ target: { name, value: [] } });
    }

    return html`
        <div ref=${wrapperRef} class="relative">
            <label class="block text-sm font-medium text-gray-700">${label}</label>
            <button 
                onClick=${() => setIsOpen(!isOpen)} 
                type="button" 
                class="mt-1 relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm"
            >
                <span class="block truncate text-gray-900">
                    ${selectedValues.length > 0 ? `${selectedValues.length} seleccionados` : 'Todos'}
                </span>
                <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
                    ${ICONS.chevron_down}
                </span>
            </button>
            ${isOpen && html`
                <div class="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                    <div class="p-2 border-b">
                         <div class="relative">
                            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">${ICONS.search}</div>
                            <input 
                                ref=${inputRef}
                                type="text"
                                placeholder="Buscar..."
                                value=${searchTerm}
                                onInput=${(e) => setSearchTerm(e.target.value)}
                                onClick=${(e) => e.stopPropagation()}
                                class="block w-full rounded-md border-gray-300 py-2 pl-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm"
                            />
                        </div>
                    </div>
                    <div class="max-h-56 overflow-auto p-2">
                    ${filteredOptions.map(option => html`
                        <label key=${option.value} class="flex w-full items-center gap-3 p-2 rounded-md hover:bg-slate-100 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked=${selectedValues.includes(option.value)} 
                                onChange=${() => handleCheckboxChange(option.value)} 
                                class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" 
                            />
                            <span class="text-sm text-gray-900 flex-1 truncate">${option.label}</span>
                        </label>
                    `)}
                    ${filteredOptions.length === 0 && html`
                        <p class="p-2 text-sm text-center text-gray-500">No se encontraron resultados.</p>
                    `}
                    </div>
                    ${selectedValues.length > 0 && html`
                        <div class="p-2 border-t">
                             <button onClick=${handleClear} class="w-full text-center text-sm text-primary hover:underline">Limpiar selección</button>
                        </div>
                    `}
                </div>
            `}
        </div>
    `;
};
