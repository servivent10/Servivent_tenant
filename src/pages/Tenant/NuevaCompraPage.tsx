/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { FormInput } from '../../components/FormComponents.js';
import { Spinner } from '../../components/Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { supabase } from '../../lib/supabaseClient.js';
import { ProveedorFormModal } from '../../components/modals/ProveedorFormModal.js';
import { ProductFormModal } from '../../components/modals/ProductFormModal.js';
import { Tabs } from '../../components/Tabs.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';


const SearchableSelect = ({ label, name, placeholder, options, value, onChange, onAddNew, showAddNew = true, required = true }) => {
    const selectedOption = useMemo(() => options.find(o => o.id === value), [options, value]);
    const [searchTerm, setSearchTerm] = useState(selectedOption ? selectedOption.nombre : '');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        setSearchTerm(selectedOption ? selectedOption.nombre : '');
    }, [selectedOption]);

    const filteredOptions = useMemo(() => {
        const baseOptions = options.filter(o => o.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
        return showAddNew ? [{ id: 'add_new', nombre: 'Añadir nuevo...' }, ...baseOptions] : baseOptions;
    }, [searchTerm, options, showAddNew]);

    const handleSelect = (option) => {
        if (option.id === 'add_new') {
            onAddNew();
        } else {
            onChange(option.id, option.nombre);
            setSearchTerm(option.nombre);
        }
        setIsOpen(false);
    };

    const handleClear = () => {
        onChange(null, '');
        setSearchTerm('');
        setIsOpen(true);
    };
    
     useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm(selectedOption ? selectedOption.nombre : '');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedOption]);

    return html`
        <div ref=${wrapperRef}>
            <label for=${name} class="block text-sm font-medium text-gray-900">${label}</label>
            <div class="mt-1 relative">
                <input
                    id=${name}
                    type="text"
                    required=${required}
                    value=${searchTerm}
                    onInput=${e => { setSearchTerm(e.target.value); setIsOpen(true); }}
                    onFocus=${(e) => { e.target.select(); setIsOpen(true); }}
                    placeholder=${placeholder}
                    class="block w-full rounded-md border border-gray-300 p-2 pr-10 bg-white text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm transition-colors duration-200"
                />
                 <div class="absolute inset-y-0 right-0 flex items-center pr-2">
                    ${searchTerm && html`<button type="button" onClick=${handleClear} class="text-gray-400 hover:text-gray-600">${ICONS.close}</button>`}
                    <button type="button" onClick=${() => setIsOpen(p => !p)} class="text-gray-400 hover:text-gray-600">${ICONS.chevron_down}</button>
                </div>
                ${isOpen && html`
                    <ul class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        ${filteredOptions.map(option => html`
                            <li key=${option.id} onClick=${() => handleSelect(option)} class="relative cursor-pointer select-none py-2 px-4 hover:bg-slate-100 ${option.id === 'add_new' ? 'text-primary font-semibold' : 'text-gray-900'}">
                                <span class="block truncate">${option.nombre}</span>
                            </li>
                        `)}
                    </ul>
                `}
            </div>
        </div>
    `;
};


// --- NEW PURCHASE WIZARD PAGE COMPONENTS ---

