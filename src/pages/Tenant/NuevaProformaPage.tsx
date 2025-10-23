/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useRef, useCallback } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../hooks/useToast.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { useLoading } from '../../hooks/useLoading.js';
import { FilterBar, AdvancedFilterPanel } from '../../components/shared/FilterComponents.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';
import { ClienteFormModal } from '../../components/modals/ClienteFormModal.js';
import { Avatar } from '../../components/Avatar.js';
import { useRealtimeListener } from '../../hooks/useRealtime.js';
import { FormInput, FormSelect } from '../../components/FormComponents.js';
import { CameraScanner } from '../../components/CameraScanner.js';
import { Spinner } from '../../components/Spinner.js';
import { useNuevaProforma } from '../../contexts/StatePersistence.js';
import { StockStatusPill } from '../../components/StockStatusPill.js';


// --- Local Components adapted from TerminalVentaPage.tsx for Proforma context ---

const ClienteSelector = ({ clients, selectedClientId, onSelect, onAddNew }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const wrapperRef = useRef(null);

    const selectedClient = useMemo(() => {
        if (!selectedClientId) return null;
        return clients.find(c => c.id === selectedClientId);
    }, [selectedClientId, clients]);
    
    useEffect(() => {
        setSearchTerm(selectedClient ? selectedClient.nombre : '');
    }, [selectedClient]);

    const filteredClients = useMemo(() => {
        const allOptions = [{ id: 'add_new', nombre: 'Añadir Nuevo Cliente' }, ...clients];
        if (!searchTerm || (selectedClient && searchTerm === selectedClient.nombre)) {
             return allOptions;
        }
        const lowerCaseTerm = searchTerm.toLowerCase();
        return [
            { id: 'add_new', nombre: 'Añadir Nuevo Cliente' },
            ...clients.filter(c => c.nombre.toLowerCase().includes(lowerCaseTerm))
        ];
    }, [searchTerm, clients, selectedClient]);

     useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [wrapperRef]);

    const handleSelect = (client) => {
        if (client.id === 'add_new') {
            onAddNew();
        } else {
            onSelect(client.id);
        }
        setDropdownOpen(false);
    };
    
    const handleClear = () => {
        setSearchTerm('');
        onSelect(null);
        wrapperRef.current?.querySelector('input')?.focus();
    };

    const clearButton = html`
        <button type="button" onClick=${handleClear} class="text-gray-400 hover:text-gray-600">${ICONS.close}</button>
    `;

    return html`
        <div ref=${wrapperRef} class="relative">
            <${FormInput}
                label="Cliente"
                name="client-search"
                type="text"
                value=${searchTerm}
                onInput=${e => { setSearchTerm(e.target.value); if (!isDropdownOpen) setDropdownOpen(true); }}
                onFocus=${(e) => { e.target.select(); setDropdownOpen(true); }}
                placeholder="Buscar cliente..."
                icon=${ICONS.search}
                required=${true}
                rightElement=${searchTerm ? clearButton : null}
            />
             ${isDropdownOpen && html`
                <ul class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    ${filteredClients.map((c) => html`
                        <li key=${c.id} onClick=${() => handleSelect(c)} class="relative cursor-pointer select-none p-2 ${c.id === 'add_new' ? 'text-primary font-semibold' : 'text-gray-900'} hover:bg-primary-light">
                           ${c.id === 'add_new' ? html`<span class="flex items-center gap-2">${ICONS.add} ${c.nombre}</span>` : html`
                                <div class="flex items-center gap-3">
                                    <${Avatar} name=${c.nombre} avatarUrl=${c.avatar_url} size="h-8 w-8" />
                                    <div><p class="font-medium truncate">${c.nombre}</p><p class="text-xs text-gray-500 truncate">${c.telefono || 'Sin teléfono'}</p></div>
                                </div>
                           `}
                        </li>
                    `)}
                </ul>
            `}
        </div>
    `;
};

