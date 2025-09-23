/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { FloatingActionButton } from '../../components/FloatingActionButton.js';
import { ProductFormModal } from '../../components/modals/ProductFormModal.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';

const StockPill = ({ stock }) => {
    let pillClass, text;
    if (stock > 10) {
        pillClass = 'bg-green-100 text-green-800';
        text = 'En Stock';
    } else if (stock > 0) {
        pillClass = 'bg-yellow-100 text-yellow-800';
        text = 'Stock Bajo';
    } else {
        pillClass = 'bg-red-100 text-red-800';
        text = 'Agotado';
    }
    return html`<span class="${pillClass} inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">${text} (${stock})</span>`;
};

const StockCheckModal = ({ isOpen, onClose, stockDetails }) => {
    if (!stockDetails) return null;

    const { details, inventory } = stockDetails;

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${onClose}
            title="Consulta de Stock"
            confirmText="Cerrar"
            icon=${ICONS.inventory}
            maxWidthClass="max-w-md"
        >
            <div class="space-y-4 text-sm text-gray-600">
                <p>Mostrando stock para: <span class="font-bold text-gray-800">${details.nombre}</span></p>
                <ul class="max-h-64 overflow-y-auto divide-y divide-gray-200 border-t border-b -mx-6 px-6">
                    ${(inventory && inventory.length > 0) ? inventory.map(stockInfo => {
                        return html`
                            <li class="flex justify-between items-center py-3">
                                <span class="font-medium text-gray-800">${stockInfo.sucursal_nombre}</span>
                                <span class="text-lg font-bold ${stockInfo.cantidad > 0 ? 'text-green-600' : 'text-red-600'}">${stockInfo.cantidad}</span>
                            </li>
                        `;
                    }) : html`<li class="py-3 text-center text-gray-500">No hay información de stock por sucursal.</li>`}
                </ul>
            </div>
        <//>
    `;
};


const ProductCard = ({ product, navigate, onEdit, onDelete, onCheckStock }) => {
    const hasStock = product.stock_total > 0;
    const handleClick = (e) => {
        e.stopPropagation();
        if (hasStock) {
            navigate(`/productos/${product.id}`);
        } else {
            onCheckStock(product);
        }
    };

    return html`
        <div class="group bg-white rounded-lg shadow-md border overflow-hidden flex flex-col transition-shadow hover:shadow-xl">
            <div onClick=${handleClick} class="relative pt-[100%] bg-gray-100 cursor-pointer">
                <img 
                    src=${product.imagen_principal || 'https://picsum.photos/300/300'} 
                    alt=${product.nombre} 
                    class="absolute top-0 left-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                />
                 ${!hasStock && html`<div class="absolute inset-0 bg-white/60 flex items-center justify-center pointer-events-none"><span class="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">AGOTADO</span></div>`}
            </div>
            <div class="p-4 flex-grow flex flex-col">
                <h3 class="font-bold text-gray-800 truncate group-hover:text-primary transition-colors cursor-pointer" onClick=${handleClick}>${product.nombre}</h3>
                <p class="text-sm text-gray-500">${product.marca || ''}</p>
                <div class="mt-4 flex-grow flex items-end justify-between">
                    <p class="text-lg font-semibold text-gray-900">Bs ${Number(product.precio_base).toFixed(2)}</p>
                    <${StockPill} stock=${product.stock_total} />
                </div>
            </div>
            <div class="bg-gray-50 px-4 py-2 border-t flex justify-end items-center gap-2">
                <button onClick=${() => onEdit(product)} title="Editar" class="text-gray-400 hover:text-primary p-2 rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                <button onClick=${() => onDelete(product)} title="Eliminar" class="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-gray-100">${ICONS.delete}</button>
            </div>
        </div>
    `;
}

const ProductTable = ({ products, navigate, onEdit, onDelete, onCheckStock }) => {
    const handleRowClick = (product) => {
        if (product.stock_total > 0) {
            navigate(`/productos/${product.id}`);
        } else {
            onCheckStock(product);
        }
    };
    
    return html`
    <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table class="min-w-full divide-y divide-gray-300">
            <thead class="bg-gray-50">
                <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Producto</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">SKU</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Categoría</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Precio Base</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Stock Total</th>
                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Acciones</span></th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
                ${products.map(p => html`
                    <tr key=${p.id} onClick=${() => handleRowClick(p)} class="group hover:bg-gray-50 cursor-pointer">
                        <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                            <div class="flex items-center">
                                <div class="h-10 w-10 flex-shrink-0">
                                    <img class="h-10 w-10 rounded-md object-cover" src=${p.imagen_principal || 'https://picsum.photos/100/100'} alt="" />
                                </div>
                                <div class="ml-4">
                                    <div class="font-medium text-gray-900 group-hover:text-primary">${p.nombre}</div>
                                    <div class="text-gray-500">${p.marca}</div>
                                </div>
                            </div>
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${p.sku}</td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${p.categoria_nombre}</td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-800">Bs ${Number(p.precio_base).toFixed(2)}</td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                             <${StockPill} stock=${p.stock_total} />
                        </td>
                        <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <div class="flex items-center justify-end space-x-2">
                                <button onClick=${(e) => { e.stopPropagation(); onEdit(p); }} title="Editar" class="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                                <button onClick=${(e) => { e.stopPropagation(); onDelete(p); }} title="Eliminar" class="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-gray-100">${ICONS.delete}</button>
                            </div>
                        </td>
                    </tr>
                `)}
            </tbody>
        </table>
    </div>
`};


export function ProductosPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    const [data, setData] = useState({ products: [], kpis: { total_products: 0, total_stock_items: 0, products_without_stock: 0 } });
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState(null);
    const [productToDelete, setProductToDelete] = useState(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isFilterSidebarOpen, setFilterSidebarOpen] = useState(false);
    const [isStockModalOpen, setStockModalOpen] = useState(false);
    const [stockDetailsForModal, setStockDetailsForModal] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [appliedFilters, setAppliedFilters] = useState({ category: '', brand: '' });
    const [tempFilters, setTempFilters] = useState(appliedFilters);
    
    // State for scalable filters
    const [categorySearchTerm, setCategorySearchTerm] = useState('');
    const [brandSearchTerm, setBrandSearchTerm] = useState('');
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [showAllBrands, setShowAllBrands] = useState(false);


    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_company_products_with_stock');
            if (error) throw error;
            setData(data);
        } catch (err) {
            console.error("Error fetching products:", err);
            addToast({ message: `Error al cargar productos: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    const handleAddProduct = () => {
        setProductToEdit(null);
        setFormModalOpen(true);
    };
    
    const handleEditProduct = (product) => {
        setProductToEdit(product);
        setFormModalOpen(true);
    };

    const handleDeleteProduct = (product) => {
        setProductToDelete(product);
        setDeleteModalOpen(true);
    };
    
    const handleConfirmDelete = async () => {
        if (!productToDelete) return;
        startLoading();
        try {
            const { error } = await supabase.rpc('delete_product', { p_producto_id: productToDelete.id });
            if (error) throw error;
            addToast({ message: `Producto "${productToDelete.nombre}" eliminado.`, type: 'success' });
            fetchData();
        } catch(err) {
            addToast({ message: `Error al eliminar: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
            setDeleteModalOpen(false);
        }
    };

    const handleSaveProduct = (action) => {
        setFormModalOpen(false);
        addToast({ message: `Producto ${action === 'edit' ? 'actualizado' : 'creado'} con éxito.`, type: 'success' });
        fetchData();
    };

    const handleCheckStock = async (product) => {
        startLoading();
        try {
            const { data: details, error } = await supabase.rpc('get_product_details', { p_producto_id: product.id });
            if (error) throw error;
            setStockDetailsForModal(details);
            setStockModalOpen(true);
        } catch (err) {
            addToast({ message: `Error al consultar stock: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    const { categoryOptions, brandOptions } = useMemo(() => {
        if (!data.products) return { categoryOptions: [], brandOptions: [] };
        
        const categories = {};
        const brands = {};
        for (const product of data.products) {
            if (product.categoria_nombre) {
                categories[product.categoria_nombre] = (categories[product.categoria_nombre] || 0) + 1;
            }
            if (product.marca) {
                brands[product.marca] = (brands[product.marca] || 0) + 1;
            }
        }
        return {
            categoryOptions: Object.entries(categories).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
            brandOptions: Object.entries(brands).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
        };
    }, [data.products]);

    const filteredProducts = useMemo(() => {
        if (!data.products) return [];
        return data.products.filter(product => {
            const searchTermLower = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' ||
                product.nombre?.toLowerCase().includes(searchTermLower) ||
                product.sku?.toLowerCase().includes(searchTermLower) ||
                product.marca?.toLowerCase().includes(searchTermLower) ||
                product.modelo?.toLowerCase().includes(searchTermLower);

            const matchesCategory = appliedFilters.category === '' || product.categoria_nombre === appliedFilters.category;
            const matchesBrand = appliedFilters.brand === '' || product.marca === appliedFilters.brand;

            return matchesSearch && matchesCategory && matchesBrand;
        });
    }, [data.products, searchTerm, appliedFilters]);
    
    const handleOpenFilterSidebar = () => {
        setTempFilters(appliedFilters);
        // Reset search and expansion states when opening
        setCategorySearchTerm('');
        setBrandSearchTerm('');
        setShowAllCategories(false);
        setShowAllBrands(false);
        setFilterSidebarOpen(true);
    };

    const handleApplyFilters = () => {
        setAppliedFilters(tempFilters);
        setFilterSidebarOpen(false);
    };

    const handleClearFilters = () => {
        const cleared = { category: '', brand: '' };
        setTempFilters(cleared);
        setAppliedFilters(cleared);
        setFilterSidebarOpen(false);
    };


    const breadcrumbs = [ { name: 'Productos', href: '#/productos' } ];
    const kpis = data.kpis || { total_products: 0, total_stock_items: 0, products_without_stock: 0 };
    const activeFilterCount = (appliedFilters.category ? 1 : 0) + (appliedFilters.brand ? 1 : 0);
    
    const filterSidebarContent = useMemo(() => {
        const INITIAL_ITEMS_LIMIT = 7;

        const filteredCategoryOptions = categoryOptions.filter(cat =>
            cat.name.toLowerCase().includes(categorySearchTerm.toLowerCase())
        );
        const filteredBrandOptions = brandOptions.filter(brand =>
            brand.name.toLowerCase().includes(brandSearchTerm.toLowerCase())
        );

        const displayedCategories = showAllCategories ? filteredCategoryOptions : filteredCategoryOptions.slice(0, INITIAL_ITEMS_LIMIT);
        const displayedBrands = showAllBrands ? filteredBrandOptions : filteredBrandOptions.slice(0, INITIAL_ITEMS_LIMIT);
        
        return html`
            <div class="flex h-full flex-col bg-white">
                <div class="flex items-center justify-between p-4 border-b">
                    <h2 class="text-lg font-medium text-gray-900">Filtros</h2>
                    <button onClick=${() => setFilterSidebarOpen(false)} class="p-2 -m-2 rounded-full text-gray-400 hover:bg-gray-100">${ICONS.close}</button>
                </div>
                <div class="flex-1 overflow-y-auto p-4 space-y-6">
                     <div>
                        <h3 class="text-sm font-semibold text-gray-800 mb-2">Categoría</h3>
                        <div class="relative mb-2">
                             <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><span class="material-symbols-outlined text-gray-400 text-base">search</span></div>
                            <input type="text" value=${categorySearchTerm} onInput=${(e) => setCategorySearchTerm(e.target.value)} class="block w-full rounded-md border-gray-300 pl-9 p-2 bg-gray-100 text-gray-900 placeholder-gray-500 focus:border-primary focus:ring-primary sm:text-sm" placeholder="Buscar categoría..." />
                        </div>
                        <ul class="space-y-1 max-h-60 overflow-y-auto pr-2">
                            <li><button onClick=${() => setTempFilters(f => ({ ...f, category: '' }))} class="w-full text-left p-2 rounded-md transition-colors ${!tempFilters.category ? 'bg-primary-light text-primary-dark font-semibold' : 'hover:bg-gray-100 text-gray-900'}">Todas</button></li>
                            ${displayedCategories.map(cat => html`
                                <li><button onClick=${() => setTempFilters(f => ({ ...f, category: cat.name }))} class="w-full flex items-center text-left p-2 rounded-md transition-colors ${tempFilters.category === cat.name ? 'bg-primary-light text-primary-dark font-semibold' : 'hover:bg-gray-100 text-gray-900'}"><span class="flex-1 min-w-0 pr-2 truncate">${cat.name}</span><span class="ml-auto flex-shrink-0 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">${cat.count}</span></button></li>
                            `)}
                        </ul>
                        ${filteredCategoryOptions.length > INITIAL_ITEMS_LIMIT && html`
                            <div class="mt-2"><button onClick=${() => setShowAllCategories(prev => !prev)} class="w-full text-left p-2 rounded-md text-sm font-medium text-primary hover:bg-primary-light">${showAllCategories ? 'Ver menos...' : `Ver ${filteredCategoryOptions.length - INITIAL_ITEMS_LIMIT} más...`}</button></div>
                        `}
                    </div>
                     <div>
                        <h3 class="text-sm font-semibold text-gray-800 mb-2">Marca</h3>
                         <div class="relative mb-2">
                             <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><span class="material-symbols-outlined text-gray-400 text-base">search</span></div>
                            <input type="text" value=${brandSearchTerm} onInput=${(e) => setBrandSearchTerm(e.target.value)} class="block w-full rounded-md border-gray-300 pl-9 p-2 bg-gray-100 text-gray-900 placeholder-gray-500 focus:border-primary focus:ring-primary sm:text-sm" placeholder="Buscar marca..." />
                        </div>
                        <ul class="space-y-1 max-h-60 overflow-y-auto pr-2">
                            <li><button onClick=${() => setTempFilters(f => ({ ...f, brand: '' }))} class="w-full text-left p-2 rounded-md transition-colors ${!tempFilters.brand ? 'bg-primary-light text-primary-dark font-semibold' : 'hover:bg-gray-100 text-gray-900'}">Todas</button></li>
                            ${displayedBrands.map(brand => html`
                                <li><button onClick=${() => setTempFilters(f => ({ ...f, brand: brand.name }))} class="w-full flex items-center text-left p-2 rounded-md transition-colors ${tempFilters.brand === brand.name ? 'bg-primary-light text-primary-dark font-semibold' : 'hover:bg-gray-100 text-gray-900'}"><span class="flex-1 min-w-0 pr-2 truncate">${brand.name}</span><span class="ml-auto flex-shrink-0 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">${brand.count}</span></button></li>
                            `)}
                        </ul>
                         ${filteredBrandOptions.length > INITIAL_ITEMS_LIMIT && html`
                            <div class="mt-2"><button onClick=${() => setShowAllBrands(prev => !prev)} class="w-full text-left p-2 rounded-md text-sm font-medium text-primary hover:bg-primary-light">${showAllBrands ? 'Ver menos...' : `Ver ${filteredBrandOptions.length - INITIAL_ITEMS_LIMIT} más...`}</button></div>
                        `}
                    </div>
                </div>
                <div class="p-4 bg-gray-50 border-t flex justify-between items-center">
                     <button onClick=${handleClearFilters} class="text-sm font-medium text-gray-600 hover:text-primary">Limpiar Filtros</button>
                    <button onClick=${handleApplyFilters} class="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">Aplicar</button>
                </div>
            </div>
        `
    }, [categoryOptions, brandOptions, tempFilters, categorySearchTerm, brandSearchTerm, showAllCategories, showAllBrands]);

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Productos"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Catálogo de Productos</h1>
                    <p class="mt-1 text-sm text-gray-600">Gestiona todos los artículos de tu empresa. Aquí se centraliza la información de cada producto.</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
                 <${KPI_Card} title="Productos Totales" value=${kpis.total_products || 0} icon=${ICONS.products} color="primary" />
                 <${KPI_Card} title="Unidades en Stock" value=${kpis.total_stock_items || 0} icon=${ICONS.inventory} color="green" />
                 <${KPI_Card} title="Productos Agotados" value=${kpis.products_without_stock || 0} icon=${ICONS.warning} color="red" />
            </div>

            <div class="mt-8 mb-6 p-4 bg-white rounded-lg shadow-sm border">
                 <div class="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                    <div class="flex-grow">
                        <label for="search" class="block text-sm font-medium text-gray-700">Buscar</label>
                        <div class="mt-1 relative rounded-md shadow-sm">
                            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <span class="material-symbols-outlined text-gray-400">search</span>
                            </div>
                            <input
                                type="text"
                                id="search"
                                value=${searchTerm}
                                onInput=${(e) => setSearchTerm(e.target.value)}
                                class="block w-full rounded-md border-0 pl-10 p-2 bg-white text-gray-900 placeholder-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm transition-colors duration-200"
                                placeholder="Nombre, SKU, marca, modelo..."
                            />
                        </div>
                    </div>
                     <div class="flex items-center gap-2 flex-shrink-0">
                        <button onClick=${handleOpenFilterSidebar} class="relative w-full sm:w-auto h-full flex-grow items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                            <span class="material-symbols-outlined text-base -ml-1 mr-1">filter_list</span>
                            Filtros
                            ${activeFilterCount > 0 && html`
                                <span class="absolute -top-2 -right-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs font-bold">${activeFilterCount}</span>
                            `}
                        </button>
                         <button 
                            onClick=${handleAddProduct}
                            class="w-full sm:w-auto h-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover flex"
                        >
                            ${ICONS.add} 
                            <span class="hidden sm:inline">Añadir Producto</span>
                        </button>
                    </div>
                </div>
            </div>

            <div>
                ${filteredProducts.length === 0 ? html`
                     <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white">
                        <div class="text-6xl text-gray-300">${ICONS.products}</div>
                        <h3 class="mt-2 text-lg font-medium text-gray-900">No se encontraron productos</h3>
                        <p class="mt-1 text-sm text-gray-500">${searchTerm || appliedFilters.category || appliedFilters.brand ? 'Intenta ajustar tu búsqueda o filtros.' : 'Comienza añadiendo tu primer producto.'}</p>
                    </div>
                ` : html`
                    <!-- Mobile Card View -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 xl:hidden">
                        ${filteredProducts.map(p => html`<${ProductCard} product=${p} navigate=${navigate} onEdit=${handleEditProduct} onDelete=${handleDeleteProduct} onCheckStock=${handleCheckStock} />`)}
                    </div>
                    <!-- Desktop Table View -->
                    <div class="hidden xl:block">
                        <${ProductTable} products=${filteredProducts} navigate=${navigate} onEdit=${handleEditProduct} onDelete=${handleDeleteProduct} onCheckStock=${handleCheckStock} />
                    </div>
                `}
            </div>
            
            <div class="xl:hidden">
                <${FloatingActionButton} onClick=${handleAddProduct} label="Añadir Producto" />
            </div>

            <${ProductFormModal} 
                isOpen=${isFormModalOpen}
                onClose=${() => setFormModalOpen(false)}
                onSave=${handleSaveProduct}
                user=${user}
                productToEdit=${productToEdit}
            />

            <${ConfirmationModal}
                isOpen=${isDeleteModalOpen}
                onClose=${() => setDeleteModalOpen(false)}
                onConfirm=${handleConfirmDelete}
                title="Confirmar Eliminación"
                confirmText="Sí, eliminar"
                confirmVariant="danger"
                icon=${ICONS.warning_amber}
            >
                <p class="text-sm text-gray-600">¿Estás seguro de que quieres eliminar el producto <span class="font-bold text-gray-800">${productToDelete?.nombre}</span>? Esta acción no se puede deshacer.</p>
            <//>

             <${StockCheckModal} 
                isOpen=${isStockModalOpen}
                onClose=${() => setStockModalOpen(false)}
                stockDetails=${stockDetailsForModal}
            />
            
            <!-- Filter Sidebar (Replicated from DashboardLayout) -->
             <div class=${`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ease-linear ${isFilterSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} role="dialog" aria-modal="true">
                <div class=${`fixed inset-0 bg-gray-600 bg-opacity-75`} aria-hidden="true" onClick=${() => setFilterSidebarOpen(false)}></div>
                
                <div class=${`relative flex w-full max-w-sm flex-1 flex-col transform transition duration-300 ease-in-out ${isFilterSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                   <div class="absolute top-0 left-0 -ml-12 pt-2">
                        <button type="button" class="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" onClick=${() => setFilterSidebarOpen(false)}>
                            <span class="sr-only">Close sidebar</span>
                            <div class="text-white">${ICONS.close}</div>
                        </button>
                    </div>
                    ${filterSidebarContent}
                </div>
            </div>

        <//>
    `;
}