function PurchaseItemDetailModal({ isOpen, onClose, onSave, item, currency, exchangeRate, user, addToast }) {
    if (!isOpen || !item) return null;

    const [activeTab, setActiveTab] = useState('inventory');
    const [isLoading, setIsLoading] = useState(true);
    const [productDetails, setProductDetails] = useState(null);
    const [localItem, setLocalItem] = useState(item);
    
    const [distribuciones, setDistribuciones] = useState<{ [key: string]: number }>({});
    
    const [priceRules, setPriceRules] = useState([]);
    const [calculatedPrices, setCalculatedPrices] = useState({});
    
    const [errors, setErrors] = useState<{ costo_unitario?: string; }>({});
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: { ganancia_maxima?: string; ganancia_minima?: string } }>({});
    const [collapsedLists, setCollapsedLists] = useState({});

    const cantidadTotalComprada = useMemo(() => 
        Object.values(distribuciones).reduce((sum: number, qty: number) => sum + (qty || 0), 0)
    , [distribuciones]);

    const capp_actual = Number(productDetails?.details?.precio_compra || 0);
    const costo_unitario_ingresado = Number(localItem.costo_unitario || 0);
    const tasa_cambio = Number(exchangeRate || 1);
    const costo_compra_bob = currency === 'USD' ? costo_unitario_ingresado * tasa_cambio : costo_unitario_ingresado;
    
    const stock_total_actual = useMemo(() =>
        productDetails?.inventory?.reduce((sum: number, inv: { cantidad: number }) => sum + Number(inv.cantidad || 0), 0) || 0,
        [productDetails]);

    const nuevo_capp = (stock_total_actual + cantidadTotalComprada) > 0
        ? ((stock_total_actual * capp_actual) + (cantidadTotalComprada * costo_compra_bob)) / (stock_total_actual + cantidadTotalComprada)
        : costo_compra_bob;

    const toggleCollapse = (listId) => {
        setCollapsedLists(prev => ({ ...prev, [listId]: !prev[listId] }));
    };

    const recalculateAllPrices = (rules, cost) => {
        const newCalculatedPrices = {};
        rules.forEach(rule => {
            const ganancia = Number(rule.ganancia_maxima || 0);
            const finalPrice = cost + ganancia;
            newCalculatedPrices[rule.lista_precio_id] = finalPrice.toFixed(2);
        });
        setCalculatedPrices(newCalculatedPrices);
    };
    
    useEffect(() => {
        const fetchDetails = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase.rpc('get_product_details', { p_producto_id: item.producto_id });
                if (error) throw error;
                setProductDetails(data);
                
                const initialDistribuciones: { [key: string]: number } = {};
                if (item.distribucion && Array.isArray(item.distribucion)) {
                    item.distribucion.forEach(d => {
                        initialDistribuciones[d.sucursal_id] = d.cantidad;
                    });
                }
                setDistribuciones(initialDistribuciones);

                const initialRules = data.prices.map(p => ({
                    ...p,
                    ganancia_maxima: p.ganancia_maxima ?? '',
                    ganancia_minima: p.ganancia_minima ?? '',
                }));
                setPriceRules(initialRules);

                const initialCollapsedState = {};
                data.prices.forEach(p => {
                    initialCollapsedState[p.lista_precio_id] = !p.es_predeterminada;
                });
                setCollapsedLists(initialCollapsedState);

            } catch (err) {
                addToast({ message: `Error al cargar detalles: ${err.message}`, type: 'error' });
                onClose();
            } finally {
                setIsLoading(false);
            }
        };
        if (isOpen) {
            setLocalItem(item);
            setActiveTab('inventory');
            setErrors({});
            setValidationErrors({});
            fetchDetails();
        }
    }, [isOpen, item.producto_id]);

    useEffect(() => {
        if (priceRules.length > 0) {
            recalculateAllPrices(priceRules, nuevo_capp);
        }
    }, [priceRules, nuevo_capp]);


    const tabs = [
        { id: 'inventory', label: 'Compra e Inventario' },
        { id: 'prices', label: 'Precios de Venta' },
    ];
    
    const handleLocalItemChange = (field, value) => {
        setLocalItem(prev => ({ ...prev, [field]: value }));
    };

    const handleDistribucionChange = (sucursalId, value) => {
        const cantidad = parseInt(value, 10);
        setDistribuciones(prev => ({
            ...prev,
            [sucursalId]: isNaN(cantidad) || cantidad < 0 ? 0 : cantidad
        }));
    };
    
    const handleRuleChange = (listId, field, value) => {
        setPriceRules(prevRules => {
            const newRules = prevRules.map(rule => 
                rule.lista_precio_id === listId ? { ...rule, [field]: value } : rule
            );
            recalculateAllPrices(newRules, nuevo_capp);
            return newRules;
        });
    };

    const handleSave = () => {
        let isValid = true;
        const newErrors: { [key: string]: { ganancia_maxima?: string; ganancia_minima?: string } } = {};

        priceRules.forEach(rule => {
            const maxGainStr = String(rule.ganancia_maxima);
            const minGainStr = String(rule.ganancia_minima);
            const maxGain = parseFloat(maxGainStr);
            const minGain = parseFloat(minGainStr);
            const errorsForList: { ganancia_maxima?: string; ganancia_minima?: string } = {};

            if (rule.es_predeterminada) {
                if (maxGainStr.trim() === '' || isNaN(maxGain)) { errorsForList.ganancia_maxima = 'Obligatorio'; isValid = false; }
                if (minGainStr.trim() === '' || isNaN(minGain)) { errorsForList.ganancia_minima = 'Obligatorio'; isValid = false; }
            }
            if (maxGainStr.trim() !== '' && !isNaN(maxGain) && (minGainStr.trim() === '' || isNaN(minGain))) { errorsForList.ganancia_minima = 'Obligatorio'; isValid = false; }
            if (!isNaN(maxGain) && !isNaN(minGain) && minGain > maxGain) { errorsForList.ganancia_minima = 'No puede ser mayor'; isValid = false; }
            if (Object.keys(errorsForList).length > 0) newErrors[rule.lista_precio_id] = errorsForList;
        });

        setValidationErrors(newErrors);

        if (!isValid) {
            addToast({ message: 'Por favor, corrige los errores en los precios de venta.', type: 'error' });
            const firstErrorListId = Object.keys(newErrors)[0];
            if (firstErrorListId) setCollapsedLists(prev => ({ ...prev, [firstErrorListId]: false }));
            setActiveTab('prices');
            return;
        }

        const distribucionArray = Object.entries(distribuciones)
            .map(([sucursal_id, cantidad]) => ({ sucursal_id, cantidad: Number(cantidad) }))
            .filter(d => d.cantidad > 0);

        onSave({
            ...localItem,
            cantidad: cantidadTotalComprada,
            distribucion: distribucionArray,
            prices: priceRules.map(p => ({
                lista_id: p.lista_precio_id,
                ganancia_maxima: Number(p.ganancia_maxima || 0),
                ganancia_minima: Number(p.ganancia_minima || 0)
            }))
        });
    };

    const handleNextTab = () => {
        const newErrors: { costo_unitario?: string } = {};
        if (Number(localItem.costo_unitario || 0) <= 0) newErrors.costo_unitario = 'Debe ser > 0.';
        setErrors(newErrors);

        if (cantidadTotalComprada <= 0) {
            addToast({ message: 'La cantidad total comprada debe ser mayor a cero.', type: 'error' });
            return;
        }
        if (Object.keys(newErrors).length > 0) return;
        
        setActiveTab('prices');
    };

    const inventoryMap = new Map(productDetails?.inventory.map(item => [item.sucursal_id, item.cantidad]));

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${activeTab === 'inventory' ? handleNextTab : handleSave}
            title="Detalle del Producto en Compra"
            confirmText=${activeTab === 'inventory' ? 'Siguiente' : 'Aceptar'}
            icon=${ICONS.inventory}
            maxWidthClass="max-w-3xl"
        >
            <div class="space-y-4">
                <div class="flex items-center gap-4 p-2 bg-slate-50 rounded-lg">
                    <img src=${item.imagen_principal || NO_IMAGE_ICON_URL} class="h-14 w-14 rounded-md object-cover flex-shrink-0 bg-white" />
                    <p class="font-bold text-lg text-gray-800">${item.producto_nombre}</p>
                </div>
                
                <${Tabs} tabs=${tabs} activeTab=${activeTab} onTabClick=${setActiveTab} />
                
                <div class="mt-4">
                    ${isLoading ? html`<div class="flex justify-center items-center h-full min-h-[24rem]"><${Spinner}/></div>` : html`
                        ${activeTab === 'inventory' && html`
                            <div class="space-y-3 animate-fade-in-down">
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div class="p-4 bg-white rounded-lg border">
                                        <h4 class="text-sm font-semibold text-gray-800 mb-2">Datos de la Compra</h4>
                                        <div class="space-y-3">
                                            <${FormInput} label="Costo Unitario (${currency})" name="costo_unitario" type="number" value=${localItem.costo_unitario} onInput=${e => handleLocalItemChange('costo_unitario', e.target.value)} error=${errors.costo_unitario} />
                                            <div>
                                                <label class="block text-sm font-medium text-gray-700">Total Comprado</label>
                                                <div class="mt-1 p-2 h-10 flex items-center justify-end rounded-md bg-gray-100 font-bold text-gray-800">${cantidadTotalComprada}</div>
                                            </div>
                                        </div>
                                    </div>
                                     <div class="p-4 bg-slate-50 rounded-lg border">
                                        <h4 class="text-sm font-semibold text-gray-800 mb-2">Impacto en Costos</h4>
                                        <div class="p-2 bg-white rounded border">
                                            <h5 class="text-xs font-semibold text-gray-600 mb-1 text-center">Costo Promedio Ponderado (Global)</h5>
                                            <div class="flex justify-around text-center">
                                                <div><label class="block text-xs font-medium text-gray-500">Actual (CAPP)</label><p class="text-sm font-bold text-gray-700 mt-1">Bs ${capp_actual.toFixed(2)}</p></div>
                                                <div><label class="block text-xs font-medium text-gray-500">Nuevo</label><p class="text-sm font-bold text-primary mt-1">Bs ${nuevo_capp.toFixed(2)}</p></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="p-4 bg-white rounded-lg border">
                                    <h4 class="text-sm font-semibold text-gray-800 mb-2">Distribución de Cantidades por Sucursal</h4>
                                    <div class="space-y-2 max-h-48 overflow-y-auto pr-2">
                                        ${productDetails?.all_branches.map(branch => {
                                            const currentStock = Number(inventoryMap.get(branch.id) || 0);
                                            const isCurrentUserSucursal = branch.id === user.sucursal_id;
                                            return html`
                                                <div key=${branch.id} class="grid grid-cols-3 items-center gap-2 p-2 rounded-md hover:bg-slate-50 ${isCurrentUserSucursal ? 'bg-blue-50' : ''}">
                                                    <label for=${`dist-${branch.id}`} class="text-sm font-medium text-gray-800 truncate">
                                                        ${branch.nombre} ${isCurrentUserSucursal ? html`<span class="text-xs font-bold text-primary">(Tu Sucursal)</span>` : ''}
                                                    </label>
                                                    <div class="text-sm text-center text-gray-500">Stock: ${currentStock}</div>
                                                    <input id=${`dist-${branch.id}`} type="number" value=${distribuciones[branch.id] || ''} onInput=${e => handleDistribucionChange(branch.id, e.target.value)} placeholder="0" class="w-full text-center rounded-md bg-white text-gray-900 p-2 border border-gray-300 shadow-sm focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm sm:leading-6" />
                                                </div>
                                            `;
                                        })}
                                    </div>
                                </div>
                            </div>
                        `}
                        ${activeTab === 'prices' && html`
                            <div class="animate-fade-in-down">
                                <div class="p-2 rounded bg-slate-100 text-center text-sm mb-4">
                                    <span class="text-gray-600">Nuevo Costo Aplicado (CAPP): </span>
                                    <span class="font-bold text-lg text-gray-800">Bs ${nuevo_capp.toFixed(2)}</span>
                                </div>
                                <div class="space-y-3 max-h-80 overflow-y-auto p-1">
                                    ${priceRules.map(p => {
                                        const isCollapsed = collapsedLists[p.lista_precio_id];
                                        const errorsForList = validationErrors[p.lista_precio_id] || {};
                                        return html`
                                        <div key=${p.lista_precio_id} class="rounded-lg border ${p.es_predeterminada ? 'bg-blue-50/50' : 'bg-white'}">
                                            <button onClick=${() => toggleCollapse(p.lista_precio_id)} class="w-full flex justify-between items-center text-left p-3">
                                                <p class="font-semibold text-gray-800 text-sm">${p.lista_nombre} ${p.es_predeterminada ? '(General)' : ''}</p>
                                                <div class="text-gray-500 transform transition-transform ${!isCollapsed ? 'rotate-180' : ''}">${ICONS.chevron_down}</div>
                                            </button>
                                            ${!isCollapsed && html`
                                                <div class="p-3 pt-0 animate-fade-in-down">
                                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                                                        <div>
                                                            <label class="block text-xs font-medium text-gray-700">Ganancia Máxima (Bs)</label>
                                                            <input type="number" value=${p.ganancia_maxima} onInput=${e => handleRuleChange(p.lista_precio_id, 'ganancia_maxima', e.target.value)} class=${`mt-1 w-full block rounded-md border-0 p-1.5 text-gray-900 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-white ${errorsForList.ganancia_maxima ? 'ring-red-500' : 'ring-gray-300'}`} />
                                                            ${errorsForList.ganancia_maxima && html`<p class="mt-1 text-xs text-red-600">${errorsForList.ganancia_maxima}</p>`}
                                                        </div>
                                                        <div>
                                                            <label class="block text-xs font-medium text-gray-700">Ganancia Mínima (Bs)</label>
                                                            <input type="number" value=${p.ganancia_minima} onInput=${e => handleRuleChange(p.lista_precio_id, 'ganancia_minima', e.target.value)} class=${`mt-1 w-full block rounded-md border-0 p-1.5 text-gray-900 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-white ${errorsForList.ganancia_minima ? 'ring-red-500' : 'ring-gray-300'}`} />
                                                            ${errorsForList.ganancia_minima && html`<p class="mt-1 text-xs text-red-600">${errorsForList.ganancia_minima}</p>`}
                                                        </div>
                                                    </div>
                                                    <div class="mt-3 pt-2 border-t text-center">
                                                        <label class="block text-xs font-medium text-gray-500">Precio de Venta Resultante</label>
                                                        <p class="font-bold text-primary text-base">Bs ${calculatedPrices[p.lista_precio_id] || '0.00'}</p>
                                                    </div>
                                                </div>
                                            `}
                                        </div>
                                    `})}
                                </div>
                            </div>
                        `}
                    `}
                </div>
            </div>
        <//>
    `;
}

function Step1({ formData, handleInput, setFormData, proveedores, setIsProveedorFormOpen }) {
    const handleProveedorChange = (id, nombre) => {
        setFormData(prev => ({ ...prev, proveedor_id: id, proveedor_nombre: nombre }));
    };
    
    return html`
        <div class="max-w-xl mx-auto space-y-6 animate-fade-in-down">
            <h3 class="text-lg font-semibold text-gray-900">1. Información General de la Compra</h3>
            
            <${SearchableSelect}
                label="Proveedor"
                name="proveedor_id"
                placeholder="-- Selecciona o busca un proveedor --"
                options=${proveedores.map(p => ({ id: p.id, nombre: p.nombre }))}
                value=${formData.proveedor_id}
                onChange=${handleProveedorChange}
                onAddNew=${() => setIsProveedorFormOpen(true)}
            />

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <${FormInput} label="Fecha y Hora de Compra" name="fecha" type="datetime-local" value=${formData.fecha} onInput=${handleInput} />
                <${FormInput} label="N° Factura o Nota (Opcional)" name="n_factura" type="text" value=${formData.n_factura} onInput=${handleInput} required=${false} />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <${SearchableSelect}
                    label="Moneda"
                    name="moneda"
                    placeholder="Selecciona una moneda"
                    options=${[
                        { id: 'BOB', nombre: 'Bolivianos (BOB)' },
                        { id: 'USD', nombre: 'Dólares (USD)' }
                    ]}
                    value=${formData.moneda}
                    onChange=${(id) => handleInput({ target: { name: 'moneda', value: id } })}
                    showAddNew=${false}
                />
                ${formData.moneda === 'USD' && html`
                    <div class="animate-fade-in-down">
                        <${FormInput} label="Tasa de Cambio a BOB" name="tasa_cambio" type="number" value=${formData.tasa_cambio} onInput=${handleInput} />
                    </div>
                `}
            </div>
        </div>
    `;
}

function Step2({ formData, handleEditItem, handleRemoveItem, total, productos, handleProductSelected, handleAddedProductClick, setIsProductFormOpen, addedProductIds }) {
    const [searchTerm, setSearchTerm] = useState('');
    const availableProducts = useMemo(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return productos
            .filter(p => 
                !addedProductIds.has(p.id) && (
                    p.nombre.toLowerCase().includes(lowerCaseSearchTerm) ||
                    (p.modelo && p.modelo.toLowerCase().includes(lowerCaseSearchTerm)) ||
                    (p.sku && p.sku.toLowerCase().includes(lowerCaseSearchTerm))
                )
            )
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [productos, addedProductIds, searchTerm]);

    return html`
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-down">
            <div>
                <h3 class="text-lg font-semibold text-gray-900">2. Productos en la Compra</h3>
                <div class="mt-4 p-4 bg-gray-50 rounded-lg border max-h-[25rem] overflow-y-auto">
                    ${formData.items.length === 0 ? html`
                        <p class="text-center text-gray-500 py-10">Añade productos desde el catálogo de la derecha.</p>
                    ` : html`
                        <ul class="divide-y divide-gray-200">
                            ${formData.items.map((item, index) => html`
                                <li key=${item.producto_id} class="py-3 flex items-center justify-between gap-2">
                                    <div class="flex-1 min-w-0 cursor-pointer group" onClick=${() => handleAddedProductClick(item.producto_id)}>
                                        <p class="font-medium text-gray-800 group-hover:text-primary truncate">${item.producto_nombre}</p>
                                        <p class="text-sm text-gray-500">${item.cantidad} x ${Number(item.costo_unitario).toFixed(2)} ${formData.moneda} = ${(item.cantidad * item.costo_unitario).toFixed(2)} ${formData.moneda}</p>
                                    </div>
                                    <div class="flex-shrink-0">
                                        <button onClick=${(e) => { e.stopPropagation(); handleRemoveItem(index); }} class="p-2 text-gray-400 hover:text-red-600 rounded-full">${ICONS.delete}</button>
                                    </div>
                                </li>
                            `)}
                        </ul>
                    `}
                </div>
                <div class="mt-4 text-right">
                    <p class="text-sm text-gray-500">Total Parcial</p>
                    <p class="text-2xl font-bold text-primary">${total.toFixed(2)} ${formData.moneda}</p>
                </div>
            </div>
            <div>
                <h3 class="text-lg font-semibold text-gray-900">Catálogo de Productos</h3>
                <div class="mt-4">
                    <input 
                        type="text" 
                        value=${searchTerm} 
                        onInput=${e => setSearchTerm(e.target.value)} 
                        placeholder="Buscar por nombre, modelo o SKU..." 
                        class="block w-full rounded-md border border-gray-300 p-2 bg-white text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm"
                    />
                </div>
                <div class="mt-2 p-2 bg-gray-50 border rounded-lg max-h-[25rem] overflow-y-auto">
                    <ul class="divide-y divide-gray-200">
                        <li onClick=${() => setIsProductFormOpen(true)} class="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-100 rounded-md text-primary font-semibold">
                            ${ICONS.add}
                            <span>Crear nuevo producto</span>
                        </li>
                        ${availableProducts.map(p => html`
                            <li key=${p.id} onClick=${() => handleProductSelected(p)} class="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-100 rounded-md">
                                <img src=${p.imagen_principal || NO_IMAGE_ICON_URL} class="h-10 w-10 rounded-md object-cover flex-shrink-0 bg-white" />
                                <div class="flex-1 min-w-0">
                                    <p class="font-medium text-gray-800 truncate">${p.nombre}</p>
                                    <p class="text-xs text-gray-500">Stock total actual: ${p.stock_total}</p>
                                </div>
                            </li>
                        `)}
                    </ul>
                </div>
            </div>
        </div>
    `;
}

function Step3({ formData, handleInput, total }) {
    return html`
        <div class="max-w-xl mx-auto space-y-6 animate-fade-in-down">
            <h3 class="text-lg font-semibold text-gray-900">3. Detalles del Pago</h3>
            <div class="text-center bg-slate-50 p-4 rounded-lg border">
                <p class="text-sm text-gray-600">Total a Pagar</p>
                <p class="text-4xl font-bold text-primary">${total.toFixed(2)} <span class="text-lg">${formData.moneda}</span></p>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">Tipo de Pago</label>
                <div class="mt-1 flex rounded-md shadow-sm">
                    <button type="button" onClick=${() => handleInput({ target: { name: 'tipo_pago', value: 'Contado' } })} class=${`relative inline-flex items-center justify-center w-1/2 rounded-l-md px-3 py-2 text-sm font-semibold ${formData.tipo_pago === 'Contado' ? 'bg-primary text-white' : 'bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}`}>Contado</button>
                    <button type="button" onClick=${() => handleInput({ target: { name: 'tipo_pago', value: 'Crédito' } })} class=${`-ml-px relative inline-flex items-center justify-center w-1/2 rounded-r-md px-3 py-2 text-sm font-semibold ${formData.tipo_pago === 'Crédito' ? 'bg-primary text-white' : 'bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}`}>Crédito</button>
                </div>
            </div>
            ${formData.tipo_pago === 'Crédito' && html`
                <div class="p-4 border rounded-lg space-y-4 animate-fade-in-down">
                    <${FormInput} label="Fecha de Vencimiento" name="fecha_vencimiento" type="date" value=${formData.fecha_vencimiento || ''} onInput=${handleInput} />
                    <${FormInput} label="Abono Inicial (${formData.moneda})" name="abono_inicial" type="number" value=${formData.abono_inicial} onInput=${handleInput} required=${false} />
                    ${Number(formData.abono_inicial) > 0 && html`
                        <div class="animate-fade-in-down">
                            <label for="metodo_abono_inicial" class="block text-sm font-medium text-gray-700">Método del Abono</label>
                            <select id="metodo_abono_inicial" name="metodo_abono_inicial" value=${formData.metodo_abono_inicial} onInput=${handleInput} class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm">
                                <option>Efectivo</option>
                                <option>QR</option>
                                <option>Transferencia Bancaria</option>
                            </select>
                        </div>
                    `}
                </div>
            `}
        </div>
    `;
}

export function NuevaCompraPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const { addToast } = useToast();
    const [step, setStep] = useState(1);
    const [proveedores, setProveedores] = useState([]);
    const [productos, setProductos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isProveedorFormOpen, setIsProveedorFormOpen] = useState(false);
    const [isProductFormOpen, setIsProductFormOpen] = useState(false);
    const [itemDetail, setItemDetail] = useState(null);

    const [formData, setFormData] = useState({
        proveedor_id: '',
        proveedor_nombre: '',
        sucursal_id: user.sucursal_id,
        fecha: new Date().toISOString(),
        n_factura: '',
        moneda: 'BOB',
        tasa_cambio: '6.96',
        items: [],
        tipo_pago: 'Contado',
        fecha_vencimiento: '',
        abono_inicial: '0',
        metodo_abono_inicial: 'Efectivo',
    });

    const fetchInitialData = async () => {
        try {
            const [provRes, prodRes] = await Promise.all([
                supabase.rpc('get_company_providers'),
                supabase.rpc('get_company_products_with_stock_and_cost')
            ]);
            if (provRes.error) throw provRes.error;
            if (prodRes.error) throw prodRes.error;
            setProveedores(provRes.data);
            setProductos(prodRes.data);
        } catch (err) {
            addToast({ message: `Error al cargar datos iniciales: ${err.message}`, type: 'error' });
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    const total = useMemo(() => 
        formData.items.reduce((sum: number, item: any) => sum + (Number(item.cantidad || 0) * Number(item.costo_unitario || 0)), 0)
    , [formData.items]);

    const addedProductIds = useMemo(() => new Set(formData.items.map(item => item.producto_id)), [formData.items]);
    
    const handleNext = () => {
        if (step === 1 && !formData.proveedor_id) {
            addToast({ message: 'Debes seleccionar un proveedor para continuar.', type: 'warning' });
            return;
        }
        if (step === 2 && formData.items.length === 0) {
            addToast({ message: 'Debes añadir al menos un producto a la compra.', type: 'warning' });
            return;
        }
        setStep(prev => prev + 1);
    };

    const handleBack = () => setStep(prev => prev - 1);
    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleProductSelected = (product) => {
        setItemDetail({
            isNew: true,
            producto_id: product.id,
            producto_nombre: product.nombre,
            imagen_principal: product.imagen_principal,
            cantidad: 0,
            costo_unitario: '',
            stock_sucursal: product.stock_sucursal,
            precio_compra: product.precio_compra,
            distribucion: [],
        });
    };
    
    const handleEditItem = (item) => {
        setItemDetail({ ...item, isNew: false });
    };
    
    const handleAddedProductClick = (productId) => {
        const item = formData.items.find(i => i.producto_id === productId);
        if(item) handleEditItem(item);
    };

    const handleSaveItem = (itemFromModal) => {
        const { isNew, ...itemData } = itemFromModal;
        setFormData(prev => {
            const newItems = [...prev.items];
            const index = newItems.findIndex(i => i.producto_id === itemData.producto_id);
            if (index > -1) {
                newItems[index] = itemData;
            } else {
                newItems.push(itemData);
            }
            return { ...prev, items: newItems };
        });
        setItemDetail(null);
    };

    const handleRemoveItem = (index) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };
    
    const handleSaveProveedor = (action, newId) => {
        setIsProveedorFormOpen(false);
        addToast({ message: `Proveedor ${action === 'edit' ? 'actualizado' : 'creado'}.`, type: 'success' });
        fetchInitialData().then(() => {
            if (action === 'create' && newId) {
                setTimeout(() => {
                    setProveedores(currentProveedores => {
                        const newProvider = currentProveedores.find(p => p.id === newId);
                        if (newProvider) {
                             setFormData(prev => ({ ...prev, proveedor_id: newId, proveedor_nombre: newProvider.nombre }));
                        }
                        return currentProveedores;
                    });
                }, 0);
            }
        });
    };

    const handleSaveProduct = (action, newProductId) => {
        setIsProductFormOpen(false);
        addToast({ message: 'Producto creado con éxito.', type: 'success' });
        fetchInitialData().then(() => {
             setTimeout(() => {
                setProductos(currentProductos => {
                    const newProduct = currentProductos.find(p => p.id === newProductId);
                    if (newProduct) {
                       handleProductSelected(newProduct);
                    }
                    return currentProductos;
                });
             }, 0);
        });
    };
    
    const handleConfirmSave = async () => {
        if (!formData.proveedor_id) {
            addToast({ message: 'Para registrar la compra, es necesario seleccionar un proveedor.', type: 'error' });
            return;
        }
        
        setIsLoading(true);
        try {
            const purchasePayload = {
                p_compra: {
                    proveedor_id: formData.proveedor_id,
                    sucursal_id: user.sucursal_id,
                    fecha: formData.fecha,
                    moneda: formData.moneda,
                    tasa_cambio: formData.moneda === 'USD' ? Number(formData.tasa_cambio) : null,
                    tipo_pago: formData.tipo_pago,
                    n_factura: formData.n_factura,
                    fecha_vencimiento: formData.tipo_pago === 'Crédito' ? formData.fecha_vencimiento : null,
                    abono_inicial: formData.tipo_pago === 'Crédito' ? Number(formData.abono_inicial) : null,
                    metodo_abono: formData.tipo_pago === 'Crédito' && Number(formData.abono_inicial) > 0 ? formData.metodo_abono_inicial : null
                },
                p_items: formData.items.map(item => ({
                    producto_id: item.producto_id,
                    costo_unitario: Number(item.costo_unitario),
                    precios: item.prices,
                    distribucion: item.distribucion
                }))
            };

            const { error: compraError } = await supabase.rpc('registrar_compra', purchasePayload);
            if (compraError) throw compraError;

            addToast({ message: 'Compra registrada con éxito.', type: 'success' });
            navigate('/compras');
        } catch(err) {
            addToast({ message: `Error al registrar la compra: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const stepperSteps = [
        { name: 'Información', status: step > 1 ? 'complete' : (step === 1 ? 'current' : 'upcoming') },
        { name: 'Productos', status: step > 2 ? 'complete' : (step === 2 ? 'current' : 'upcoming') },
        { name: 'Pago', status: step === 3 ? 'current' : 'upcoming' },
    ];
    
    const breadcrumbs = [
        { name: 'Compras', href: '#/compras' },
        { name: 'Nueva Compra', href: '#/compras/nueva' }
    ];

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Compras"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="flex items-center gap-4 mb-6">
                <button onClick=${() => navigate('/compras')} class="p-2 rounded-full hover:bg-gray-100" aria-label="Volver a Compras">
                    ${ICONS.arrow_back}
                </button>
                <h1 class="text-2xl font-semibold text-gray-900">Registrar Nueva Compra</h1>
            </div>

            <div class="bg-white p-6 sm:p-8 rounded-xl shadow-sm border">
                <nav aria-label="Progress" class="mb-8">
                    <ol role="list" class="space-y-4 md:flex md:space-x-8 md:space-y-0">
                        ${stepperSteps.map((s, index) => html`
                        <li class="md:flex-1">
                            <div class="flex flex-col border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4
                                ${s.status === 'complete' ? 'border-primary' : (s.status === 'current' ? 'border-primary' : 'border-gray-200')}">
                                <span class="text-sm font-medium ${s.status === 'current' || s.status === 'complete' ? 'text-primary' : 'text-gray-500'}">${`Paso ${index + 1}`}</span>
                                <span class="text-sm font-medium text-gray-900">${s.name}</span>
                            </div>
                        </li>
                        `)}
                    </ol>
                </nav>
                
                <div class="min-h-[30rem]">
                    ${step === 1 && html`<${Step1} formData=${formData} handleInput=${handleInput} setFormData=${setFormData} proveedores=${proveedores} setIsProveedorFormOpen=${setIsProveedorFormOpen} />`}
                    ${step === 2 && html`<${Step2} formData=${formData} handleEditItem=${handleEditItem} handleRemoveItem=${handleRemoveItem} total=${total} productos=${productos} handleProductSelected=${handleProductSelected} handleAddedProductClick=${handleAddedProductClick} setIsProductFormOpen=${setIsProductFormOpen} addedProductIds=${addedProductIds} />`}
                    ${step === 3 && html`<${Step3} formData=${formData} handleInput=${handleInput} setFormData=${setFormData} total=${total} />`}
                </div>
            </div>

            <div class="mt-6 flex justify-between items-center w-full">
                <button 
                    type="button"
                    onClick=${step === 1 ? () => navigate('/compras') : handleBack} 
                    class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                    ${step === 1 ? 'Cancelar' : 'Volver'}
                </button>
                <button 
                    type="button"
                    onClick=${step === 3 ? handleConfirmSave : handleNext}
                    disabled=${isLoading}
                    class="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:bg-slate-400 min-w-[120px] flex justify-center"
                >
                    ${isLoading ? html`<${Spinner}/>` : (step === 3 ? 'Guardar Compra' : 'Siguiente')}
                </button>
            </div>

            <${ProveedorFormModal} 
                isOpen=${isProveedorFormOpen} 
                onClose=${() => setIsProveedorFormOpen(false)} 
                onSave=${handleSaveProveedor} 
            />
            <${ProductFormModal}
                isOpen=${isProductFormOpen}
                onClose=${() => setIsProductFormOpen(false)}
                onSave=${handleSaveProduct}
                user=${user}
            />
            <${PurchaseItemDetailModal}
                isOpen=${!!itemDetail}
                onClose=${() => setItemDetail(null)}
                onSave=${handleSaveItem}
                item=${itemDetail}
                currency=${formData.moneda}
                exchangeRate=${formData.tasa_cambio}
                user=${user}
                addToast=${addToast}
            />
        <//>
    `;
}