const SetPricePopover = ({ item, targetElement, onClose, onApply, getPriceInfo, addToast, formatCurrency }) => {
    const { originalPrice, minPrice } = useMemo(() => {
        const priceInfo = getPriceInfo(item.product);
        if (!priceInfo) return { originalPrice: 0, minPrice: 0 };
        const venta = Number(priceInfo.precio || 0);
        const maxGanancia = Number(priceInfo.ganancia_maxima || 0);
        const minGanancia = Number(priceInfo.ganancia_minima || 0);
        const cost = venta - maxGanancia;
        const minimumPrice = cost + minGanancia;
        return { originalPrice: venta, minPrice: minimumPrice };
    }, [getPriceInfo, item.product]);

    const [newPrice, setNewPrice] = useState('');
    const popoverRef = useRef(null);

    useEffect(() => {
        popoverRef.current?.querySelector('input')?.focus();
        const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const handleApply = () => {
        const numPrice = Number(newPrice);
        if (isNaN(numPrice) || numPrice < 0) {
            addToast({ message: 'Por favor, ingrese un precio válido.', type: 'error' });
            return;
        }
        if (numPrice < minPrice) {
            addToast({ message: `El precio no puede ser inferior a ${formatCurrency(minPrice)}.`, type: 'error' });
            return;
        }
        if (numPrice > originalPrice) {
            addToast({ message: `El precio no puede ser superior al original de ${formatCurrency(originalPrice)}.`, type: 'error' });
            return;
        }
        onApply(item.product.id, numPrice);
    };

    if (!targetElement) return null;

    const targetRect = targetElement.getBoundingClientRect();
    const popoverStyle = {
        position: 'fixed',
        top: `${targetRect.bottom + 8}px`,
        left: `${targetRect.left + (targetRect.width / 2)}px`,
        transform: 'translateX(-50%)',
    };

    return html`
        <div ref=${popoverRef} style=${popoverStyle} class="z-50 w-64 bg-white rounded-lg shadow-xl border p-4 animate-fade-in-down">
            <h4 class="text-sm font-bold text-gray-800">Establecer Precio Unitario</h4>
            <p class="text-xs text-gray-500 mb-2">Mínimo: <span class="font-semibold text-amber-600">${formatCurrency(minPrice)}</span></p>
            <div class="relative">
                <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-sm">Bs</span>
                <input 
                    type="number" 
                    value=${newPrice} 
                    onInput=${e => setNewPrice(e.target.value)} 
                    onKeyDown=${e => e.key === 'Enter' && handleApply()}
                    placeholder=${originalPrice.toFixed(2)}
                    class="block w-full rounded-md border border-gray-300 pl-8 p-2 text-gray-900 bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25"
                />
            </div>
            <div class="mt-4 flex justify-end gap-2">
                <button onClick=${onClose} class="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Cancelar</button>
                <button onClick=${handleApply} class="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">Aplicar</button>
            </div>
        </div>
    `;
};

const ProductCard = ({ product, onAction, defaultPrice, quantityInCart, formatCurrency }) => {
    const hasPrice = defaultPrice > 0;
    const isAvailable = hasPrice; // Stock check removed for proformas

    return html`
        <div class="group relative flex flex-col rounded-lg bg-white shadow-md border overflow-hidden ${!isAvailable ? 'opacity-75' : ''}">
            <button 
                onClick=${() => onAction(product, isAvailable)}
                class="flex flex-col flex-grow focus:outline-none cursor-pointer"
            >
                <div class="relative aspect-square w-full bg-gray-100 overflow-hidden">
                    <img src=${product.imagen_principal || NO_IMAGE_ICON_URL} alt=${product.nombre} class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                     ${quantityInCart > 0 && html`
                        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                             <span class="material-symbols-outlined text-green-400 text-8xl" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">check_circle</span>
                        </div>
                    `}
                </div>
                <div class="flex flex-1 flex-col p-2 text-left">
                    <div class="flex-grow min-h-[3.5rem]">
                        <h3 class="text-sm font-semibold text-gray-800 leading-tight" title=${product.nombre}>${product.nombre}</h3>
                        <p class="text-xs text-gray-500 leading-tight" title=${product.modelo || ''}>${product.modelo || 'Sin modelo'}</p>
                    </div>
                    <div class="mt-1">
                         ${hasPrice ? html`
                            <p class="text-sm font-bold text-gray-900">${formatCurrency(defaultPrice)}</p>
                        ` : html`
                             <p class="text-xs font-bold text-amber-600">Precio no asignado</p>
                        `}
                    </div>
                </div>
            </button>
            <div class="flex items-center justify-between px-2 pb-1 text-xs text-gray-500">
                <${StockStatusPill} stock=${product.stock_sucursal} minStock=${product.stock_minimo_sucursal || 0} />
            </div>
            ${!hasPrice && html`
                <div class="absolute inset-0 bg-white/60 flex items-center justify-center pointer-events-none">
                    <span class="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        SIN PRECIO
                    </span>
                </div>
            `}
        </div>
    `;
};

const CartItem = ({ item, onUpdateQuantity, onRemove, formatCurrency, effectivePrice, originalPrice, hasCustomPrice, onOpenPricePopover }) => {
    return html`
        <div class="relative flex items-center gap-3 py-3 bg-white">
            <img src=${item.product.imagen_principal || NO_IMAGE_ICON_URL} alt=${item.product.nombre} class="h-14 w-14 rounded-md object-cover border" />
            <div class="flex-grow">
                <p class="text-sm font-semibold text-gray-800">${item.product.nombre}</p>
                <p class="text-xs text-gray-500">
                    ${hasCustomPrice && html`<span class="line-through mr-1">${formatCurrency(originalPrice)}</span>`}
                    <span class=${hasCustomPrice ? 'font-bold text-primary' : ''}>${formatCurrency(effectivePrice)} c/u</span>
                </p>
                <div class="flex items-center gap-2 mt-1">
                    <button onClick=${() => onUpdateQuantity(item.product.id, item.quantity - 1)} class="text-gray-500 hover:text-red-600">${ICONS.remove_circle}</button>
                    <input type="number" value=${item.quantity} onInput=${e => onUpdateQuantity(item.product.id, parseInt(e.target.value, 10))} class="w-14 text-center rounded-md border-gray-300 shadow-sm p-1 text-sm font-semibold focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 bg-white text-gray-900" min="1" />
                    <button onClick=${() => onUpdateQuantity(item.product.id, item.quantity + 1)} class="text-gray-500 hover:text-green-600">${ICONS.add_circle}</button>
                    <button onClick=${(e) => onOpenPricePopover(e, item)} title="Establecer precio" class="ml-2 p-1 rounded-full ${hasCustomPrice ? 'text-green-600 bg-green-100' : 'text-gray-500'} hover:bg-green-100 hover:text-green-600">${ICONS.local_offer}</button>
                </div>
            </div>
            <div class="text-right">
                <p class="text-base font-bold text-gray-900">${formatCurrency(effectivePrice * item.quantity)}</p>
                <button onClick=${() => onRemove(item.product.id)} title="Eliminar" class="mt-1 p-1 rounded-full text-gray-500 hover:text-red-600">${ICONS.delete}</button>
            </div>
        </div>
    `;
};

const CartPanel = ({ companyInfo, posData, clearProformaCart, getActivePriceForProduct, handleUpdateQuantity, handleRemoveFromCart, totals, handleDiscountChange, onFinalize, onOpenPricePopover, formatCurrency, cart, customPrices, selectedClientId, setSelectedClientId, activePriceListId, setActivePriceListId, taxRate, setTaxRate, discountValue, setIsClienteFormOpen }) => {
    const { listas_precios, catalogo_web } = companyInfo.planDetails.features;

    const availablePriceLists = useMemo(() => {
        if (listas_precios) return posData.price_lists;
        if (!listas_precios && catalogo_web) return posData.price_lists.filter(pl => pl.es_predeterminada || pl.nombre === 'Ofertas Web');
        return posData.price_lists.filter(pl => pl.es_predeterminada);
    }, [posData.price_lists, listas_precios, catalogo_web]);

    const isPriceListDisabled = !listas_precios && !catalogo_web;

    return html`
        <div class="p-4 flex-shrink-0 border-b flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-800">Carrito de Proforma</h2>
            <button onClick=${clearProformaCart} disabled=${cart.length === 0} class="p-2 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600 disabled:text-gray-300 disabled:bg-transparent disabled:cursor-not-allowed transition-colors" title="Vaciar Carrito">${ICONS.delete}</button>
        </div>

        <div class="p-4 flex-shrink-0 border-b">
             <div class="flex items-start gap-4">
                <div class="w-2/3">
                    <${ClienteSelector} clients=${posData.clients || []} selectedClientId=${selectedClientId} onSelect=${setSelectedClientId} onAddNew=${() => setIsClienteFormOpen(true)} />
                </div>
                <div class="w-1/3">
                    <${FormSelect} 
                        label="Lista de Precios"
                        name="price-list"
                        value=${activePriceListId}
                        onInput=${e => setActivePriceListId(e.target.value)}
                        disabled=${isPriceListDisabled}
                    >
                        ${availablePriceLists.map(pl => html`<option value=${pl.id}>${pl.nombre}</option>`)}
                    <//>
                </div>
            </div>
        </div>

        <div class="flex-grow overflow-y-auto p-4">
            ${cart.length === 0 ? html`
                <div class="h-full flex flex-col items-center justify-center text-center text-gray-500">
                    <div class="text-5xl">${ICONS.edit_note}</div>
                    <p class="mt-2 font-semibold">Carrito Vacío</p>
                    <p class="text-sm">Añade productos desde el catálogo.</p>
                </div>
            ` : cart.map((item, index) => {
                const originalPrice = getActivePriceForProduct(item.product);
                const customPrice = customPrices[item.product.id]?.newPrice;
                const effectivePrice = customPrice ?? originalPrice;
                const hasCustomPrice = customPrice !== undefined;
                return html`
                <div class="border-b ${index === cart.length - 1 ? 'border-transparent' : 'border-gray-200'}">
                    <${CartItem} item=${item} onUpdateQuantity=${handleUpdateQuantity} onRemove=${handleRemoveFromCart} onOpenPricePopover=${onOpenPricePopover} formatCurrency=${formatCurrency} effectivePrice=${effectivePrice} originalPrice=${originalPrice} hasCustomPrice=${hasCustomPrice} />
                </div>
                `;
            })}
        </div>

        <div class="p-4 bg-gray-50 border-t flex-shrink-0 space-y-4">
             <div class="space-y-2 text-sm">
                <div class="flex justify-between items-center"><span class="text-gray-600">Subtotal</span><span class="font-medium text-gray-800">${formatCurrency(totals.subtotal)}</span></div>
                <div class="flex justify-between items-center"><span class="text-gray-600">Impuesto</span><div class="flex items-center gap-2"><div class="flex items-center rounded-md shadow-sm bg-white border border-gray-300 focus-within:border-[#0d6efd] focus-within:ring-4 focus-within:ring-[#0d6efd]/25 transition-colors duration-150 w-24"><span class="pl-2 text-gray-500 text-sm">%</span><input type="number" value=${taxRate} onInput=${e => setTaxRate(e.target.value)} placeholder="0" class="w-full border-0 bg-transparent p-1 text-sm text-right text-gray-900 focus:ring-0 focus:outline-none" /></div><span class="font-medium text-gray-800 w-24 text-right">+ ${formatCurrency(totals.taxAmount)}</span></div></div>
                <div class="flex justify-between items-start"><span class="text-gray-600 pt-1">Descuento</span><div class="flex flex-col items-end"><div class="flex items-center gap-2"><div class="flex items-center rounded-md shadow-sm bg-white border border-gray-300 focus-within:border-[#0d6efd] focus-within:ring-4 focus-within:ring-[#0d6efd]/25 w-24"><span class="pl-2 text-gray-500 text-sm">Bs</span><input type="number" value=${discountValue} onInput=${handleDiscountChange} placeholder="Global" class="w-full border-0 bg-transparent p-1 text-sm text-right text-gray-900 focus:ring-0 focus:outline-none"/></div><span class="font-medium text-red-600 w-24 text-right">- ${formatCurrency(totals.totalDiscount)}</span></div>${totals.maxGlobalDiscount > 0 && html`<p class="text-xs text-gray-500 mt-1">Máx: ${formatCurrency(totals.maxGlobalDiscount)}</p>`}</div></div>
                <div class="flex justify-between items-baseline text-2xl font-bold border-t pt-2 mt-2"><span class="text-gray-900">Total</span><span class="text-primary">${formatCurrency(totals.finalTotal)}</span></div>
            </div>
            <button onClick=${onFinalize} disabled=${cart.length === 0} class="w-full flex items-center justify-center gap-2 text-center rounded-lg px-5 py-3 text-base font-semibold text-white shadow-sm bg-green-600 hover:bg-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed">${ICONS.edit_note} Generar Proforma</button>
        </div>
    `;
};

const QuickAccessButton = ({ product, onClick, formatCurrency }) => {
    return html`
        <button 
            onClick=${onClick}
            class="group relative flex flex-col items-center justify-center text-center p-2 rounded-lg bg-slate-50 border hover:bg-primary-light hover:border-primary transition-all duration-150"
        >
            <div class="w-12 h-12 mb-1">
                <img src=${product.imagen_principal || NO_IMAGE_ICON_URL} alt=${product.nombre} class="w-full h-full object-contain" />
            </div>
            <p class="text-xs font-semibold text-gray-700 group-hover:text-primary-dark leading-tight" style=${{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                ${product.nombre}
            </p>
            <p class="text-xs font-bold text-gray-800">${formatCurrency(product.precio_base)}</p>
        </button>
    `;
};

const ProformaFinalizeModal = ({ isOpen, onClose, onConfirm, isLoading, fechaVencimiento, setFechaVencimiento, notas, setNotas }) => {
    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${onConfirm}
            title="Finalizar Proforma"
            confirmText=${isLoading ? html`<${Spinner}/>` : 'Confirmar y Generar'}
            icon=${ICONS.edit_note}
        >
            <div class="space-y-4">
                <${FormInput} label="Fecha de Vencimiento" name="fecha_vencimiento" type="date" value=${fechaVencimiento} onInput=${e => setFechaVencimiento(e.target.value)} />
                <div>
                    <label for="notas" class="block text-sm font-medium leading-6 text-gray-900">Notas y Términos (Opcional)</label>
                    <div class="mt-2">
                        <textarea 
                            id="notas" 
                            name="notas" 
                            rows="4" 
                            value=${notas} 
                            onInput=${e => setNotas(e.target.value)} 
                            class="block w-full rounded-md border border-gray-300 shadow-sm p-2 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25"
                        ></textarea>
                    </div>
                </div>
            </div>
        <//>
    `;
};

const initialFilters = {
    searchTerm: '',
    status: 'all',
    category_ids: [],
    brand_names: [],
};

const posStatusOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'in_stock', label: 'En Stock' },
    { value: 'most_sold', label: 'Los Más Vendidos' },
    { value: 'on_sale', label: 'En Oferta' },
    { value: 'new_arrival', label: 'Nuevos Productos' },
];

export function NuevaProformaPage({ user, onLogout, onProfileUpdate, companyInfo, navigate }) {
    const breadcrumbs = [ { name: 'Proformas', href: '#/proformas' }, { name: 'Nueva Proforma', href: '#/proformas/nueva' }];
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    const { cart, setCart, customPrices, setCustomPrices, selectedClientId, setSelectedClientId, activePriceListId, setActivePriceListId, taxRate, setTaxRate, discountValue, setDiscountValue, clearProformaCart } = useNuevaProforma();

    const [posData, setPosData] = useState({ products: [], price_lists: [], clients: [] });
    const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [filters, setFilters] = useState(initialFilters);
    const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ categories: [], brands: [] });
    const [isClienteFormOpen, setIsClienteFormOpen] = useState(false);
    const [isCartSidebarOpen, setCartSidebarOpen] = useState(false);
    const [skuInput, setSkuInput] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [pricePopover, setPricePopover] = useState({ isOpen: false, item: null, target: null });
    
    const [fechaVencimiento, setFechaVencimiento] = useState('');
    const [notas, setNotas] = useState('');

    const handleOpenFinalizeModal = () => {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        setFechaVencimiento(dueDate.toISOString().split('T')[0]);
        setNotas('Tenga en cuenta que los precios y el stock pueden variar, gracias.');
        setIsFinalizeModalOpen(true);
    };

    const formatCurrency = useCallback((value) => {
        const number = Number(value || 0);
        return `${companyInfo.monedaSimbolo} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }, [companyInfo.monedaSimbolo]);

    const fetchData = useCallback(async () => {
        try {
            const [posDataRes, clientsRes, optionsRes] = await Promise.all([
                supabase.rpc('get_pos_data'),
                supabase.rpc('get_company_clients'),
                supabase.rpc('get_inventory_filter_data')
            ]);
            if (posDataRes.error) throw posDataRes.error;
            if (clientsRes.error) throw clientsRes.error;
            if (optionsRes.error) throw optionsRes.error;

            setPosData({ ...(posDataRes.data || { products: [], price_lists: [] }), clients: clientsRes.data || [] });
            setFilterOptions(optionsRes.data || { categories: [], brands: [] });

            if (activePriceListId === null && posDataRes.data?.price_lists) {
                const defaultList = posDataRes.data.price_lists.find(pl => pl.es_predeterminada);
                if (defaultList) setActivePriceListId(defaultList.id);
            }
        } catch (err) {
            addToast({ message: `Error crítico al cargar datos: ${err.message}`, type: 'error' });
        }
    }, [addToast, activePriceListId, setActivePriceListId]);

    const internalFetch = useCallback(async () => {
        startLoading();
        try { await fetchData(); } finally { stopLoading(); }
    }, [fetchData, startLoading, stopLoading]);

    useEffect(() => { internalFetch(); }, [internalFetch]);
    useRealtimeListener(internalFetch);

    const isPriceRuleActive = (priceInfo) => priceInfo && Number(priceInfo.ganancia_maxima) > 0;
    const getDefaultPriceForProduct = (product) => {
        const defaultListId = posData.price_lists.find(pl => pl.es_predeterminada)?.id;
        return product.prices?.[defaultListId]?.precio ?? 0;
    };
    const getActivePriceForProduct = (product) => {
        const activePriceInfo = product.prices?.[activePriceListId];
        if (isPriceRuleActive(activePriceInfo)) return activePriceInfo.precio;
        return getDefaultPriceForProduct(product);
    };
     const getPriceInfoForProduct = (product) => {
        const activePriceInfo = product.prices?.[activePriceListId];
        if (isPriceRuleActive(activePriceInfo)) return activePriceInfo;
        const defaultListId = posData.price_lists.find(pl => pl.es_predeterminada)?.id;
        return product.prices?.[defaultListId] || { precio: 0, ganancia_maxima: 0, ganancia_minima: 0 };
    };

    const handleAddToCart = (product) => {
        setCart((currentCart) => {
            const existingItem = currentCart.find(item => item.product.id === product.id);
            if (existingItem) {
                return currentCart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...currentCart, { product, quantity: 1 }];
        });
    };

    const handleProductAction = (product, isAvailable) => {
        if (isAvailable) {
            handleAddToCart(product);
        } else {
            addToast({ message: 'Este producto no tiene un precio asignado.', type: 'warning' });
        }
    };
    
    const handleUpdateQuantity = (productId, newQuantity) => {
        if (isNaN(newQuantity)) return;
        if (newQuantity <= 0) { handleRemoveFromCart(productId); return; }
        setCart(currentCart => {
            const itemToUpdate = currentCart.find(item => item.product.id === productId);
            if (!itemToUpdate) return currentCart;
            return currentCart.map(item => item.product.id === productId ? { ...item, quantity: newQuantity } : item);
        });
    };

    const handleRemoveFromCart = (productId) => {
        setCart(currentCart => currentCart.filter(item => item.product.id !== productId));
        setCustomPrices(prev => { const newPrices = { ...prev }; delete newPrices[productId]; return newPrices; });
    };
    
    const handleOpenPricePopover = (e, item) => { e.stopPropagation(); setPricePopover({ isOpen: true, item, target: e.currentTarget }); };
    const handleClosePricePopover = () => setPricePopover({ isOpen: false, item: null, target: null });
    const handleApplyCustomPrice = (productId, newPrice) => {
        const product = cart.find(item => item.product.id === productId)?.product;
        if (!product) return;
        const originalPrice = getActivePriceForProduct(product);
        if (newPrice === originalPrice) setCustomPrices(prev => { const newPrices = { ...prev }; delete newPrices[productId]; return newPrices; });
        else setCustomPrices(prev => ({ ...prev, [productId]: { newPrice } }));
        handleClosePricePopover();
    };
    
    const totals = useMemo(() => {
        const subtotal = cart.reduce((total, item) => (customPrices[item.product.id]?.newPrice ?? getActivePriceForProduct(item.product)) * item.quantity + total, 0);
        const tax = Number(taxRate) || 0;
        const taxAmount = (tax > 0 && tax < 100) ? (subtotal / (1 - tax / 100)) - subtotal : 0;
        const implicitDiscountTotal = cart.reduce((total, item) => {
            const originalPrice = getActivePriceForProduct(item.product);
            const customPrice = customPrices[item.product.id]?.newPrice;
            if (customPrice !== undefined) total += (originalPrice - customPrice) * item.quantity;
            return total;
        }, 0);
        const totalAvailableMargin = cart.reduce((margin, item) => margin + ((Number(getPriceInfoForProduct(item.product).ganancia_maxima || 0) - Number(getPriceInfoForProduct(item.product).ganancia_minima || 0)) * item.quantity), 0);
        const maxGlobalDiscount = Math.max(0, totalAvailableMargin - implicitDiscountTotal);
        const globalDiscountAmount = Math.max(0, Math.min(Number(discountValue) || 0, maxGlobalDiscount));
        const finalTotal = subtotal + taxAmount - globalDiscountAmount;
        return { subtotal, taxAmount, totalDiscount: globalDiscountAmount, maxGlobalDiscount: totalAvailableMargin, finalTotal: Math.max(0, finalTotal) };
    }, [cart, activePriceListId, taxRate, discountValue, customPrices, getActivePriceForProduct, getPriceInfoForProduct]);

    const handleDiscountChange = (e) => setDiscountValue(e.target.value);
    
    const handleGenerateProforma = async () => {
        if (!selectedClientId) {
            addToast({ message: 'Por favor, selecciona un cliente para la proforma.', type: 'error' });
            return;
        }
        setIsProcessing(true);
        try {
            const { error } = await supabase.rpc('crear_proforma', {
                p_proforma: {
                    cliente_id: selectedClientId, fecha_emision: new Date().toISOString(), fecha_vencimiento: fechaVencimiento,
                    subtotal: totals.subtotal, descuento: totals.totalDiscount, impuestos: totals.taxAmount, total: totals.finalTotal, notas: notas
                },
                p_items: cart.map(item => ({
                    producto_id: item.product.id, cantidad: item.quantity,
                    precio_unitario_aplicado: customPrices[item.product.id]?.newPrice ?? getActivePriceForProduct(item.product),
                    costo_unitario_en_proforma: (getPriceInfoForProduct(item.product).precio - getPriceInfoForProduct(item.product).ganancia_maxima) || 0,
                }))
            });
            if (error) throw error;
            addToast({ message: 'Proforma generada con éxito.', type: 'success' });
            clearProformaCart();
            navigate('/proformas');
        } catch (err) {
            addToast({ message: `Error al generar proforma: ${err.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
            setIsFinalizeModalOpen(false);
        }
    };
    
    const handleSkuSubmit = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const term = skuInput.trim();
            if (!term) return;
            const product = posData.products.find(p => p.sku === term);
            if (product) {
                handleProductAction(product, getDefaultPriceForProduct(product) > 0);
                setSkuInput('');
            } else {
                addToast({ message: `Producto con SKU "${term}" no encontrado.`, type: 'error' });
            }
        }
    };

    const handleScanSuccess = (scannedSku) => {
        setIsScannerOpen(false);
        const product = posData.products.find(p => p.sku === scannedSku);
        if (product) {
            addToast({ message: `Producto "${product.nombre}" añadido.`, type: 'success' });
            handleProductAction(product, getDefaultPriceForProduct(product) > 0);
        } else {
            addToast({ message: `Producto con código "${scannedSku}" no encontrado.`, type: 'error' });
        }
    };
    
    const quickAccessProducts = useMemo(() => [...posData.products].sort((a, b) => (b.unidades_vendidas_90_dias || 0) - (a.unidades_vendidas_90_dias || 0)).slice(0, 8), [posData.products]);
    const cartMap = useMemo(() => new Map(cart.map(item => [item.product.id, item])), [cart]);
    const totalItemsInCart = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
    
    const filteredProducts = useMemo(() => {
        if (!posData.products) return [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const baseFiltered = posData.products.filter(p => {
            let matchesStatus = true;
            const defaultPriceListId = posData.price_lists.find(pl => pl.es_predeterminada)?.id;
            if (filters.status === 'in_stock') matchesStatus = p.stock_sucursal > 0;
            else if (filters.status === 'on_sale') matchesStatus = p.prices && Object.keys(p.prices).some(priceListId => priceListId !== defaultPriceListId && p.prices[priceListId]?.precio > 0);
            else if (filters.status === 'new_arrival') matchesStatus = p.created_at && new Date(p.created_at) > thirtyDaysAgo;

            const matchesCategory = filters.category_ids.length === 0 || filters.category_ids.includes(p.categoria_id);
            const matchesBrand = filters.brand_names.length === 0 || filters.brand_names.includes(p.marca || 'Sin Marca');
            
            const searchTermLower = filters.searchTerm.toLowerCase();
            const matchesSearch = filters.searchTerm === '' ||
                p.nombre?.toLowerCase().includes(searchTermLower) ||
                p.sku?.toLowerCase().includes(searchTermLower) ||
                p.modelo?.toLowerCase().includes(searchTermLower);
            
            return matchesStatus && matchesCategory && matchesBrand && matchesSearch;
        });

        if (filters.status === 'most_sold') {
            return [...baseFiltered].sort((a, b) => (b.unidades_vendidas_90_dias || 0) - (a.unidades_vendidas_90_dias || 0));
        }

        return baseFiltered;
    }, [posData.products, filters, posData.price_lists]);
    
    const handleFilterChange = (e) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleClearFilters = () => {
        setFilters(initialFilters);
        if(isAdvancedSearchOpen) setIsAdvancedSearchOpen(false);
    };
    
    const mobileActions = html`
        <div class="flex lg:hidden items-center gap-2">
            <button onClick=${() => setIsScannerOpen(true)} class="flex-shrink-0 flex items-center justify-center p-2.5 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors" title="Escanear código de barras con la cámara">
                ${ICONS.qr_code_scanner}
            </button>
            <button onClick=${() => setCartSidebarOpen(true)} class="lg:hidden relative flex-shrink-0 flex items-center justify-center p-2.5 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors" title="Ver carrito">
                <span class="text-2xl">${ICONS.shopping_cart}</span>
                ${totalItemsInCart > 0 && html`<div class="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold">${totalItemsInCart > 9 ? '9+' : totalItemsInCart}</div>`}
            </button>
        </div>
    `;
    
    const cartPanelProps = { companyInfo, posData, clearProformaCart, getActivePriceForProduct, handleUpdateQuantity, handleRemoveFromCart, totals, handleDiscountChange, onFinalize: handleOpenFinalizeModal, onOpenPricePopover: handleOpenPricePopover, formatCurrency, cart, customPrices, selectedClientId, setSelectedClientId, activePriceListId, setActivePriceListId, taxRate, setTaxRate, discountValue, setIsClienteFormOpen };
    
    return html`
        <${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} activeLink="Proformas" breadcrumbs=${breadcrumbs} companyInfo=${companyInfo} disablePadding=${true}>
            <div class="h-full lg:grid lg:grid-cols-[1fr_450px] lg:gap-6 lg:p-6">
                <div class="bg-white rounded-lg border shadow-sm h-full flex flex-col lg:h-auto overflow-hidden">
                    <div class="flex-shrink-0 p-4 border-b space-y-4">
                        <div class="hidden lg:flex gap-2">
                             <div class="relative flex-grow">
                                <${FormInput} name="sku_input" type="text" label="" value=${skuInput} onInput=${e => setSkuInput(e.target.value)} onKeyDown=${handleSkuSubmit} placeholder="Ingresar SKU y presionar Enter" required=${false} icon=${ICONS.search} />
                             </div>
                             <button onClick=${() => setIsScannerOpen(true)} class="flex-shrink-0 flex items-center justify-center p-2.5 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors" title="Escanear código de barras con la cámara">
                                ${ICONS.qr_code_scanner}
                            </button>
                        </div>
                        <${FilterBar} filters=${filters} onFilterChange=${handleFilterChange} onClear=${handleClearFilters} onToggleAdvanced=${() => setIsAdvancedSearchOpen(p => !p)} isAdvancedOpen=${isAdvancedSearchOpen} statusOptions=${posStatusOptions} rightActions=${mobileActions} />
                        <${AdvancedFilterPanel} isOpen=${isAdvancedSearchOpen} filters=${filters} onFilterChange=${handleFilterChange} filterOptions=${filterOptions} />
                    </div>
                    <div class="p-4 flex-grow overflow-y-auto">
                        ${quickAccessProducts.length > 0 && html`
                        <div class="mb-6">
                            <h3 class="text-sm font-semibold text-gray-600 mb-2">Acceso Rápido</h3>
                            <div class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                                ${quickAccessProducts.map(p => html`
                                    <${QuickAccessButton} product=${p} onClick=${() => handleProductAction(p, getDefaultPriceForProduct(p) > 0)} formatCurrency=${formatCurrency}/>
                                `)}
                            </div>
                        </div>
                        `}
                        <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));">
                            ${filteredProducts.map(p => html`<${ProductCard} product=${p} onAction=${handleProductAction} defaultPrice=${getDefaultPriceForProduct(p)} quantityInCart=${cartMap.get(p.id)?.quantity || 0} formatCurrency=${formatCurrency} />`)}
                        </div>
                    </div>
                </div>
                <div class="hidden lg:block"><div class="sticky top-6"><div class="flex flex-col bg-white rounded-lg border shadow-sm max-h-[calc(100vh-7rem)]"><${CartPanel} ...${cartPanelProps} /></div></div></div>
                <div class=${`fixed inset-0 z-40 flex justify-end lg:hidden transition-opacity duration-300 ${isCartSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}><div class="fixed inset-0 bg-black/60" onClick=${() => setCartSidebarOpen(false)}></div><div class=${`relative flex w-full max-w-md flex-1 flex-col bg-slate-50 transform transition duration-300 ${isCartSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}><div class="absolute top-0 left-0 -ml-12 pt-2"><button type="button" class="ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white focus:outline-none" onClick=${() => setCartSidebarOpen(false)}>${ICONS.close}</button></div><div class="flex flex-col h-full overflow-hidden"><${CartPanel} ...${cartPanelProps} /></div></div></div>
            </div>
            <${ProformaFinalizeModal} isOpen=${isFinalizeModalOpen} onClose=${() => setIsFinalizeModalOpen(false)} onConfirm=${handleGenerateProforma} isLoading=${isProcessing} fechaVencimiento=${fechaVencimiento} setFechaVencimiento=${setFechaVencimiento} notas=${notas} setNotas=${setNotas} />
            <${ClienteFormModal} isOpen=${isClienteFormOpen} onClose=${() => setIsClienteFormOpen(false)} onSave=${(action, savedClient) => { setIsClienteFormOpen(false); fetchData().then(() => { if (action === 'create') setSelectedClientId(savedClient.id); }); }} clienteToEdit=${null} user=${user} />
            <${CameraScanner} isOpen=${isScannerOpen} onClose=${() => setIsScannerOpen(false)} onScanSuccess=${handleScanSuccess} />
            ${pricePopover.isOpen && html`<${SetPricePopover} item=${pricePopover.item} targetElement=${pricePopover.target} onClose=${handleClosePricePopover} onApply=${handleApplyCustomPrice} getPriceInfo=${getPriceInfoForProduct} addToast=${addToast} formatCurrency=${formatCurrency} />`}
        <//>
    `;
}