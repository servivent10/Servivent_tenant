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
import { Tabs } from '../../components/Tabs.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { ProductFormModal } from '../../components/modals/ProductFormModal.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { Spinner } from '../../components/Spinner.js';

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

const PriceManagementTab = ({ details, initialPrices, productId }) => {
    const [editablePrices, setEditablePrices] = useState(initialPrices || []);
    const [isSaving, setIsSaving] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        setEditablePrices(initialPrices || []);
    }, [initialPrices]);

    const handlePriceChange = (listaId, value) => {
        setEditablePrices(currentPrices =>
            currentPrices.map(p =>
                p.lista_precio_id === listaId ? { ...p, precio: value } : p
            )
        );
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            const updates = editablePrices.map(p => ({
                lista_id: p.lista_precio_id,
                precio: p.precio === '' || p.precio === null ? null : Number(p.precio)
            }));

            const { error } = await supabase.rpc('update_product_prices', {
                p_producto_id: productId,
                p_precios: updates
            });

            if (error) throw error;
            addToast({ message: 'Precios actualizados con éxito.', type: 'success' });
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
                        <dd class="text-sm font-semibold text-gray-900">Bs ${Number(details.precio_compra || 0).toFixed(2)}</dd>
                    </div>
                </dl>
                <p class="text-xs text-gray-500 mt-2">Este valor se actualiza automáticamente con cada compra registrada.</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md border">
                <h3 class="text-lg font-semibold text-gray-800">Precios de Venta</h3>
                <p class="text-sm text-gray-600 mt-1">Asigna un precio a este producto para cada una de tus listas.</p>
                <div class="mt-4 flow-root">
                    <div class="space-y-4">
                        ${editablePrices.map(p => html`
                            <div key=${p.lista_precio_id}>
                                <label for="price-${p.lista_precio_id}" class="block text-sm font-medium text-gray-700">
                                    ${p.lista_nombre} ${p.es_predeterminada ? html`<span class="text-xs text-gray-500">(General)</span>` : ''}
                                </label>
                                <div class="relative mt-1">
                                    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <span class="text-gray-500 sm:text-sm">Bs</span>
                                    </div>
                                    <input
                                        type="number"
                                        id="price-${p.lista_precio_id}"
                                        class="block w-full rounded-md border-gray-300 pl-8 pr-3 py-2 focus:border-primary focus:ring-primary sm:text-sm ${p.es_predeterminada ? 'bg-gray-200 text-gray-700 cursor-not-allowed' : 'bg-white text-gray-900'}"
                                        placeholder="0.00"
                                        value=${p.precio}
                                        onInput=${(e) => handlePriceChange(p.lista_precio_id, e.target.value)}
                                        disabled=${p.es_predeterminada}
                                    />
                                    ${p.es_predeterminada && html`
                                        <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                                            <span class="text-gray-500 text-xs italic">Se edita desde el formulario principal</span>
                                        </div>
                                    `}
                                </div>
                            </div>
                        `)}
                    </div>
                </div>
                <div class="mt-6 flex justify-end">
                    <button onClick=${handleSaveChanges} disabled=${isSaving} class="min-w-[150px] flex justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:bg-slate-400">
                        ${isSaving ? html`<${Spinner}/>` : 'Guardar Precios'}
                    </button>
                </div>
            </div>
        </div>
    `;
};

const InventoryAdjustModal = ({ isOpen, onClose, onSave, product, inventory, allBranches, branchToAdjust }) => {
    const { addToast } = useToast();
    const [adjustments, setAdjustments] = useState({});
    const [reason, setReason] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // Determine which branches to display in the modal
    const branchesToShow = useMemo(() => {
        return branchToAdjust ? [branchToAdjust] : allBranches;
    }, [branchToAdjust, allBranches]);

    useEffect(() => {
        if (isOpen) {
            setAdjustments({});
            setReason('Ajuste manual');
        }
    }, [isOpen]);

    const handleAdjustmentChange = (sucursalId, value) => {
        setAdjustments(prev => ({ ...prev, [sucursalId]: value }));
    };

    const handleConfirm = async () => {
        const adjustmentsToSave = Object.entries(adjustments)
            .map(([sucursal_id, cantidad_ajuste]) => ({
                sucursal_id,
                cantidad_ajuste: Number(cantidad_ajuste) || 0,
            }))
            .filter(adj => adj.cantidad_ajuste !== 0);

        if (adjustmentsToSave.length === 0) {
            addToast({ message: 'No se introdujo ningún ajuste.', type: 'info' });
            onClose();
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.rpc('ajustar_inventario_lote', {
                p_producto_id: product.id,
                p_ajustes: adjustmentsToSave,
                p_motivo: reason,
            });
            if (error) throw error;
            onSave();
        } catch (err) {
            addToast({ message: `Error al ajustar inventario: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const inventoryMap = new Map(inventory.map(item => [item.sucursal_id, item.cantidad]));
    const title = branchToAdjust ? `Ajuste en ${branchToAdjust.nombre}` : "Ajuste de Inventario";

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : 'Guardar Ajustes'}
            icon=${ICONS.inventory}
            maxWidthClass="max-w-xl"
        >
            <div class="max-h-[60vh] overflow-y-auto -m-6 p-6 space-y-4">
                <p class="text-sm text-gray-600">Ajustando para: <span class="font-bold text-gray-800">${product.nombre}</span></p>
                
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</th>
                            <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                            <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ajuste (+/-)</th>
                            <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Nuevo</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${branchesToShow.map(branch => {
                            // FIX: Ensure currentStock is a number to prevent type errors in the addition operation.
                            // The value from the map could be `unknown`, so it must be cast.
                            const currentStock = Number(inventoryMap.get(branch.id)) || 0;
                            const adjustmentValue = Number(adjustments[branch.id]) || 0;
                            const newStock = currentStock + adjustmentValue;
                            return html`
                                <tr key=${branch.id}>
                                    <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">${branch.nombre}</td>
                                    <td class="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-500">${currentStock}</td>
                                    <td class="px-3 py-2 whitespace-nowrap">
                                        <input 
                                            type="number" 
                                            class="w-24 text-center rounded-md border-0 p-2 bg-white text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm transition-colors duration-200"
                                            value=${adjustments[branch.id] || ''}
                                            onInput=${e => handleAdjustmentChange(branch.id, e.target.value)}
                                        />
                                    </td>
                                    <td class="px-3 py-2 whitespace-nowrap text-sm text-center font-bold ${newStock < 0 ? 'text-red-600' : 'text-gray-900'}">
                                        ${newStock}
                                    </td>
                                </tr>
                            `;
                        })}
                    </tbody>
                </table>
                <div>
                    <label for="reason" class="block text-sm font-medium text-gray-700">Motivo del Ajuste</label>
                    <input 
                        type="text" 
                        id="reason"
                        value=${reason}
                        onInput=${e => setReason(e.target.value)}
                        class="mt-1 block w-full rounded-md border-0 p-2 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm transition-colors duration-200"
                    />
                </div>
            </div>
        <//>
    `;
};


export function ProductoDetailPage({ productoId, user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('inventario');
    const [activeImage, setActiveImage] = useState(0);

    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
    const [branchToAdjust, setBranchToAdjust] = useState(null);

    const fetchData = async () => {
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
    };

    useEffect(() => {
        fetchData();
    }, [productoId]);

    const handleEdit = () => {
        setFormModalOpen(true);
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

    const handleSaveProduct = (action) => {
        setFormModalOpen(false);
        addToast({ message: `Producto actualizado con éxito.`, type: 'success' });
        fetchData();
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
        { id: 'precios', label: 'Precios y Costos' },
        { id: 'detalles', label: 'Detalles' },
    ];
    
    const totalStock = (inventory || []).reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);

    const productForEdit = {
        ...details,
        precio_base: prices.find(p => p.es_predeterminada)?.precio ?? 0
    };

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
                <div class="flex items-center gap-2">
                    <button onClick=${handleEdit} class="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                        ${ICONS.edit} Editar
                    </button>
                    <button onClick=${handleDelete} class="flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500">
                        ${ICONS.delete} Eliminar
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-1">
                    <div class="bg-white p-4 rounded-lg shadow-md border sticky top-6">
                        <div class="aspect-square bg-gray-100 rounded-md mb-4">
                             <img src=${images[activeImage]?.imagen_url || 'https://picsum.photos/400/400'} alt="Producto" class="w-full h-full object-contain rounded-md" />
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
                            title="Stock Total" 
                            value=${totalStock} 
                            icon=${ICONS.inventory} 
                            color=${totalStock > 0 ? 'green' : 'red'}
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
                        ${activeTab === 'precios' && html`<${PriceManagementTab} details=${details} initialPrices=${prices} productId=${productoId} />`}
                        ${activeTab === 'detalles' && html`
                             <div class="bg-white p-6 rounded-lg shadow-md border">
                                <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                                    <div><dt class="text-sm font-medium text-gray-500">Marca</dt><dd class="mt-1 text-sm text-gray-900">${details.marca || 'N/A'}</dd></div>
                                    <div><dt class="text-sm font-medium text-gray-500">Modelo</dt><dd class="mt-1 text-sm text-gray-900">${details.modelo || 'N/A'}</dd></div>
                                    <div><dt class="text-sm font-medium text-gray-500">Categoría</dt><dd class="mt-1 text-sm text-gray-900">${details.categoria_nombre || 'Sin categoría'}</dd></div>
                                    <div><dt class="text-sm font-medium text-gray-500">Unidad de Medida</dt><dd class="mt-1 text-sm text-gray-900">${details.unidad_medida}</dd></div>
                                    <div class="sm:col-span-2"><dt class="text-sm font-medium text-gray-500">Descripción</dt><dd class="mt-1 text-sm text-gray-900">${details.descripcion || 'Sin descripción.'}</dd></div>
                                </dl>
                            </div>
                        `}
                    </div>
                </div>
            </div>

            <${ProductFormModal} 
                isOpen=${isFormModalOpen}
                onClose=${() => setFormModalOpen(false)}
                onSave=${handleSaveProduct}
                user=${user}
                productToEdit=${productForEdit}
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
                <p class="text-sm text-gray-600">¿Estás seguro de que quieres eliminar el producto <span class="font-bold text-gray-800">${details.nombre}</span>? Esta acción no se puede deshacer.</p>
            <//>

            ${data && html`
                <${InventoryAdjustModal}
                    isOpen=${isAdjustModalOpen}
                    onClose=${() => { setAdjustModalOpen(false); setBranchToAdjust(null); }}
                    onSave=${handleSaveAdjustments}
                    product=${details}
                    inventory=${inventory}
                    allBranches=${all_branches}
                    branchToAdjust=${branchToAdjust}
                />
            `}
        <//>
    `;
}