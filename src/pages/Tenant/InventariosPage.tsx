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
import { FilterBar, AdvancedFilterPanel } from '../../components/shared/FilterComponents.js';
import { useRealtimeListener } from '../../hooks/useRealtime.js';

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

const initialFilters = {
    searchTerm: '',
    status: 'all',
    category_ids: [],
    brand_names: [],
};

const inventoryStatusOptions = [
    { value: 'all', label: 'Todos los Estados' },
    { value: 'in_stock', label: 'En Stock' },
    { value: 'low_stock', label: 'Bajo Stock' },
    { value: 'out_of_stock', label: 'Agotado' }
];


export function InventariosPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();

    const [products, setProducts] = useState([]);
    const [filters, setFilters] = useState(initialFilters);
    const [filterOptions, setFilterOptions] = useState({ categories: [], brands: [] });
    const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
    const [expandedRowId, setExpandedRowId] = useState(null);
    const [detailedStock, setDetailedStock] = useState({});

    const fetchData = useCallback(async () => {
        startLoading();
        try {
            const [productsRes, optionsRes] = await Promise.all([
                supabase.rpc('get_company_products_with_stock_and_cost'),
                supabase.rpc('get_inventory_filter_data')
            ]);
            
            if (productsRes.error) throw productsRes.error;
            if (optionsRes.error) throw optionsRes.error;
            
            setProducts(productsRes.data || []);
            setFilterOptions(optionsRes.data || { categories: [], brands: [] });

        } catch (err) {
            addToast({ message: `Error al cargar inventario: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    }, [addToast, startLoading, stopLoading]);

    useEffect(() => {
        fetchData();
    }, []);
    
    useRealtimeListener(fetchData);
    
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const searchTermLower = filters.searchTerm.toLowerCase();
            const matchesSearch = filters.searchTerm === '' ||
                p.nombre?.toLowerCase().includes(searchTermLower) ||
                p.modelo?.toLowerCase().includes(searchTermLower) ||
                p.sku?.toLowerCase().includes(searchTermLower);

            let matchesStatus = true;
            if (filters.status !== 'all') {
                const stock = p.stock_total;
                const minStock = p.stock_minimo || 0;
                if (filters.status === 'in_stock') {
                    matchesStatus = stock > minStock;
                } else if (filters.status === 'low_stock') {
                    matchesStatus = stock > 0 && stock <= minStock;
                } else if (filters.status === 'out_of_stock') {
                    matchesStatus = stock <= 0;
                }
            }

            const matchesCategory = filters.category_ids.length === 0 || filters.category_ids.includes(p.categoria_id);
            const matchesBrand = filters.brand_names.length === 0 || filters.brand_names.includes(p.marca);

            return matchesSearch && matchesStatus && matchesCategory && matchesBrand;
        });
    }, [products, filters]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleClearFilters = () => {
        setFilters(initialFilters);
        setIsAdvancedSearchOpen(false);
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

            <div class="mt-8">
                <${FilterBar} 
                    filters=${filters} 
                    onFilterChange=${handleFilterChange} 
                    onClear=${handleClearFilters} 
                    onToggleAdvanced=${() => setIsAdvancedSearchOpen(prev => !prev)} 
                    isAdvancedOpen=${isAdvancedSearchOpen}
                    statusOptions=${inventoryStatusOptions}
                />
                <${AdvancedFilterPanel} 
                    isOpen=${isAdvancedSearchOpen} 
                    filters=${filters} 
                    onFilterChange=${handleFilterChange} 
                    filterOptions=${filterOptions} 
                />
                
                <div class="mt-6">
                    <p class="text-sm text-gray-600 mb-2">Mostrando ${filteredProducts.length} de ${products.length} productos</p>
                    
                    ${filteredProducts.length === 0 ? html`
                         <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-200 bg-white">
                            <h3 class="text-lg font-medium text-gray-900">No se encontraron productos</h3>
                            <p class="mt-1 text-sm text-gray-500">Intenta con otro término de búsqueda o ajusta los filtros.</p>
                        </div>
                    ` : html `
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
        <//>
    `;
}