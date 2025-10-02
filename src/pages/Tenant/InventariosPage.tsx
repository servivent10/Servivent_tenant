/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { supabase } from '../../lib/supabaseClient.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';
import { FilterPanel } from '../../components/FilterPanel.js';

const StockStatusPill = ({ stock, minStock = 0 }) => {
    let pillClass, text;
    if (stock <= 0) {
        pillClass = 'bg-red-100 text-red-800';
        text = 'Agotado';
    } else if (stock <= minStock) {
        pillClass = 'bg-yellow-100 text-yellow-800';
        text = 'Bajo Stock';
    } else {
        pillClass = 'bg-green-100 text-green-800';
        text = 'En Stock';
    }
    return html`<span class="${pillClass} inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">${text}</span>`;
};

export function InventariosPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();

    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilters, setActiveFilters] = useState({ status: 'all', category: [], brand: [] });
    const [expandedRowId, setExpandedRowId] = useState(null);
    const [detailedStock, setDetailedStock] = useState({});
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

    const fetchData = useCallback(async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_company_products_with_stock_and_cost');
            if (error) throw error;
            
            const productsData = data || [];
            setProducts(productsData);

        } catch (err) {
            addToast({ message: `Error al cargar inventario: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    }, [addToast, startLoading, stopLoading]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    useEffect(() => {
        const channel = supabase
            .channel('realtime_inventarios')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventarios' }, (payload) => {
                addToast({ message: 'El inventario se ha actualizado en tiempo real.', type: 'info', duration: 3000 });
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData, addToast]);
    
    useEffect(() => {
        if (isMobileFilterOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isMobileFilterOpen]);

    const filterCounts = useMemo(() => {
        const categories = products.reduce((acc, p) => {
            const cat = p.categoria_nombre || 'Sin Categoría';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {});
        const brands = products.reduce((acc, p) => {
            const brand = p.marca || 'Sin Marca';
            acc[brand] = (acc[brand] || 0) + 1;
            return acc;
        }, {});
        return { categories, brands };
    }, [products]);
    
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const searchTermLower = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' ||
                p.nombre?.toLowerCase().includes(searchTermLower) ||
                p.modelo?.toLowerCase().includes(searchTermLower);

            let matchesStatus = true;
            if (activeFilters.status !== 'all') {
                const stock = p.stock_total;
                const minStock = p.stock_minimo || 0;
                if (activeFilters.status === 'in_stock') {
                    matchesStatus = stock > minStock;
                } else if (activeFilters.status === 'low_stock') {
                    matchesStatus = stock > 0 && stock <= minStock;
                } else if (activeFilters.status === 'out_of_stock') {
                    matchesStatus = stock <= 0;
                }
            }

            const matchesCategory = activeFilters.category.length === 0 || activeFilters.category.includes(p.categoria_nombre || 'Sin Categoría');
            const matchesBrand = activeFilters.brand.length === 0 || activeFilters.brand.includes(p.marca || 'Sin Marca');

            return matchesSearch && matchesStatus && matchesCategory && matchesBrand;
        });
    }, [products, searchTerm, activeFilters]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setActiveFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleMultiFilterChange = (type, value) => {
        setActiveFilters(prev => {
            const currentValues = prev[type];
            const newValues = currentValues.includes(value)
                ? currentValues.filter(v => v !== value)
                : [...currentValues, value];
            return { ...prev, [type]: newValues };
        });
    };

    const handleClearFilters = () => {
        setActiveFilters({ status: 'all', category: [], brand: [] });
        setSearchTerm('');
        if (isMobileFilterOpen) setIsMobileFilterOpen(false);
    };

    const handleToggleRow = async (productId) => {
        const newExpandedId = expandedRowId === productId ? null : productId;
        setExpandedRowId(newExpandedId);

        if (newExpandedId && !detailedStock[newExpandedId]) {
            try {
                const { data, error } = await supabase.rpc('get_product_details', { p_producto_id: newExpandedId });
                if (error) throw error;
                setDetailedStock(prev => ({ ...prev, [newExpandedId]: data.inventory }));
            } catch (err) {
                addToast({ message: 'Error al cargar detalle de sucursales.', type: 'error' });
            }
        }
    };
    
    const kpis = useMemo(() => {
        const inventoryValue = products.reduce((sum, p) => sum + (Number(p.stock_total || 0) * Number(p.precio_compra || 0)), 0);
        const lowStockCount = products.filter(p => p.stock_total > 0 && p.stock_total <= (p.stock_minimo || 0)).length;
        const outOfStockCount = products.filter(p => p.stock_total <= 0).length;
        return { inventoryValue, lowStockCount, outOfStockCount, totalProducts: products.length };
    }, [products]);

    const breadcrumbs = [ { name: 'Inventarios', href: '#/inventarios' } ];
    const focusClasses = "focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25";

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Inventarios"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <h1 class="text-2xl font-semibold text-gray-900">Gestión de Inventarios</h1>
            <p class="mt-1 text-sm text-gray-600">Supervisa el stock de tus productos en todas las sucursales en tiempo real.</p>
            
             <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
                <${KPI_Card} title="Valor del Inventario (Costo)" value=${`Bs ${kpis.inventoryValue.toFixed(2)}`} icon=${ICONS.paid} color="primary" />
                <${KPI_Card} title="Productos Totales" value=${kpis.totalProducts} icon=${ICONS.products} />
                <${KPI_Card} title="Productos con Bajo Stock" value=${kpis.lowStockCount} icon=${ICONS.warning} color="amber" />
                <${KPI_Card} title="Productos Agotados" value=${kpis.outOfStockCount} icon=${ICONS.error} color="red" />
            </div>

            <div class="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div class="hidden lg:block lg:col-span-1">
                    <div class="bg-white rounded-lg shadow-sm border h-full sticky top-6">
                       <${FilterPanel} counts=${filterCounts} activeFilters=${activeFilters} onFilterChange=${handleMultiFilterChange} onClearFilters=${handleClearFilters} />
                    </div>
                </div>

                <div class="lg:col-span-3">
                    <div class="p-4 bg-gray-50 rounded-lg border">
                        <div class="space-y-4">
                            <div class="relative">
                                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">${ICONS.search}</div>
                                <input type="text" placeholder="Buscar por nombre o modelo..." value=${searchTerm} onInput=${e => setSearchTerm(e.target.value)} class="block w-full rounded-md border-gray-300 bg-white p-2 pl-10 pr-10 text-gray-900 placeholder-gray-500 shadow-sm focus:outline-none ${focusClasses}" />
                                ${searchTerm && html`
                                    <button onClick=${() => setSearchTerm('')} class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                                        ${ICONS.close}
                                    </button>
                                `}
                            </div>
                            <div class="flex items-end gap-4">
                                <div class="flex-grow">
                                    <label for="status" class="block text-sm font-medium text-gray-700">Estado</label>
                                    <select id="status" name="status" value=${activeFilters.status} onChange=${handleFilterChange} class="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 pl-3 pr-10 text-base text-gray-900 focus:outline-none ${focusClasses}">
                                        <option value="all">Todos los Estados</option>
                                        <option value="in_stock">En Stock</option>
                                        <option value="low_stock">Bajo Stock</option>
                                        <option value="out_of_stock">Agotado</option>
                                    </select>
                                </div>
                                <div class="lg:hidden">
                                    <button onClick=${() => setIsMobileFilterOpen(true)} class="relative flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                                        ${ICONS.settings}
                                        <span>Filtros</span>
                                        ${(activeFilters.category.length > 0 || activeFilters.brand.length > 0) && html`
                                            <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">${activeFilters.category.length + activeFilters.brand.length}</span>
                                        `}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mt-6">
                        <p class="text-sm text-gray-600 mb-2">Mostrando ${filteredProducts.length} de ${products.length} productos</p>
                        
                        ${filteredProducts.length === 0 ? html`
                             <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-200 bg-white">
                                <h3 class="text-lg font-medium text-gray-900">No se encontraron productos</h3>
                                <p class="mt-1 text-sm text-gray-500">Intenta con otro término de búsqueda o ajusta los filtros.</p>
                            </div>
                        ` : html `
                            {/* Mobile/Tablet Card View */}
                            <div class="space-y-4 lg:hidden">
                                ${filteredProducts.map(p => html`
                                    <div key=${p.id} class="bg-white p-4 rounded-lg shadow-sm border">
                                        <div onClick=${() => navigate(`/productos/${p.id}`)} class="flex items-start gap-4 cursor-pointer">
                                            <img class="h-16 w-16 rounded-md object-cover flex-shrink-0 bg-gray-100" src=${p.imagen_principal || NO_IMAGE_ICON_URL} alt=${p.nombre} />
                                            <div class="flex-grow min-w-0">
                                                <p class="font-semibold text-gray-800 truncate">${p.nombre}</p>
                                                <p class="text-xs text-gray-500">Modelo: ${p.modelo || 'N/A'}</p>
                                                <div class="mt-2 flex justify-between items-center">
                                                    <${StockStatusPill} stock=${p.stock_total} minStock=${p.stock_minimo || 0} />
                                                    <span class="text-xs text-gray-500">Costo: <span class="font-medium text-gray-700">Bs ${Number(p.precio_compra || 0).toFixed(2)}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-center">
                                            <div>
                                                <p class="text-xs text-gray-500">Stock Total</p>
                                                <p class="text-xl font-bold text-gray-900">${p.stock_total}</p>
                                            </div>
                                            <div>
                                                <p class="text-xs text-gray-500">Valor Inventario</p>
                                                <p class="text-xl font-bold text-primary">Bs ${(p.stock_total * (p.precio_compra || 0)).toFixed(2)}</p>
                                            </div>
                                        </div>
                                        ${expandedRowId === p.id && html`
                                            <div class="mt-3 pt-3 border-t animate-fade-in-down">
                                                <h4 class="text-sm font-semibold text-gray-700 mb-2">Desglose por Sucursal</h4>
                                                ${detailedStock[p.id] ? html`
                                                    <div class="grid grid-cols-2 gap-2">
                                                        ${detailedStock[p.id].map(s => html`
                                                            <div class="flex items-center justify-between gap-2 p-2 bg-slate-50 border rounded-md text-sm">
                                                                <span class="text-gray-600 truncate">${s.sucursal_nombre}</span>
                                                                <span class="font-bold text-gray-800">${s.cantidad}</span>
                                                            </div>
                                                        `)}
                                                    </div>
                                                ` : html`<p class="text-sm text-gray-500">Cargando...</p>`}
                                            </div>
                                        `}
                                        <div class="mt-3 text-center">
                                            <button onClick=${(e) => { e.stopPropagation(); handleToggleRow(p.id); }} class="w-full text-xs text-primary font-semibold hover:underline">
                                                ${expandedRowId === p.id ? 'Ocultar desglose' : 'Mostrar desglose por sucursal'}
                                            </button>
                                        </div>
                                    </div>
                                `)}
                            </div>

                            {/* Desktop Table View */}
                            <div class="hidden lg:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                                <table class="min-w-full divide-y divide-gray-300">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <th class="w-12"></th>
                                            <th class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Producto</th>
                                            <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Costo Unitario</th>
                                            <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Stock Total</th>
                                            <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Valor Inventario</th>
                                            <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                                            <th class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Ver</span></th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-200 bg-white">
                                    ${filteredProducts.map(p => html`
                                            <tr key=${p.id} class=${expandedRowId === p.id ? 'bg-blue-50' : ''}>
                                                <td class="py-2 pl-2">
                                                    <button onClick=${() => handleToggleRow(p.id)} class="p-2 rounded-full hover:bg-gray-200 text-gray-500">
                                                        ${expandedRowId === p.id ? ICONS.chevron_up : ICONS.chevron_down}
                                                    </button>
                                                </td>
                                                <td class="py-4 pl-4 pr-3 text-sm sm:pl-6">
                                                    <div class="flex items-center"><div class="h-10 w-10 flex-shrink-0"><img class="h-10 w-10 rounded-md object-cover" src=${p.imagen_principal || NO_IMAGE_ICON_URL} alt=${p.nombre} /></div><div class="ml-4 min-w-0"><div class="font-medium text-gray-900 truncate" title=${p.nombre}>${p.nombre}</div><div class="text-gray-500 truncate" title=${p.modelo || 'N/A'}>Modelo: ${p.modelo || 'N/A'}</div></div></div>
                                                </td>
                                                <td class="px-3 py-4 text-sm text-gray-700">Bs ${Number(p.precio_compra || 0).toFixed(2)}</td>
                                                <td class="px-3 py-4 text-sm font-bold text-gray-900">${p.stock_total}</td>
                                                <td class="px-3 py-4 text-sm font-semibold text-gray-800">Bs ${(p.stock_total * (p.precio_compra || 0)).toFixed(2)}</td>
                                                <td class="px-3 py-4 text-sm text-gray-500"><${StockStatusPill} stock=${p.stock_total} minStock=${p.stock_minimo || 0} /></td>
                                                <td class="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                    <a href=${`#/productos/${p.id}`} onClick=${(e) => { e.preventDefault(); navigate(`/productos/${p.id}`); }} class="text-primary hover:text-primary-dark">Ver Detalles</a>
                                                </td>
                                            </tr>
                                            ${expandedRowId === p.id && html`
                                                <tr class="bg-slate-50">
                                                    <td colspan="7" class="p-0">
                                                        <div class="p-4 animate-fade-in-down">
                                                            <h4 class="text-sm font-semibold text-gray-700 mb-2 ml-2">Desglose por Sucursal</h4>
                                                            ${detailedStock[p.id] ? html`
                                                                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                                    ${detailedStock[p.id].map(s => html`
                                                                        <div class="flex items-center gap-2 p-2 bg-white border rounded-md">
                                                                            <span class="text-slate-400">${ICONS.storefront}</span>
                                                                            <span class="flex-grow text-sm text-gray-600 truncate">${s.sucursal_nombre}</span>
                                                                            <span class="font-bold text-sm text-gray-800">${s.cantidad}</span>
                                                                        </div>
                                                                    `)}
                                                                </div>
                                                            ` : html`
                                                                <p class="text-sm text-gray-500">Cargando...</p>
                                                            `}
                                                        </div>
                                                    </td>
                                                </tr>
                                            `}
                                    `)}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    </div>
                </div>
            </div>

            <div class=${`fixed inset-0 z-40 flex lg:hidden transition-opacity duration-300 ease-linear ${isMobileFilterOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} role="dialog" aria-modal="true">
                <div class="fixed inset-0 bg-gray-600 bg-opacity-75" aria-hidden="true" onClick=${() => setIsMobileFilterOpen(false)}></div>
                <div class=${`relative flex w-full max-w-xs flex-1 flex-col bg-white shadow-xl overflow-y-auto transform transition duration-300 ease-in-out ${isMobileFilterOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div class="absolute top-0 right-0 -mr-12 pt-2">
                        <button type="button" class="ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" onClick=${() => setIsMobileFilterOpen(false)}>
                            <span class="sr-only">Cerrar filtros</span>
                            ${ICONS.close}
                        </button>
                    </div>
                    <${FilterPanel} counts=${filterCounts} activeFilters=${activeFilters} onFilterChange=${handleMultiFilterChange} onClearFilters=${handleClearFilters} />
                </div>
            </div>
        <//>
    `;
}