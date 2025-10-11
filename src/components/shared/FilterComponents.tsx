/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { ICONS } from '../Icons.js';
import { SearchableMultiSelectDropdown } from '../SearchableMultiSelectDropdown.js';
import { FormInput } from '../FormComponents.js';

export const AdvancedFilterPanel = ({ isOpen, filters, onFilterChange, filterOptions }) => {
    if (!isOpen) return null;

    return html`
        <div class="p-4 bg-slate-50 border-t border-b animate-fade-in-down mb-6 rounded-b-lg shadow-inner">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <${SearchableMultiSelectDropdown}
                    label="Categoría"
                    name="category_ids"
                    options=${(filterOptions.categories || []).map(c => ({ value: c.id, label: c.nombre }))}
                    selectedValues=${filters.category_ids}
                    onSelectionChange=${onFilterChange}
                />
                <${SearchableMultiSelectDropdown}
                    label="Marca"
                    name="brand_names"
                    options=${(filterOptions.brands || []).map(b => ({ value: b.nombre, label: b.nombre }))}
                    selectedValues=${filters.brand_names}
                    onSelectionChange=${onFilterChange}
                />
            </div>
        </div>
    `;
};

export const FilterBar = ({ filters, onFilterChange, onClear, onToggleAdvanced, isAdvancedOpen, statusOptions }) => {
    const advancedFilterCount = filters.category_ids.length + filters.brand_names.length;
    const focusClasses = "focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25";

    return html`
        <div class="p-4 bg-white rounded-t-lg shadow-sm border-b-0 border">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="lg:col-span-1">
                    <${FormInput}
                        label=""
                        name="searchTerm"
                        type="text"
                        placeholder="Buscar por nombre, SKU o modelo..."
                        value=${filters.searchTerm}
                        onInput=${onFilterChange}
                        icon=${ICONS.search}
                        required=${false}
                    />
                </div>
                <div>
                    <label for="status" class="sr-only">Estado</label>
                    <select id="status" name="status" value=${filters.status} onChange=${onFilterChange} class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none ${focusClasses} sm:text-sm">
                        ${statusOptions.map(option => html`<option value=${option.value}>${option.label}</option>`)}
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <button onClick=${onToggleAdvanced} class="relative w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 flex items-center justify-center gap-2">
                        Filtros Avanzados ${isAdvancedOpen ? ICONS.chevron_up : ICONS.chevron_down}
                        ${advancedFilterCount > 0 && html`
                            <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">${advancedFilterCount}</span>
                        `}
                    </button>
                    <button onClick=${onClear} title="Limpiar todos los filtros" class="rounded-md bg-white p-2 text-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                        ${ICONS.delete}
                    </button>
                </div>
            </div>
        </div>
    `;
};