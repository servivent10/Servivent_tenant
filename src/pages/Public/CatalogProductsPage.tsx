/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useMemo } from 'preact/hooks';
import { ICONS } from '../../components/Icons.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';

const INPUT_FOCUS_CLASSES = 'focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25';

const formatCurrency = (value, currencySymbol = 'Bs') => {
    const number = Number(value || 0);
    return `${currencySymbol} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getStockStatus = (stock) => {
    if (stock <= 0) return { text: 'Agotado', color: 'text-red-600' };
    if (stock <= 5) return { text: 'Pocas Unidades', color: 'text-amber-600' };
    return { text: 'Disponible', color: 'text-green-600' };
};

const PublicProductCard = ({ product, onAddToCart, currencySymbol, navigate, slug }) => {
    const isAvailable = product.stock_consolidado > 0;
    const hasOffer = product.precio_oferta > 0 && product.precio_oferta < product.precio_base;
    const displayPrice = hasOffer ? product.precio_oferta : product.precio_base;
    const stockStatus = getStockStatus(product.stock_consolidado);

    return html`
        <div class="group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
            <a href=${`/#/catalogo/${slug}/producto/${product.id}`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}/producto/${product.id}`); }} class="flex flex-col h-full">
                <div class="aspect-w-1 aspect-h-1 bg-gray-100">
                    <img src=${product.imagen_principal || NO_IMAGE_ICON_URL} alt=${product.nombre} class="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div class="flex flex-1 flex-col space-y-2 p-4">
                    <h3 class="text-sm font-medium text-gray-900 h-10">
                        <span aria-hidden="true" class="absolute inset-0"></span>
                        ${product.nombre}
                    </h3>
                    <p class="text-sm text-gray-500 flex-grow">${product.modelo || product.marca || ''}</p>
                    <div class="flex flex-col justify-end">
                        <div class="flex items-baseline gap-2">
                            <p class="text-lg font-semibold text-gray-900">${formatCurrency(displayPrice, currencySymbol)}</p>
                            ${hasOffer && html`<p class="text-sm text-gray-500 line-through">${formatCurrency(product.precio_base, currencySymbol)}</p>`}
                        </div>
                        <p class="text-xs font-medium ${stockStatus.color}">${stockStatus.text}</p>
                    </div>
                </div>
            </a>
            <div class="p-4 pt-0 z-10">
                <button 
                    onClick=${(e) => { e.stopPropagation(); onAddToCart(product); }}
                    disabled=${!isAvailable}
                    class="w-full rounded-md px-3.5 py-2 text-sm font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${isAvailable ? 'bg-primary hover:bg-primary-hover focus-visible:outline-primary' : 'bg-gray-400 cursor-not-allowed'}"
                >
                    ${isAvailable ? 'Añadir al Carrito' : 'Agotado'}
                </button>
            </div>
        </div>
    `;
};

