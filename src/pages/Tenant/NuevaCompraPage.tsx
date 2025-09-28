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


// --- NEW PURCHASE WIZARD PAGE COMPONENTS ---

function PurchaseItemDetailModal({ isOpen, onClose, onSave, item, currency, exchangeRate, user, addToast }) {
    if (!isOpen || !item) return null;

    const [activeTab, setActiveTab] = useState('inventory');
    const [isLoading, setIsLoading] = useState(true);
    const [productDetails, setProductDetails] = useState(null);
    const [localItem, setLocalItem] = useState < any > (item);
    
    const [priceRules, setPriceRules] = useState([]); // Array of { lista_id, nombre, ..., tipo_ganancia, valor_ganancia }
    const [calculatedPrices, setCalculatedPrices] = useState({}); // Map of { lista_id: calculated_price }
    
    const [errors, setErrors] = useState < { cantidad?: string; costo_unitario?: string; } > ({});
    const [generalPriceRuleError, setGeneralPriceRuleError] = useState('');

    const stock_sucursal_actual = Number(item.stock_sucursal || 0);
    const stock_total_actual = useMemo(() =>
        productDetails?.inventory.reduce((sum, inv) => sum + Number(inv.cantidad), 0) || 0,
        [productDetails]);

    const capp_actual = Number(productDetails?.details.precio_compra || 0);
    const cantidad_comprada = Number(localItem.cantidad || 0);
    const costo_unitario_ingresado = Number(localItem.costo_unitario || 0);
    const tasa_cambio = Number(exchangeRate || 1);
    const costo_compra_bob = currency === 'USD' ? costo_unitario_ingresado * tasa_cambio : costo_unitario_ingresado;

    const nuevo_stock_sucursal = stock_sucursal_actual + cantidad_comprada;
    const nuevo_stock_total = stock_total_actual + cantidad_comprada;

    const nuevo_capp = (stock_total_actual + cantidad_comprada) > 0
        ? ((stock_total_actual * capp_actual) + (cantidad_comprada * costo_compra_bob)) / (stock_total_actual + cantidad_comprada)
        : costo_compra_bob;

    const recalculateAllPrices = (rules, cost) => {
        const newCalculatedPrices = {};
        rules.forEach(rule => {
            const valor = Number(rule.valor_ganancia || 0);
            let finalPrice = cost;
            if (rule.tipo_ganancia === 'porcentaje') {
                finalPrice = cost * (1 + valor / 100);
            } else { // 'fijo'
                finalPrice = cost + valor;
            }
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
                
                const initialRules = data.prices.map(p => ({
                    ...p,
                    tipo_ganancia: p.tipo_ganancia || 'fijo',
                    valor_ganancia: p.valor_ganancia || 0,
                }));
                setPriceRules(initialRules);
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
            setGeneralPriceRuleError('');
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
    
    const handleItemChange = (field, value) => {
        setLocalItem(prev => ({ ...prev, [field]: value }));
    };
    
    const handleRuleChange = (listId, field, value) => {
        setPriceRules(prevRules => {
            const newRules = prevRules.map(rule => 
                rule.lista_precio_id === listId ? { ...rule, [field]: value } : rule
            );
            
            // Retro-cálculo si cambia el TIPO de ganancia
            if (field === 'tipo_ganancia') {
                const updatedRule = newRules.find(r => r.lista_precio_id === listId);
                const currentPrice = Number(calculatedPrices[listId] || 0);
                if (currentPrice > 0) {
                    let newGainValue = '';
                    if (value === 'fijo') { // changed to 'fijo'
                        newGainValue = (currentPrice - nuevo_capp).toFixed(2);
                    } else if (value === 'porcentaje' && nuevo_capp > 0) { // changed to 'porcentaje'
                        newGainValue = (((currentPrice / nuevo_capp) - 1) * 100).toFixed(1);
                    }
                    updatedRule.valor_ganancia = newGainValue;
                }
            }
            recalculateAllPrices(newRules, nuevo_capp);
            return newRules;
        });
    };

    const handleSave = () => {
        const generalRule = priceRules.find(p => p.es_predeterminada);
        const gainValue = generalRule?.valor_ganancia;
        // Check if the value is null, an empty string, or not a finite number.
        if (gainValue === null || gainValue === '' || !isFinite(Number(gainValue))) {
            const errorMessage = 'Debe ingresar un valor de ganancia numérico.';
            setGeneralPriceRuleError(errorMessage);
            addToast({ message: `Para el precio General: ${errorMessage}`, type: 'error' });
            setActiveTab('prices'); // Asegura que el usuario vea el error
            return; // Detiene el proceso de guardado
        }

        setGeneralPriceRuleError('');
        onSave({
            ...localItem,
            prices: priceRules.map(p => ({
                lista_id: p.lista_precio_id,
                tipo_ganancia: p.tipo_ganancia,
                valor_ganancia: Number(p.valor_ganancia)
            }))
        });
    };

    const handleNextTab = () => {
        const newErrors: { cantidad?: string; costo_unitario?: string } = {};
        if (Number(localItem.cantidad || 0) <= 0) newErrors.cantidad = 'Debe ser > 0.';
        if (Number(localItem.costo_unitario || 0) <= 0) newErrors.costo_unitario = 'Debe ser > 0.';
        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) return;
        setActiveTab('prices');
    };

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
                    <img src=${item.imagen_principal || 'https://via.placeholder.com/150'} class="h-14 w-14 rounded-md object-cover flex-shrink-0 bg-white" />
                    <p class="font-bold text-lg text-gray-800">${item.producto_nombre}</p>
                </div>
                
                <${Tabs} tabs=${tabs} activeTab=${activeTab} onTabClick=${setActiveTab} />
                
                <div class="mt-4">
                    ${isLoading ? html`<div class="flex justify-center items-center h-full min-h-[24rem]"><${Spinner}/></div>` : html`
                        ${activeTab === 'inventory' && html`
                            <div class="space-y-3 animate-fade-in-down">
                                <div class="p-3 bg-white rounded-lg border space-y-3">
                                    <h4 class="text-sm font-semibold text-gray-800">Datos de la Compra</h4>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <${FormInput} label="Cantidad a Comprar" name="cantidad" type="number" value=${localItem.cantidad} onInput=${e => handleItemChange('cantidad', e.target.value)} error=${errors.cantidad} />
                                        <${FormInput} label="Costo Unitario (${currency})" name="costo_unitario" type="number" value=${localItem.costo_unitario} onInput=${e => handleItemChange('costo_unitario', e.target.value)} error=${errors.costo_unitario} />
                                    </div>
                                </div>
                                <div class="p-3 bg-slate-50 rounded-lg border space-y-3">
                                    <h4 class="text-sm font-semibold text-gray-800">Impacto en Costos</h4>
                                     <div class="p-2 bg-white rounded border">
                                        <h5 class="text-xs font-semibold text-gray-600 mb-1 text-center">Costo Promedio Ponderado (Global)</h5>
                                        <div class="flex justify-around text-center">
                                            <div><label class="block text-xs font-medium text-gray-500">Actual (CAPP)</label><p class="text-sm font-bold text-gray-700 mt-1">Bs ${capp_actual.toFixed(2)}</p></div>
                                            <div><label class="block text-xs font-medium text-gray-500">Nuevo</label><p class="text-sm font-bold text-primary mt-1">Bs ${nuevo_capp.toFixed(2)}</p></div>
                                        </div>
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
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    ${priceRules.map(p => html`
                                        <div key=${p.lista_precio_id} class="p-3 rounded-lg border ${p.es_predeterminada ? 'bg-blue-50/50' : 'bg-white'}">
                                            <p class="font-semibold text-gray-800 text-sm">${p.lista_nombre} ${p.es_predeterminada ? '(General)' : ''}</p>
                                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end mt-2">
                                                <div class="sm:col-span-2">
                                                    <label class="block text-xs font-medium text-gray-700">Ganancia</label>
                                                    <div class="mt-1 flex">
                                                        <input 
                                                            type="number" 
                                                            value=${p.valor_ganancia} 
                                                            onInput=${e => {
                                                                handleRuleChange(p.lista_precio_id, 'valor_ganancia', e.target.value);
                                                                if (p.es_predeterminada) {
                                                                    setGeneralPriceRuleError(''); // Limpia el error al escribir
                                                                }
                                                            }}
                                                            class=${`w-full block rounded-l-md border-0 p-1.5 text-gray-900 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-white ${p.es_predeterminada && generalPriceRuleError ? 'ring-red-500' : 'ring-gray-300'}`} 
                                                            placeholder="0.00" 
                                                        />
                                                        <div class="inline-flex rounded-r-md shadow-sm">
                                                            <button onClick=${() => handleRuleChange(p.lista_precio_id, 'tipo_ganancia', 'porcentaje')} class=${`relative inline-flex items-center rounded-l-none rounded-r-sm px-2 py-1.5 text-xs font-semibold ring-1 ring-inset ring-gray-300 focus:z-10 transition-colors ${p.tipo_ganancia === 'porcentaje' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>%</button>
                                                            <button onClick=${() => handleRuleChange(p.lista_precio_id, 'tipo_ganancia', 'fijo')} class=${`relative -ml-px inline-flex items-center rounded-r-md px-2 py-1.5 text-xs font-semibold ring-1 ring-inset ring-gray-300 focus:z-10 transition-colors ${p.tipo_ganancia === 'fijo' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Bs</button>
                                                        </div>
                                                    </div>
                                                    ${p.es_predeterminada && generalPriceRuleError && html`<p class="mt-1 text-sm text-red-600">${generalPriceRuleError}</p>`}
                                                </div>
                                                <div class="text-center sm:col-span-1">
                                                    <label class="block text-xs font-medium text-gray-500">Precio Venta</label>
                                                    <p class="font-bold text-primary text-base">Bs ${calculatedPrices[p.lista_precio_id] || '0.00'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `}
                    `}
                </div>
            </div>
        <//>
    `;
}

const ProveedorSelector = ({ formData, setFormData, proveedores, setIsProveedorFormOpen }) => {
    const [searchTerm, setSearchTerm] = useState(formData.proveedor_nombre);
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef(null);
    const itemRefs = useRef([]);

    const filteredProveedores = useMemo(() => {
        const allOptions = [
            { id: 'add_new', nombre: 'Añadir Nuevo Proveedor' },
            ...proveedores
        ];
        if (!searchTerm) return allOptions;
        const lowerCaseTerm = searchTerm.toLowerCase();
        return [
            { id: 'add_new', nombre: 'Añadir Nuevo Proveedor' },
            ...proveedores.filter(p => p.nombre.toLowerCase().includes(lowerCaseTerm) || p.nombre_contacto?.toLowerCase().includes(lowerCaseTerm))
        ];
    }, [searchTerm, proveedores]);
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    useEffect(() => {
        setSearchTerm(formData.proveedor_nombre);
    }, [formData.proveedor_nombre]);

    useEffect(() => {
        if (isDropdownOpen && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
            itemRefs.current[highlightedIndex].scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex, isDropdownOpen]);

    const handleSelect = (proveedor) => {
        if (proveedor.id === 'add_new') {
            setIsProveedorFormOpen(true);
        } else {
            setFormData(prev => ({...prev, proveedor_id: proveedor.id, proveedor_nombre: proveedor.nombre }));
        }
        setDropdownOpen(false);
        setHighlightedIndex(-1);
    };

    const handleKeyDown = (e) => {
        if (!isDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setDropdownOpen(true);
            setHighlightedIndex(0);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % filteredProveedores.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + filteredProveedores.length) % filteredProveedores.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0) {
                handleSelect(filteredProveedores[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setDropdownOpen(false);
            setHighlightedIndex(-1);
        }
    };

    return html`
        <div ref=${wrapperRef} class="relative">
            <label class="block text-sm font-medium text-gray-700">Proveedor</label>
             <input 
                type="text" 
                value=${searchTerm} 
                onInput=${e => { setSearchTerm(e.target.value); setDropdownOpen(true); }}
                onClick=${() => setDropdownOpen(true)}
                onFocus=${() => setDropdownOpen(true)}
                onKeyDown=${handleKeyDown}
                placeholder="Buscar o seleccionar proveedor..."
                class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
            />
            ${isDropdownOpen && html`
                <ul class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    ${filteredProveedores.map((p, index) => html`
                        <li 
                            key=${p.id}
                            ref=${el => itemRefs.current[index] = el}
                            onClick=${() => handleSelect(p)} 
                            class="relative cursor-pointer select-none py-2 pl-3 pr-9
                            ${p.id === 'add_new' ? 'text-primary font-semibold' : 'text-gray-900'}
                            ${highlightedIndex === index ? 'bg-primary-light' : 'hover:bg-slate-100'}"
                        >
                            ${p.id === 'add_new' ? html`<span class="flex items-center gap-2">${ICONS.add} ${p.nombre}</span>` : html`
                                <span class="block truncate font-medium">${p.nombre}</span>
                                <span class="block truncate text-xs text-gray-500">${p.nombre_contacto || 'Sin contacto'}</span>
                            `}
                        </li>
                    `)}
                </ul>
            `}
        </div>
    `;
};

const ProductoSearch = ({ productos, onProductSelected, onAddedProductClick, setIsProductFormOpen, addedProductIds }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef(null);
    const itemRefs = useRef([]);

    const filteredProductos = useMemo(() => {
        const allOptions = [{ id: 'add_new', nombre: 'Crear Nuevo Producto' }, ...productos];
        if (!searchTerm) return allOptions;
        const lower = searchTerm.toLowerCase();
        return [
            { id: 'add_new', nombre: 'Crear Nuevo Producto' },
            ...productos.filter(p => 
                p.nombre.toLowerCase().includes(lower) || 
                p.sku?.toLowerCase().includes(lower) || 
                p.modelo?.toLowerCase().includes(lower)
            )
        ];
    }, [searchTerm, productos]);
    
    const handleSelect = (producto) => {
        if (producto.id === 'add_new') {
            setIsProductFormOpen(true);
        } else if (addedProductIds.has(producto.id)) {
            onAddedProductClick(producto.id);
        } else {
            onProductSelected(producto);
        }
        setSearchTerm('');
        setDropdownOpen(false);
        setHighlightedIndex(-1);
    };

    useEffect(() => {
        const handleClickOutside = (e) => wrapperRef.current && !wrapperRef.current.contains(e.target) && setDropdownOpen(false);
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isDropdownOpen && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
            itemRefs.current[highlightedIndex].scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex, isDropdownOpen]);

    const handleKeyDown = (e) => {
        if (!isDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setDropdownOpen(true);
            setHighlightedIndex(0);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % filteredProductos.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + filteredProductos.length) % filteredProductos.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0) {
                handleSelect(filteredProductos[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setDropdownOpen(false);
            setHighlightedIndex(-1);
        }
    };

    return html`
        <div ref=${wrapperRef} class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">${ICONS.search}</div>
            <input
                type="text"
                placeholder="Buscar producto por SKU, nombre o modelo para añadirlo..."
                value=${searchTerm}
                onInput=${e => { setSearchTerm(e.target.value); setDropdownOpen(true); }}
                onClick=${() => setDropdownOpen(true)}
                onFocus=${() => setDropdownOpen(true)}
                onKeyDown=${handleKeyDown}
                class="block w-full rounded-md border-0 p-2 pl-10 bg-white text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            />
             ${isDropdownOpen && html`
                <ul class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    ${filteredProductos.map((p, index) => {
                        const isAdded = addedProductIds.has(p.id);
                        return html`
                        <li 
                            key=${p.id}
                            ref=${el => itemRefs.current[index] = el}
                            onClick=${() => handleSelect(p)} 
                            class="cursor-pointer select-none relative p-2 text-gray-900
                            ${p.id === 'add_new' ? 'text-primary font-semibold' : ''}
                            ${highlightedIndex === index ? 'bg-primary-light' : 'hover:bg-slate-100'}"
                        >
                            ${p.id === 'add_new' ? html`<span class="flex items-center gap-2">${ICONS.add} ${p.nombre}</span>` : html`
                                <div class="flex items-center gap-3">
                                     <div class="relative h-10 w-10 flex-shrink-0">
                                        ${p.imagen_principal ? html`<img src=${p.imagen_principal} class="h-10 w-10 rounded object-cover" />` : html`<div class="h-10 w-10 rounded bg-slate-100 flex items-center justify-center text-slate-400">${ICONS.products}</div>`}
                                        ${isAdded && html`
                                            <div class="absolute inset-0 bg-green-600/70 flex items-center justify-center rounded">
                                                <span class="material-symbols-outlined text-white" style="font-size: 2rem;">check_circle</span>
                                            </div>
                                        `}
                                    </div>
                                    <div class="flex-grow min-w-0">
                                        <p class="font-medium truncate">${p.nombre}</p>
                                        <p class="text-xs text-gray-500 truncate">${p.modelo || `SKU: ${p.sku || 'N/A'}`}</p>
                                    </div>
                                    <div class="flex-shrink-0 text-xs text-right">
                                        <p class="font-semibold text-gray-700">Stock</p>
                                        <p>${p.stock_sucursal}</p>
                                    </div>
                                </div>
                            `}
                        </li>
                    `})}
                     ${filteredProductos.length === 0 && searchTerm && html`
                        <li class="relative select-none py-2 px-4 text-gray-700">No se encontraron productos.</li>
                    `}
                </ul>
            `}
        </div>
    `;
};

function Step1({ formData, handleInput, setFormData, proveedores, setIsProveedorFormOpen }) {
    return html`
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Información General</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="md:col-span-1">
                <${ProveedorSelector} formData=${formData} setFormData=${setFormData} proveedores=${proveedores} setIsProveedorFormOpen=${setIsProveedorFormOpen} />
            </div>
            <div class="md:col-span-1">
                 <${FormInput} label="N° de Factura o Nota" name="n_factura" type="text" value=${formData.n_factura} onInput=${handleInput} required=${false} />
            </div>
            <div class="md:col-span-1">
                <${FormInput} label="Fecha de Compra" name="fecha" type="date" value=${formData.fecha} onInput=${handleInput} />
            </div>
            <div class="md:col-span-1 grid grid-cols-2 gap-4">
                <div>
                    <label for="moneda" class="block text-sm font-medium text-gray-700">Moneda</label>
                    <select id="moneda" name="moneda" value=${formData.moneda} onInput=${handleInput} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm">
                        <option value="BOB">BOB</option>
                        <option value="USD">USD</option>
                    </select>
                </div>
                ${formData.moneda === 'USD' && html`
                    <div>
                        <${FormInput} label="Tasa de Cambio" name="tasa_cambio" type="number" value=${formData.tasa_cambio} onInput=${handleInput} />
                    </div>
                `}
            </div>
        </div>
    `;
}

const Step2 = ({ formData, handleEditItem, handleRemoveItem, total, productos, onProductSelected, onAddedProductClick, setIsProductFormOpen, addedProductIds }) => (
    html`
    <h3 class="text-lg font-semibold text-gray-900 mb-4">Detalle de Productos</h3>
    <div class="mb-4">
        <${ProductoSearch} productos=${productos} onProductSelected=${onProductSelected} onAddedProductClick=${onAddedProductClick} setIsProductFormOpen=${setIsProductFormOpen} addedProductIds=${addedProductIds} />
    </div>

    ${formData.items.length === 0 ? html`
        <div class="text-center py-10 rounded-lg border-2 border-dashed border-gray-200">
            <p class="text-gray-500">Añade productos usando el buscador.</p>
        </div>
    ` : html`
        <div class="space-y-3 max-h-96 overflow-y-auto pr-2 -mr-2">
            <!-- Mobile/Tablet Card View -->
            <div class="md:hidden space-y-3">
                ${formData.items.map((item, index) => html`
                    <div key=${item.producto_id} class="p-3 bg-slate-50 rounded-lg border">
                        <div class="flex items-center gap-3">
                            <div class="flex-shrink-0">
                                ${item.imagen_principal ? html`<img src=${item.imagen_principal} class="h-14 w-14 rounded-md object-cover bg-white" />` : html`<div class="h-14 w-14 rounded-md bg-white flex items-center justify-center text-slate-400">${ICONS.products}</div>`}
                            </div>
                            <div class="flex-grow min-w-0">
                                <p class="font-medium text-sm text-gray-800 truncate">${item.producto_nombre}</p>
                                <p class="text-xs text-gray-500">Subtotal: <span class="font-bold text-primary">${(item.cantidad * item.costo_unitario).toFixed(2)}</span></p>
                            </div>
                            <div class="flex-shrink-0 flex items-center gap-1">
                                <button onClick=${() => handleEditItem(item)} class="p-2 bg-white rounded-md shadow-sm text-gray-500 hover:bg-blue-100 hover:text-blue-600">${ICONS.edit}</button>
                                <button onClick=${() => handleRemoveItem(index)} class="p-2 bg-white rounded-md shadow-sm text-gray-500 hover:bg-red-100 hover:text-red-600">${ICONS.delete}</button>
                            </div>
                        </div>
                        <div class="mt-2 pt-2 border-t grid grid-cols-2 gap-2 text-center">
                            <div>
                                <p class="text-xs text-gray-500">Cantidad</p>
                                <p class="font-semibold text-gray-900">${item.cantidad}</p>
                            </div>
                             <div>
                                <p class="text-xs text-gray-500">Costo Unitario</p>
                                <p class="font-semibold text-gray-900">${Number(item.costo_unitario).toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                `)}
            </div>

            <!-- Desktop Table View -->
            <div class="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                <table class="min-w-full divide-y divide-gray-300">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Producto</th>
                            <th scope="col" class="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Cantidad</th>
                            <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Costo U. (${formData.moneda})</th>
                            <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Subtotal (${formData.moneda})</th>
                            <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Acciones</span></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white">
                        ${formData.items.map((item, index) => html`
                            <tr key=${item.producto_id}>
                                <td class="py-2 pl-4 pr-3 text-sm sm:pl-6">
                                    <div class="flex items-center">
                                        <div class="h-11 w-11 flex-shrink-0">
                                            ${item.imagen_principal ? html`<img class="h-11 w-11 rounded-md object-cover bg-white" src=${item.imagen_principal} />` : html`<div class="h-11 w-11 rounded-md bg-white flex items-center justify-center text-slate-400 border">${ICONS.products}</div>`}
                                        </div>
                                        <div class="ml-4 min-w-0">
                                            <div class="font-medium text-gray-900 truncate">${item.producto_nombre}</div>
                                            <div class="text-gray-500 text-xs truncate">${item.modelo || `SKU: ${item.sku || 'N/A'}`}</div>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-3 py-4 text-sm text-center font-medium text-gray-800">${item.cantidad}</td>
                                <td class="px-3 py-4 text-sm text-right font-medium text-gray-800">${Number(item.costo_unitario).toFixed(2)}</td>
                                <td class="px-3 py-4 text-sm text-right font-bold text-primary">${(item.cantidad * item.costo_unitario).toFixed(2)}</td>
                                <td class="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                    <div class="flex items-center justify-end gap-2">
                                        <button onClick=${() => handleEditItem(item)} class="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-md">${ICONS.edit}</button>
                                        <button onClick=${() => handleRemoveItem(index)} class="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-md">${ICONS.delete}</button>
                                    </div>
                                </td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        </div>
    `}
    
    <div class="mt-4 pt-4 border-t text-right">
         <p class="text-sm text-gray-500">Total Compra</p>
         <p class="text-2xl font-bold text-gray-900">${total.toFixed(2)} <span class="text-base font-normal">${formData.moneda}</span></p>
    </div>
    `
);

const Step3 = ({ formData, handleInput, setFormData, total }) => {
    const calculateDaysRemaining = () => {
        if (!formData.fecha_vencimiento) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueDate = new Date(formData.fecha_vencimiento.replace(/-/g, '/'));
        
        if (isNaN(dueDate.getTime())) return null;

        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return html`<span class="text-sm font-semibold text-red-600">Vencido hace ${Math.abs(diffDays)} días</span>`;
        if (diffDays === 0) return html`<span class="text-sm font-semibold text-amber-600">Vence hoy</span>`;
        return html`<span class="text-sm font-semibold text-green-700">Vence en ${diffDays} días</span>`;
    };
    const daysRemaining = calculateDaysRemaining();

    return html`
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Condiciones de Pago</h3>
        <div>
            <label class="block text-sm font-medium text-gray-700">Tipo de Compra</label>
            <div class="mt-2 grid grid-cols-2 gap-3">
                <button type="button" onClick=${() => setFormData({...formData, tipo_pago: 'Contado'})} class="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${formData.tipo_pago === 'Contado' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.paid} Al Contado</button>
                <button type="button" onClick=${() => setFormData({...formData, tipo_pago: 'Crédito'})} class="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${formData.tipo_pago === 'Crédito' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.credit_score} A Crédito</button>
            </div>
        </div>
        ${formData.tipo_pago === 'Crédito' && html`
            <div class="mt-4 space-y-4 animate-fade-in-down">
                 <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <${FormInput} label="Fecha de Vencimiento" name="fecha_vencimiento" type="date" value=${formData.fecha_vencimiento} onInput=${handleInput} />
                         ${daysRemaining && html`<div class="mt-2 text-right">${daysRemaining}</div>`}
                    </div>
                    <${FormInput} label="Abono Inicial (Opcional)" name="abono_inicial" type="number" value=${formData.abono_inicial} onInput=${handleInput} required=${false} />
                </div>
                <div>
                     <label class="block text-sm font-medium text-gray-700">Método de Pago del Abono</label>
                     <div class="mt-2 grid grid-cols-3 gap-3">
                        <button type="button" onClick=${() => setFormData({...formData, metodo_abono_inicial: 'Efectivo'})} class="flex flex-col items-center justify-center p-2 rounded-md text-sm font-semibold transition-colors ${formData.metodo_abono_inicial === 'Efectivo' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.payments} Efectivo</button>
                        <button type="button" onClick=${() => setFormData({...formData, metodo_abono_inicial: 'QR'})} class="flex flex-col items-center justify-center p-2 rounded-md text-sm font-semibold transition-colors ${formData.metodo_abono_inicial === 'QR' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.qr_code_2} QR</button>
                        <button type="button" onClick=${() => setFormData({...formData, metodo_abono_inicial: 'Tarjeta'})} class="flex flex-col items-center justify-center p-2 rounded-md text-sm font-semibold transition-colors ${formData.metodo_abono_inicial === 'Tarjeta' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}">${ICONS.credit_card} Tarjeta</button>
                     </div>
                </div>
            </div>
        `}
        <div class="mt-6 p-4 rounded-lg bg-slate-50 border">
            <h4 class="font-semibold text-gray-800">Resumen</h4>
            <dl class="mt-2 text-sm space-y-1">
                <div class="flex justify-between">
                    <dt class="text-gray-600">Total:</dt>
                    <dd class="font-medium text-gray-900">${total.toFixed(2)} ${formData.moneda}</dd>
                </div>
                <div class="flex justify-between">
                    <dt class="text-gray-600">Tipo Pago:</dt>
                    <dd class="font-medium text-gray-900">${formData.tipo_pago}</dd>
                </div>
                ${formData.tipo_pago === 'Crédito' && html`
                    <div class="flex justify-between">
                        <dt class="text-gray-600">Abono Inicial:</dt>
                        <dd class="font-medium text-gray-900">${Number(formData.abono_inicial).toFixed(2)} ${formData.moneda}</dd>
                    </div>
                    <div class="flex justify-between font-bold">
                        <dt class="text-gray-900">Saldo Pendiente:</dt>
                        <dd class="text-red-600">${(total - Number(formData.abono_inicial)).toFixed(2)} ${formData.moneda}</dd>
                    </div>
                `}
            </dl>
        </div>
    `
};

function getLocalDateString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
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
        fecha: getLocalDateString(),
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
                supabase.rpc('get_company_products_for_dropdown')
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
        formData.items.reduce((sum, item) => sum + (Number(item.cantidad || 0) * Number(item.costo_unitario || 0)), 0)
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
            cantidad: 1,
            costo_unitario: '',
            stock_sucursal: product.stock_sucursal,
            precio_compra: product.precio_compra,
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
                    cantidad: Number(item.cantidad),
                    costo_unitario: Number(item.costo_unitario),
                    precios: item.prices
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
                            ${s.status === 'complete' ? html`
                            <a href="#" onClick=${(e) => { e.preventDefault(); if (index < step - 1) setStep(index + 1); }} class="group flex flex-col border-l-4 border-primary py-2 pl-4 transition-colors hover:border-primary-dark md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4">
                                <span class="text-sm font-medium text-primary transition-colors">${`Paso ${index + 1}`}</span>
                                <span class="text-sm font-medium text-gray-900">${s.name}</span>
                            </a>
                            ` : s.status === 'current' ? html`
                            <div class="flex flex-col border-l-4 border-primary py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4" aria-current="step">
                                <span class="text-sm font-medium text-primary">${`Paso ${index + 1}`}</span>
                                <span class="text-sm font-medium text-gray-900">${s.name}</span>
                            </div>
                            ` : html`
                            <div class="group flex flex-col border-l-4 border-gray-200 py-2 pl-4 transition-colors md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4">
                                <span class="text-sm font-medium text-gray-500 transition-colors">${`Paso ${index + 1}`}</span>
                                <span class="text-sm font-medium text-gray-500">${s.name}</span>
                            </div>
                            `}
                        </li>
                        `)}
                    </ol>
                </nav>
                
                <div class="min-h-[30rem]">
                    ${step === 1 && html`<${Step1} formData=${formData} handleInput=${handleInput} setFormData=${setFormData} proveedores=${proveedores} setIsProveedorFormOpen=${setIsProveedorFormOpen} />`}
                    ${step === 2 && html`<${Step2} formData=${formData} handleEditItem=${handleEditItem} handleRemoveItem=${handleRemoveItem} total=${total} productos=${productos} onProductSelected=${handleProductSelected} onAddedProductClick=${handleAddedProductClick} setIsProductFormOpen=${setIsProductFormOpen} addedProductIds=${addedProductIds} />`}
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