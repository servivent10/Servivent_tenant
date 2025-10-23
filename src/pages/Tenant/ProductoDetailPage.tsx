/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { Tabs } from '../../components/Tabs.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { Spinner } from '../../components/Spinner.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';
import { useRealtimeListener } from '../../hooks/useRealtime.js';
import { InventoryAdjustModal } from '../../components/modals/InventoryAdjustModal.js';
import { useProductForm } from '../../contexts/StatePersistence.js';
import { ProductFormModal } from '../../components/modals/ProductFormModal.js';

const InventoryBreakdown = ({ inventory = [], allBranches = [], user, onAdjust }) => {
    // Determine which branches are visible based on the user's role
    const visibleBranches = useMemo(() => {
        if (!allBranches) return [];
        if (user.role === 'Propietario') {
            return allBranches;
        }
        // Admins and Employees only see their own branch
        return allBranches.filter(branch => branch.nombre === user.sucursal);
    }, [allBranches, user]);

    // Create a map for quick lookup of existing inventory
    const inventoryMap = useMemo(() => new Map(inventory.map(item => [item.sucursal_id, item])), [inventory]);

    if (visibleBranches.length === 0) {
        return html`
            <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white mt-6">
                <div class="text-6xl text-gray-300">${ICONS.storefront}</div>
                <h3 class="mt-2 text-lg font-medium text-gray-900">No hay sucursales para mostrar</h3>
                <p class="mt-1 text-sm text-gray-500">
                    ${user.role === 'Propietario' ? 'Registra tu primera sucursal para poder gestionar el inventario.' : 'No estás asignado a una sucursal.'}
                </p>
            </div>
        `;
    }

    return html`
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            ${visibleBranches.map(branch => {
                const item = inventoryMap.get(branch.id);
                const cantidad = item ? Number(item.cantidad) : 0;
                const stock_minimo = item ? Number(item.stock_minimo) : 0;
                const canAdjust = user.role !== 'Empleado';

                return html`
                    <div class="bg-white p-4 rounded-lg shadow-sm border flex flex-col">
                        <div class="flex items-center gap-3">
                             <div class="flex-shrink-0 h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 text-2xl">
                                ${ICONS.storefront}
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-800">${branch.nombre}</h4>
                                <p class="text-xs text-gray-500">Stock Mínimo: ${stock_minimo}</p>
                            </div>
                        </div>
                        <div class="mt-3 text-center flex-grow">
                            <p class="text-sm text-gray-500">Stock Actual</p>
                            <p class="text-5xl font-bold ${cantidad <= stock_minimo && cantidad > 0 ? 'text-amber-600' : (cantidad <= 0 ? 'text-red-600' : 'text-gray-900')}">
                                ${cantidad}
                            </p>
                        </div>
                        
                        ${canAdjust && html`
                            <div class="mt-4 pt-3 border-t">
                                <button onClick=${() => onAdjust(branch)} class="w-full flex items-center justify-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 ring-1 ring-inset ring-slate-200 transition-colors">
                                    ${ICONS.edit_note} Ajustar Stock
                                </button>
                            </div>
                        `}
                    </div>
                `;
            })}
        </div>
    `;
};