const FilterSidebar = ({ categories = [], brands = [], activeFilters, onFilterChange, onClearFilters, isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('categories');
    const [categorySearch, setCategorySearch] = useState('');
    const [brandSearch, setBrandSearch] = useState('');

    const filteredCategories = useMemo(() => {
        if (!categorySearch) return categories;
        return categories.filter(cat => cat.nombre.toLowerCase().includes(categorySearch.toLowerCase()));
    }, [categories, categorySearch]);

    const filteredBrands = useMemo(() => {
        if (!brandSearch) return brands;
        return brands.filter(brand => brand.nombre.toLowerCase().includes(brandSearch.toLowerCase()));
    }, [brands, brandSearch]);

    const handlePillClick = (filterType, value) => {
        const currentSelection = activeFilters[filterType];
        const newSelection = currentSelection === value ? null : value;
        onFilterChange(filterType, newSelection);
    };

    const tabButtonClasses = (tabName) => `whitespace-nowrap border-b-2 py-3 px-2 text-sm font-medium ${activeTab === tabName ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`;

    const renderFilterList = (items, filterType, search, setSearch, onPillClick, activePill) => html`
        <div class="space-y-4">
            <div class="relative">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span class="text-gray-400">${ICONS.search}</span>
                </div>
                <input 
                    type="search" 
                    placeholder="Buscar..." 
                    value=${search} 
                    onInput=${e => setSearch(e.target.value)}
                    onFocus=${(e) => e.target.select()}
                    class="w-full text-sm rounded-md border border-gray-300 py-2 pl-10 bg-white text-gray-900 shadow-sm focus:outline-none ${INPUT_FOCUS_CLASSES}"
                />
            </div>
            <div class="flex flex-wrap gap-2">
                ${items.map(item => {
                    const value = filterType === 'categories' ? item.id : item.nombre;
                    const isSelected = activePill === value;
                    return html`
                        <button 
                            key=${value}
                            onClick=${() => onPillClick(filterType, value)}
                            class="flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors ${isSelected ? 'bg-primary text-white ring-2 ring-primary-dark' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
                        >
                            <span>${item.nombre}</span>
                            <span class="text-xs font-semibold">${item.product_count}</span>
                        </button>
                    `;
                })}
            </div>
        </div>
    `;

    const content = html`
        <div class="flex flex-col sticky top-16">
            <div class="flex items-center justify-between px-4 py-3 border-b">
                <h3 class="text-lg font-semibold">Filtros</h3>
                ${(activeFilters.categories || activeFilters.brands) && html`
                    <button onClick=${onClearFilters} class="text-sm font-medium text-primary hover:underline">Limpiar</button>
                `}
            </div>
             <div class="border-b border-gray-200 px-4">
                <nav class="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick=${() => setActiveTab('categories')} class=${tabButtonClasses('categories')}>Categorías</button>
                    <button onClick=${() => setActiveTab('brands')} class=${tabButtonClasses('brands')}>Marcas</button>
                </nav>
            </div>
            <div class="p-4">
                ${activeTab === 'categories' && renderFilterList(filteredCategories, 'categories', categorySearch, setCategorySearch, handlePillClick, activeFilters.categories)}
                ${activeTab === 'brands' && renderFilterList(filteredBrands, 'brands', brandSearch, setBrandSearch, handlePillClick, activeFilters.brands)}
            </div>
        </div>
    `;

    return html`
        <!-- Mobile Sidebar -->
        <div class="relative z-40 lg:hidden" role="dialog" aria-modal="true" hidden=${!isOpen}>
            <div class="fixed inset-0 bg-black bg-opacity-25" onClick=${onClose}></div>
            <div class="fixed inset-0 z-40 flex">
                <div class="relative flex w-full max-w-xs flex-col overflow-y-auto bg-white pb-12 shadow-xl">
                    <div class="flex px-4 pt-5 pb-2">
                        <button type="button" class="-m-2 inline-flex items-center justify-center rounded-md p-2 text-gray-400" onClick=${onClose}>
                            <span class="sr-only">Close menu</span>
                            ${ICONS.close}
                        </button>
                    </div>
                    ${content}
                </div>
            </div>
        </div>
        <!-- Desktop Sidebar -->
        <aside class="hidden lg:block lg:flex-shrink-0 lg:w-72">
           ${content}
        </aside>
    `;
};


export function CatalogProductsPage({ products, categories, brands, onFilterChange, onClearFilters, onAddToCart, company, navigate, slug, filters }) {
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    return html`
        <div class="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
            <div class="lg:grid lg:grid-cols-[288px_1fr] lg:gap-x-8 lg:items-start">
                <${FilterSidebar} 
                    categories=${categories} 
                    brands=${brands}
                    activeFilters=${filters}
                    onFilterChange=${onFilterChange}
                    onClearFilters=${onClearFilters}
                    isOpen=${isFilterOpen}
                    onClose=${() => setIsFilterOpen(false)}
                />

                <main class="flex-grow py-6">
                    <div>
                        <div class="flex items-baseline justify-between border-b border-gray-200 pb-6">
                            <h1 class="text-2xl sm:text-4xl font-bold tracking-tight text-gray-900">Todos los Productos</h1>
                            <button type="button" class="p-2 text-gray-400 hover:text-gray-500 lg:hidden" onClick=${() => setIsFilterOpen(true)}>
                                <span class="sr-only">Filters</span>
                                ${ICONS.settings}
                            </button>
                        </div>
                        <div class="pt-6 grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            ${products.map(product => html`
                                <${PublicProductCard} 
                                    product=${product} 
                                    onAddToCart=${onAddToCart} 
                                    currencySymbol=${company.moneda_simbolo}
                                    navigate=${navigate}
                                    slug=${slug}
                                />
                            `)}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    `;
}