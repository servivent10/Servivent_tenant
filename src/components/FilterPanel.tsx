/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { ICONS } from './Icons.js';

export function FilterPanel({ counts, activeFilters, onFilterChange, onClearFilters }) {
    const [activeTab, setActiveTab] = useState('categorias');
    const [filterSearchTerm, setFilterSearchTerm] = useState('');

    const lowercasedFilterSearch = filterSearchTerm.toLowerCase();
    
    const categories = Object.entries(counts.categories || {})
        .filter(([name]) => name.toLowerCase().includes(lowercasedFilterSearch))
        .sort((a, b) => a[0].localeCompare(b[0]));
        
    const brands = Object.entries(counts.brands || {})
        .filter(([name]) => name.toLowerCase().includes(lowercasedFilterSearch))
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    return html`
        <div class="flex flex-col h-full">
            <div class="p-4 border-b flex justify-between items-center">
                <h3 class="text-lg font-semibold text-gray-900">Filtros</h3>
                 <button onClick=${onClearFilters} class="text-sm font-medium text-primary hover:text-primary-dark">
                    Limpiar
                </button>
            </div>
            <div class="flex-grow p-4 overflow-y-auto">
                <div class="border-b border-gray-200">
                    <nav class="-mb-px flex space-x-4" aria-label="Tabs">
                        <button onClick=${() => setActiveTab('categorias')} class=${`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${activeTab === 'categorias' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            Categorías
                        </button>
                        <button onClick=${() => setActiveTab('marcas')} class=${`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${activeTab === 'marcas' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            Marcas
                        </button>
                    </nav>
                </div>

                <div class="mt-4 relative">
                    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">${ICONS.search}</div>
                    <input 
                        type="text" 
                        placeholder="Buscar..." 
                        value=${filterSearchTerm} 
                        onInput=${e => setFilterSearchTerm(e.target.value)}
                        class="block w-full rounded-md border border-gray-300 p-2 pl-10 bg-white text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm"
                    />
                </div>
                
                <div class="mt-4">
                    <ul class="divide-y divide-gray-200">
                        ${activeTab === 'categorias' && categories.map(([name, count]) => {
                            const isActive = activeFilters.category.includes(name);
                            return html`
                            <li key=${name} class="py-2">
                                <button onClick=${() => onFilterChange('category', name)} class="w-full flex items-center justify-between text-left text-sm text-gray-600 hover:text-primary">
                                    <span class=${`truncate ${isActive ? 'font-bold text-primary' : ''}`}>${name}</span>
                                    <span class=${`ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${isActive ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>${count}</span>
                                </button>
                            </li>
                        `})}
                        ${activeTab === 'marcas' && brands.map(([name, count]) => {
                             const isActive = activeFilters.brand.includes(name);
                            return html`
                            <li key=${name} class="py-2">
                                <button onClick=${() => onFilterChange('brand', name)} class="w-full flex items-center justify-between text-left text-sm text-gray-600 hover:text-primary">
                                    <span class=${`truncate ${isActive ? 'font-bold text-primary' : ''}`}>${name}</span>
                                    <span class=${`ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${isActive ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>${count}</span>
                                </button>
                            </li>
                        `})}
                    </ul>
                </div>
            </div>
        </div>
    `;
}