const PriceManagementTab = ({ details, initialPrices, productId, user, onPricesUpdated }) => {
    const [priceRules, setPriceRules] = useState([]);
    const [calculatedPrices, setCalculatedPrices] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const { addToast } = useToast();
    const canEdit = user.role !== 'Empleado';
    const cost = useMemo(() => Number(details.precio_compra || 0), [details.precio_compra]);
    const [collapsedLists, setCollapsedLists] = useState({});

    const recalculateAllPrices = (rules, currentCost) => {
        const newCalculatedPrices = {};
        rules.forEach(rule => {
            const ganancia = Number(rule.ganancia_maxima || 0);
            const finalPrice = currentCost + ganancia;
            newCalculatedPrices[rule.lista_precio_id] = finalPrice.toFixed(2);
        });
        setCalculatedPrices(newCalculatedPrices);
    };

    useEffect(() => {
        const initialRules = (initialPrices || []).map(p => ({
            ...p,
            ganancia_maxima: p.ganancia_maxima ?? 0,
            ganancia_minima: p.ganancia_minima ?? 0,
        }));
        setPriceRules(initialRules);
        recalculateAllPrices(initialRules, cost);

        const initialCollapsedState = {};
        if (initialPrices) {
            initialPrices.forEach(p => {
                initialCollapsedState[p.lista_precio_id] = !p.es_predeterminada;
            });
        }
        setCollapsedLists(initialCollapsedState);
    }, [initialPrices, cost]);

    const toggleCollapse = (listId) => {
        setCollapsedLists(prev => ({
            ...prev,
            [listId]: !prev[listId]
        }));
    };

    const handleRuleChange = (listId, field, value) => {
        setPriceRules(prevRules => {
            const newRules = prevRules.map(rule => 
                rule.lista_precio_id === listId ? { ...rule, [field]: value } : rule
            );
            recalculateAllPrices(newRules, cost);
            return newRules;
        });
    };
    
    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            const updates = priceRules.map(p => ({
                lista_id: p.lista_precio_id,
                ganancia_maxima: Number(p.ganancia_maxima),
                ganancia_minima: Number(p.ganancia_minima)
            }));

            const { error } = await supabase.rpc('update_product_prices', {
                p_precios: updates,
                p_producto_id: productId
            });

            if (error) throw error;
            addToast({ message: 'Precios actualizados con éxito.', type: 'success' });
            onPricesUpdated();
        } catch (err) {
            addToast({ message: `Error al guardar precios: ${err.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return html`
        <div class="space-y-6">
            <div class="bg-white p-6 rounded-lg shadow-md border">
                <h3 class="text-lg font-semibold text-gray-800">Costo</h3>
                <dl class="mt-2">
                    <div class="flex justify-between py-2 border-b">
                        <dt class="text-sm font-medium text-gray-500">Costo Promedio Ponderado (CAPP)</dt>
                        <dd class="text-sm font-semibold text-gray-900">Bs ${cost.toFixed(2)}</dd>
                    </div>
                </dl>
                <p class="text-xs text-gray-500 mt-2">Este valor se actualiza automáticamente con cada compra registrada.</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md border">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">Precios de Venta</h3>
                        <p class="text-sm text-gray-600 mt-1">Define tus márgenes de ganancia para cada lista de precios.</p>
                    </div>
                     ${canEdit && html`
                        <button onClick=${handleSaveChanges} disabled=${isSaving} class="min-w-[150px] w-full sm:w-auto flex justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:bg-slate-400">
                            ${isSaving ? html`<${Spinner}/>` : 'Guardar Precios'}
                        </button>
                    `}
                </div>
                <div class="mt-4 flow-root">
                    <div class="space-y-4">
                        ${priceRules.map(p => {
                            const isCollapsed = collapsedLists[p.lista_precio_id];
                            const maxGain = Number(p.ganancia_maxima);
                            const minGain = Number(p.ganancia_minima);
                            const isPriceActive = p.es_predeterminada
                                ? !isNaN(maxGain) && maxGain > 0 && !isNaN(minGain) && minGain >= 0
                                : !isNaN(maxGain) && maxGain > 0;

                            return html`
                            <div key=${p.lista_precio_id} class="rounded-lg border ${p.es_predeterminada ? 'bg-blue-50/50' : 'bg-white'}">
                                <button onClick=${() => toggleCollapse(p.lista_precio_id)} class="w-full flex justify-between items-center text-left p-4">
                                    <div class="flex items-center gap-3">
                                        <p class="font-semibold text-gray-800">${p.lista_nombre} ${p.es_predeterminada ? '(General)' : ''}</p>
                                        ${isCollapsed && !isPriceActive && html`
                                            <span class="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                                                <span class="text-base">⚠️</span>
                                                Establece las ganancias para activar el precio.
                                            </span>
                                        `}
                                        ${isCollapsed && isPriceActive && html`
                                            <span class="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                                                <span class="material-symbols-outlined text-base">check_circle</span>
                                                Precio de venta activado.
                                            </span>
                                        `}
                                    </div>
                                    <div class="text-gray-500 transform transition-transform ${!isCollapsed ? 'rotate-180' : ''}">
                                        ${ICONS.chevron_down}
                                    </div>
                                </button>
                                
                                ${!isCollapsed && html`
                                    <div class="p-4 pt-0 animate-fade-in-down">
                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                                            <div class="sm:col-span-1">
                                                <label class="block text-sm font-medium text-gray-700">Ganancia Máxima (Bs)</label>
                                                <input 
                                                    type="number" 
                                                    value=${p.ganancia_maxima} 
                                                    onInput=${(e) => handleRuleChange(p.lista_precio_id, 'ganancia_maxima', e.target.value)} 
                                                    class="mt-1 w-full block rounded-md border border-gray-300 p-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm bg-white" placeholder="0.00"
                                                    disabled=${!canEdit}
                                                />
                                            </div>
                                             <div class="sm:col-span-1">
                                                <label class="block text-sm font-medium text-gray-700">Ganancia Mínima (Bs)</label>
                                                <input 
                                                    type="number" 
                                                    value=${p.ganancia_minima} 
                                                    onInput=${(e) => handleRuleChange(p.lista_precio_id, 'ganancia_minima', e.target.value)} 
                                                    class="mt-1 w-full block rounded-md border border-gray-300 p-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm bg-white" placeholder="0.00"
                                                    disabled=${!canEdit}
                                                />
                                            </div>
                                        </div>
                                        <div class="mt-4 pt-3 border-t grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <label class="block text-xs font-medium text-gray-500">Descuento Máx.</label>
                                                <p class="font-bold text-amber-600 text-base">Bs ${(Number(p.ganancia_maxima || 0) - Number(p.ganancia_minima || 0)).toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <label class="block text-xs font-medium text-gray-500">Costo</label>
                                                <p class="font-bold text-gray-800 text-base">Bs ${cost.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <label class="block text-xs font-medium text-gray-500">Precio Venta</label>
                                                <p class="font-bold text-primary text-base">Bs ${calculatedPrices[p.lista_precio_id] || '0.00'}</p>
                                            </div>
                                        </div>
                                    </div>
                                `}
                            </div>
                        `})}
                    </div>
                </div>
            </div>
        </div>
    `;
};

export function ProductoDetailPage({ productoId, user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    const { setIsModalOpen, setProductToEdit } = useProductForm();
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('inventario');
    const [activeImage, setActiveImage] = useState(0);

    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
    const [branchToAdjust, setBranchToAdjust] = useState(null);

    const fetchData = useCallback(async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_product_details', { p_producto_id: productoId });
            if (error) throw error;
            setData(data);
        } catch (err) {
            console.error("Error fetching product details:", err);
            addToast({ message: `Error al cargar el producto: ${err.message}`, type: 'error' });
            navigate('/productos');
        } finally {
            stopLoading();
        }
    }, [productoId, startLoading, stopLoading, addToast, navigate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    useRealtimeListener(fetchData);

    const handleSaveProduct = (action, savedProductId) => {
        addToast({ message: 'Producto actualizado con éxito.', type: 'success' });
        fetchData();
    };

    const handleEdit = () => {
        const productForEdit = {
            ...data.details,
            precio_base: data.prices.find(p => p.es_predeterminada)?.precio ?? 0
        };
        setProductToEdit(productForEdit);
        setIsModalOpen(true);
    };
    
    const handleOpenAdjustModal = (branch) => {
        setBranchToAdjust(branch);
        setAdjustModalOpen(true);
    };

    const handleDelete = () => {
        setDeleteModalOpen(true);
    };
    
    const handleConfirmDelete = async () => {
        startLoading();
        try {
            const { error } = await supabase.rpc('delete_product', { p_producto_id: productoId });
            if (error) throw error;
            addToast({ message: `Producto "${data.details.nombre}" eliminado.`, type: 'success' });
            navigate('/productos');
        } catch(err) {
            addToast({ message: `Error al eliminar: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
            setDeleteModalOpen(false);
        }
    };

    const handleSaveAdjustments = () => {
        setAdjustModalOpen(false);
        setBranchToAdjust(null);
        addToast({ message: 'Inventario actualizado.', type: 'success' });
        fetchData();
    };

    if (!data) {
        return html`<${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} activeLink="Productos" />`;
    }
    
    const { details, images, inventory, prices, all_branches } = data;
    const breadcrumbs = [
        { name: 'Productos', href: '#/productos' },
        { name: details.nombre, href: `#/productos/${productoId}` }
    ];

    const tabs = [
        { id: 'inventario', label: 'Inventario' },
    ];
    if (user.role === 'Propietario' || user.role === 'Administrador') {
        tabs.push({ id: 'precios', label: 'Precios y Costos' });
    }
    tabs.push({ id: 'detalles', label: 'Detalles' });
    
    const stockToShow = useMemo(() => {
        if (!inventory) return 0;
        if (user.role === 'Propietario') {
            return inventory.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
        } else {
            const branchInventory = inventory.find(item => item.sucursal_id === user.sucursal_id);
            return branchInventory ? (Number(branchInventory.cantidad) || 0) : 0;
        }
    }, [inventory, user]);

    const kpiTitle = user.role === 'Propietario' ? "Stock Total" : "Stock en Sucursal";

    const generalPrice = prices?.find(p => p.es_predeterminada)?.precio;
    const fallbackPrice = prices?.find(p => p.precio != null)?.precio;
    const displayPrice = generalPrice ?? fallbackPrice;

    const formattedDisplayPrice = displayPrice != null 
        ? `Bs ${Number(displayPrice).toFixed(2)}` 
        : 'No establecido';

    const formattedCost = `Bs ${Number(details.precio_compra || 0).toFixed(2)}`;

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
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div class="flex items-center gap-4">
                    <button onClick=${() => navigate('/productos')} class="p-2 rounded-full hover:bg-gray-200" aria-label="Volver">
                        ${ICONS.arrow_back}
                    </button>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">${details.nombre}</h1>
                        <p class="text-sm text-gray-500">SKU: ${details.sku || 'N/A'}</p>
                    </div>
                </div>
                ${(user.role === 'Propietario' || user.role === 'Administrador') && html`
                    <div class="flex items-center gap-2">
                        <button onClick=${handleEdit} class="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                            ${ICONS.edit} Editar
                        </button>
                        <button onClick=${handleDelete} class="flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500">
                            ${ICONS.delete} Eliminar
                        </button>
                    </div>
                `}
            </div>

            ${(!generalPrice || generalPrice <= 0) && (user.role === 'Propietario' || user.role === 'Administrador') && html`
                <div class="mb-6 p-4 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" role="alert">
                    <div class="flex items-start gap-3">
                        <div class="text-2xl flex-shrink-0 mt-0.5">${ICONS.warning}</div>
                        <div>
                            <h3 class="font-bold">Precio de Venta no Definido</h3>
                            <p class="text-sm">Este producto no aparecerá en el Punto de Venta hasta que se defina su ganancia en la lista 'General'. Ve a la pestaña 'Precios y Costos' para configurarlo.</p>
                        </div>
                    </div>
                    <button onClick=${() => setActiveTab('precios')} class="mt-2 sm:mt-0 flex-shrink-0 w-full sm:w-auto rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600">
                        Configurar Precios
                    </button>
                </div>
            `}

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-1">
                    <div class="bg-white p-4 rounded-lg shadow-md border sticky top-6">
                        <div class="aspect-square bg-gray-100 rounded-md mb-4">
                            <img 
                                src=${(images && images.length > 0 && images[activeImage]?.imagen_url) || NO_IMAGE_ICON_URL} 
                                alt="Producto" 
                                class="w-full h-full object-contain rounded-md" 
                            />
                        </div>
                        ${images.length > 1 && html`
                            <div class="flex space-x-2 overflow-x-auto p-1">
                                ${images.map((img, index) => html`
                                    <button 
                                        onClick=${() => setActiveImage(index)} 
                                        class="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-md overflow-hidden transition-opacity duration-200 ${activeImage === index ? 'opacity-100' : 'opacity-60 hover:opacity-100'}"
                                    >
                                        <img src=${img.imagen_url} class="w-full h-full object-contain" />
                                    </button>
                                `)}
                            </div>
                        `}
                    </div>
                </div>

                <div class="lg:col-span-2">
                    <div class="mb-6">
                        <${KPI_Card} 
                            title=${kpiTitle}
                            value=${stockToShow}
                            icon=${ICONS.inventory} 
                            color=${stockToShow > 0 ? 'green' : 'red'}
                            subtext=${html`
                                <div class="mt-2 text-xs space-y-1">
                                    ${(user.role === 'Propietario' || user.role === 'Administrador') && html`
                                        <div class="flex justify-between">
                                            <span class="font-medium text-gray-500">Costo:</span>
                                            <span class="font-semibold text-gray-700">${formattedCost}</span>
                                        </div>
                                    `}
                                    <div class="flex justify-between">
                                        <span class="font-medium text-gray-500">Precio Venta (General):</span>
                                        <span class="font-semibold text-gray-700">${formattedDisplayPrice}</span>
                                    </div>
                                </div>
                            `} 
                        />
                    </div>

                    <${Tabs} tabs=${tabs} activeTab=${activeTab} onTabClick=${setActiveTab} />
                    
                    <div class="mt-6">
                        ${activeTab === 'inventario' && html`<${InventoryBreakdown} inventory=${inventory} allBranches=${all_branches} user=${user} onAdjust=${handleOpenAdjustModal} />`}
                        ${activeTab === 'precios' && html`<${PriceManagementTab} details=${details} initialPrices=${prices} productId=${productoId} user=${user} onPricesUpdated=${fetchData} />`}
                        ${activeTab === 'detalles' && html`
                             <div class="bg-white p-6 rounded-lg shadow-md border">
                                <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                                    <div><dt class="text-sm font-medium text-gray-500">Marca</dt><dd class="mt-1 text-sm text-gray-900">${details.marca || 'N/A'}</dd></div>
                                    <div><dt class="text-sm font-medium text-gray-500">Modelo</dt><dd class="mt-1 text-sm text-gray-900">${details.modelo || 'N/A'}</dd></div>
                                    <div><dt class="text-sm font-medium text-gray-500">Categoría</dt><dd class="mt-1 text-sm text-gray-900">${details.categoria_nombre || 'Sin categoría'}</dd></div>
                                    <div><dt class="text-sm font-medium text-gray-500">Unidad de Medida</dt><dd class="mt-1 text-sm text-gray-900">${details.unidad_medida}</dd></div>
                                    <div class="sm:col-span-2">
                                        <dt class="text-sm font-medium text-gray-500">Descripción</dt>
                                        <dd class="mt-1 text-sm text-gray-900 whitespace-pre-wrap" dangerouslySetInnerHTML=${{ __html: details.descripcion || 'Sin descripción detallada.' }}></dd>
                                    </div>
                                </dl>
                            </div>
                        `}
                    </div>
                </div>
            </div>

            <${ConfirmationModal}
                isOpen=${isDeleteModalOpen}
                onClose=${() => setDeleteModalOpen(false)}
                onConfirm=${handleConfirmDelete}
                title="Confirmar Eliminación"
                confirmText="Sí, eliminar"
                confirmVariant="danger"
                icon=${ICONS.warning_amber}
            >
                <p class="text-sm text-gray-600">¿Estás seguro de que quieres eliminar el producto <span class="font-bold text-gray-800">${details.nombre}</span>? Esta acción no se puede deshacer.</p>
            <//>

            ${data && html`
                <${InventoryAdjustModal}
                    isOpen=${isAdjustModalOpen}
                    onClose=${() => { setAdjustModalOpen(false); setBranchToAdjust(null); }}
                    onSave=${handleSaveAdjustments}
                    product=${details}
                    inventory=${inventory}
                    branchToAdjust=${branchToAdjust}
                />
            `}
            
            <${ProductFormModal} onSave=${handleSaveProduct} user=${user} />
        <//>
    `;
}
