/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../hooks/useToast.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { useLoading } from '../../hooks/useLoading.js';
import { FilterPanel } from '../../components/FilterPanel.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';
import { ClienteFormModal } from '../../components/modals/ClienteFormModal.js';
import { Avatar } from '../../components/Avatar.js';
import { CheckoutModal } from '../../components/modals/CheckoutModal.js';

const ClienteSelector = ({ clients, selectedClientId, onSelect, onAddNew }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef(null);

    const selectedClient = useMemo(() => {
        if (!selectedClientId) return null;
        return clients.find(c => c.id === selectedClientId);
    }, [selectedClientId, clients]);
    
    // When a client is selected from the cart, update the search term to show their name
    useEffect(() => {
        setSearchTerm(selectedClient ? selectedClient.nombre : '');
    }, [selectedClient]);

    const filteredClients = useMemo(() => {
        const allOptions = [{ id: 'add_new', nombre: 'Añadir Nuevo Cliente' }, ...clients];
        // Don't filter if the input is the selected client's name
        if (!searchTerm || (selectedClient && searchTerm === selectedClient.nombre)) {
             return allOptions;
        }
        const lowerCaseTerm = searchTerm.toLowerCase();
        return [
            { id: 'add_new', nombre: 'Añadir Nuevo Cliente' },
            ...clients.filter(c => c.nombre.toLowerCase().includes(lowerCaseTerm))
        ];
    }, [searchTerm, clients, selectedClient]);

    const itemRefs = useRef([]);
    useEffect(() => {
        if (isDropdownOpen && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
            itemRefs.current[highlightedIndex].scrollIntoView({
                block: 'nearest'
            });
        }
    }, [highlightedIndex, isDropdownOpen]);

     useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setDropdownOpen(false);
                // If dropdown closes and input is empty, ensure selection is cleared
                if (!searchTerm) {
                    onSelect(null);
                } else if (selectedClient) {
                    // If dropdown closes and there's a selection, restore the name
                    setSearchTerm(selectedClient.nombre);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [wrapperRef, searchTerm, selectedClient, onSelect]);

    const handleSelect = (client) => {
        if (client.id === 'add_new') {
            onAddNew();
        } else {
            onSelect(client.id);
        }
        setDropdownOpen(false);
        setHighlightedIndex(-1);
    };
    
    const handleClear = () => {
        setSearchTerm('');
        onSelect(null);
        wrapperRef.current?.querySelector('input')?.focus();
    };

    const handleKeyDown = (e) => {
        if (!isDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setDropdownOpen(true);
            setHighlightedIndex(0);
            return;
        }
        if (!isDropdownOpen) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1) % filteredClients.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev - 1 + filteredClients.length) % filteredClients.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0) {
                handleSelect(filteredClients[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setDropdownOpen(false);
        }
    };


    return html`
        <div ref=${wrapperRef} class="relative">
            <label for="client-search" class="block text-sm font-medium text-gray-700">Cliente</label>
            <div class="relative mt-1">
                <input
                    id="client-search"
                    type="text"
                    value=${searchTerm}
                    onInput=${e => { setSearchTerm(e.target.value); if (!isDropdownOpen) setDropdownOpen(true); }}
                    onFocus=${(e) => { e.target.select(); setDropdownOpen(true); }}
                    onKeyDown=${handleKeyDown}
                    placeholder="Buscar cliente..."
                    class="w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm"
                />
                ${searchTerm && html`
                    <button 
                        onClick=${handleClear}
                        class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                        aria-label="Limpiar búsqueda"
                    >
                        ${ICONS.close}
                    </button>
                `}
            </div>
             ${isDropdownOpen && html`
                <ul class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    ${filteredClients.map((c, index) => html`
                        <li 
                            key=${c.id}
                            ref=${el => itemRefs.current[index] = el}
                            onClick=${() => handleSelect(c)} 
                            onMouseEnter=${() => setHighlightedIndex(index)}
                            class="relative cursor-pointer select-none p-2
                            ${c.id === 'add_new' ? 'text-primary font-semibold' : 'text-gray-900'}
                            ${highlightedIndex === index ? 'bg-primary-light' : ''} hover:bg-primary-light"
                        >
                           ${c.id === 'add_new' ? html`
                                <span class="flex items-center gap-2">${ICONS.add} ${c.nombre}</span>
                           ` : html`
                                <div class="flex items-center gap-3">
                                    <${Avatar} name=${c.nombre} avatarUrl=${c.avatar_url} size="h-8 w-8" />
                                    <div class="flex-1 min-w-0">
                                        <p class="font-medium truncate">${c.nombre}</p>
                                        <p class="text-xs text-gray-500 truncate">${c.telefono || 'Sin teléfono'}</p>
                                    </div>
                                </div>
                           `}
                        </li>
                    `)}
                    ${filteredClients.length <= 1 && searchTerm && html`
                        <li class="relative select-none py-2 px-4 text-gray-500">No se encontraron clientes.</li>
                    `}
                </ul>
            `}
        </div>
    `;
};

const SetPricePopover = ({ item, targetElement, onClose, onApply, getPriceInfo, addToast }) => {
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
            addToast({ message: `El precio no puede ser inferior a Bs ${minPrice.toFixed(2)}.`, type: 'error' });
            return;
        }
        if (numPrice > originalPrice) {
            addToast({ message: `El precio no puede ser superior al original de Bs ${originalPrice.toFixed(2)}.`, type: 'error' });
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
            <p class="text-xs text-gray-500 mb-2">Mínimo: <span class="font-semibold text-amber-600">Bs ${minPrice.toFixed(2)}</span></p>
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

const ProductDetailModal = ({ isOpen, onClose, product, currentUserSucursal }) => {
    if (!product) return null;

    // Helper for rendering details to avoid repetition
    const DetailItem = ({ label, value }) => {
        if (!value) return null;
        return html`
            <div>
                <dt class="text-xs font-medium text-gray-500">${label}</dt>
                <dd class="mt-1 text-sm text-gray-900">${value}</dd>
            </div>
        `;
    };

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${onClose}
            title="Detalles del Producto"
            confirmText="Cerrar"
            icon=${ICONS.info}
            maxWidthClass="max-w-2xl"
        >
            <div class="space-y-6 text-sm text-gray-600">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div class="sm:col-span-1">
                        <img src=${product.imagen_principal || NO_IMAGE_ICON_URL} alt=${product.nombre} class="w-full aspect-square rounded-lg object-cover bg-gray-100 border" />
                    </div>
                    <div class="sm:col-span-2">
                        <h3 class="text-lg font-bold text-gray-900">${product.nombre}</h3>
                        <p class="text-xs text-gray-400 mt-1">SKU: ${product.sku || 'N/A'}</p>
                        
                        <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                            <${DetailItem} label="Marca" value=${product.marca} />
                            <${DetailItem} label="Modelo" value=${product.modelo} />
                            <${DetailItem} label="Categoría" value=${product.categoria_nombre} />
                            <${DetailItem} label="Unidad" value=${product.unidad_medida} />
                        </dl>
                        
                        ${product.descripcion && html`
                            <div class="mt-4">
                                <dt class="text-xs font-medium text-gray-500">Descripción</dt>
                                <dd class="mt-1 text-sm text-gray-700 max-h-24 overflow-y-auto">${product.descripcion}</dd>
                            </div>
                        `}
                    </div>
                </div>

                <div>
                    <h4 class="text-base font-semibold text-gray-800">Disponibilidad en Sucursales</h4>
                    <ul class="mt-2 max-h-48 overflow-y-auto divide-y divide-gray-200 border-t border-b">
                        ${product.all_branch_stock.map(stockInfo => {
                            const isCurrentUserSucursal = stockInfo.sucursal_nombre === currentUserSucursal;
                            return html`
                                <li class="grid grid-cols-[1fr_auto] items-center gap-2 py-3 px-4 ${isCurrentUserSucursal ? 'bg-blue-50 rounded-md' : ''}">
                                    <div class="flex items-baseline gap-2 min-w-0">
                                        <p class="font-medium text-gray-800 truncate" title=${stockInfo.sucursal_nombre}>
                                            ${stockInfo.sucursal_nombre}
                                        </p>
                                        ${isCurrentUserSucursal ? html`<p class="text-xs font-bold text-primary whitespace-nowrap">(Tu Sucursal)</p>` : ''}
                                    </div>
                                    <p class="text-lg font-bold ${stockInfo.cantidad > 0 ? 'text-green-600' : 'text-red-600'}">${stockInfo.cantidad}</p>
                                </li>
                            `;
                        })}
                    </ul>
                </div>
            </div>
        <//>
    `;
};

const StockPill = ({ stock }) => {
    let pillClass, text;
    if (stock > 10) {
        pillClass = 'bg-green-100 text-green-800';
        text = 'En Stock';
    } else if (stock > 0) {
        pillClass = 'bg-yellow-100 text-yellow-800';
        text = 'Bajo Stock';
    } else {
        pillClass = 'bg-red-100 text-red-800';
        text = 'Agotado';
    }
    return html`<span class="${pillClass} inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">${text} (${stock})</span>`;
};


const ProductCard = ({ product, onAction, defaultPrice, quantityInCart, onShowDetails }) => {
    const hasStock = product.stock_sucursal > 0;
    const hasPrice = defaultPrice > 0;
    const isAvailable = hasStock && hasPrice;
    
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
                            <p class="text-sm font-bold text-gray-900">Bs ${defaultPrice.toFixed(2)}</p>
                        ` : html`
                             <p class="text-xs font-bold text-amber-600">Precio no asignado</p>
                        `}
                    </div>
                </div>
            </button>
            <div class="flex items-center justify-between px-2 pb-1 text-xs text-gray-500">
                <${StockPill} stock=${product.stock_sucursal} />
                <button onClick=${(e) => { e.stopPropagation(); onShowDetails(product); }} title="Ver detalles del producto" class="p-1 rounded-full hover:bg-gray-100 text-gray-400">
                    ${ICONS.info}
                </button>
            </div>
            ${!isAvailable && html`
                <div class="absolute inset-0 bg-white/60 flex items-center justify-center pointer-events-none">
                    <span class="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        ${!hasPrice ? 'SIN PRECIO' : 'AGOTADO'}
                    </span>
                </div>
            `}
        </div>
    `;
};

const CartItem = ({ item, onUpdateQuantity, onRemove, originalPrice, customPrice, onOpenPricePopover, priceSource, activePriceListName }) => {
    const effectivePrice = customPrice ?? originalPrice;
    const hasCustomPrice = customPrice !== null && customPrice !== undefined;
    const priceListTooltip = `Precio ${activePriceListName} aplicado`;
    
    return html`
        <div class="flex items-center gap-3 py-3">
            <img src=${item.product.imagen_principal || NO_IMAGE_ICON_URL} alt=${item.product.nombre} class="h-14 w-14 rounded-md object-cover border" />
            <div class="flex-grow">
                <p class="text-sm font-semibold text-gray-800">${item.product.nombre}</p>
                 <div class="flex items-center gap-1.5">
                    <p class="text-xs text-gray-500">
                        ${hasCustomPrice && html`<span class="line-through mr-1">Bs ${originalPrice.toFixed(2)}</span>`}
                        <span class=${hasCustomPrice ? 'font-bold text-primary' : ''}>Bs ${effectivePrice.toFixed(2)} c/u</span>
                    </p>
                    ${priceSource === 'specific' && activePriceListName && html`
                        <span title=${priceListTooltip} class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                           ${activePriceListName}
                        </span>
                    `}
                 </div>
                <div class="flex items-center gap-2 mt-1">
                    <button onClick=${() => onUpdateQuantity(item.product.id, item.quantity - 1)} class="text-gray-500 hover:text-red-600 transition-colors">${ICONS.remove_circle}</button>
                    <input 
                        type="number"
                        value=${item.quantity}
                        onInput=${e => onUpdateQuantity(item.product.id, parseInt(e.target.value, 10))}
                        class="w-14 text-center rounded-md border-gray-300 shadow-sm p-1 text-sm font-semibold focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 bg-white text-gray-900"
                        min="1"
                        aria-label="Cantidad"
                    />
                    <button onClick=${() => onUpdateQuantity(item.product.id, item.quantity + 1)} class="text-gray-500 hover:text-green-600 transition-colors">${ICONS.add_circle}</button>
                     <button onClick=${(e) => onOpenPricePopover(e, item)} title="Establecer precio" class="ml-2 p-1 rounded-full ${hasCustomPrice ? 'text-green-600 bg-green-100' : 'text-gray-500'} hover:bg-green-100 hover:text-green-600">
                       ${ICONS.local_offer}
                    </button>
                </div>
            </div>
            <div class="text-right flex flex-col items-end">
                <p class="text-base font-bold text-gray-900">Bs ${(effectivePrice * item.quantity).toFixed(2)}</p>
                <button onClick=${() => onRemove(item.product.id)} title="Eliminar del carrito" class="mt-1 p-1 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600">
                    ${ICONS.delete}
                </button>
            </div>
        </div>
    `;
};

function CartPanel({ cart, posData, activePriceListId, setActivePriceListId, handleClearCart, getPriceForProduct, handleUpdateQuantity, handleRemoveFromCart, totals, taxRate, setTaxRate, discountValue, onDiscountChange, onFinalizeSale, onOpenPricePopover, customPrices, defaultPriceListId, isPriceRuleActive, selectedClientId, setSelectedClientId, setIsClienteFormOpen }) {
    const activePriceListName = useMemo(() => {
        return posData.price_lists.find(pl => pl.id === activePriceListId)?.nombre || '';
    }, [activePriceListId, posData.price_lists]);
    
    return html`
        <div class="p-4 flex-shrink-0 border-b flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-800">Carrito de Venta</h2>
            <button onClick=${handleClearCart} disabled=${cart.length === 0} class="text-sm font-medium text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed">
                Vaciar Carrito
            </button>
        </div>

        <div class="p-4 flex-shrink-0 border-b">
            <div class="flex items-start gap-4">
                <div class="w-2/3">
                    <${ClienteSelector}
                        clients=${posData.clients || []}
                        selectedClientId=${selectedClientId}
                        onSelect=${setSelectedClientId}
                        onAddNew=${() => setIsClienteFormOpen(true)}
                    />
                </div>
                <div class="w-1/3">
                    <label for="price-list" class="block text-sm font-medium text-gray-700">Lista de Precios</label>
                    <select id="price-list" value=${activePriceListId} onChange=${e => setActivePriceListId(e.target.value)} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                        ${posData.price_lists.map(pl => html`<option value=${pl.id}>${pl.nombre}</option>`)}
                    </select>
                </div>
            </div>
        </div>

        <div class="flex-grow overflow-y-auto p-4 divide-y divide-gray-200">
            ${cart.length === 0 ? html`
                <div class="h-full flex flex-col items-center justify-center text-center text-gray-500">
                    <div class="text-5xl">${ICONS.pos}</div>
                    <p class="mt-2 font-semibold">Carrito Vacío</p>
                    <p class="text-sm">Añade productos desde el catálogo.</p>
                </div>
            ` : cart.map(item => {
                const product = item.product;
                let priceSource = 'default';
                const activePriceInfo = product.prices?.[activePriceListId];

                if (activePriceListId !== defaultPriceListId && isPriceRuleActive(activePriceInfo)) {
                    priceSource = 'specific';
                }

                return html`
                <${CartItem} 
                    item=${item} 
                    originalPrice=${getPriceForProduct(item.product)}
                    customPrice=${customPrices[item.product.id]?.newPrice}
                    onUpdateQuantity=${handleUpdateQuantity} 
                    onRemove=${handleRemoveFromCart}
                    onOpenPricePopover=${onOpenPricePopover}
                    priceSource=${priceSource}
                    activePriceListName=${activePriceListName}
                />
            `})}
        </div>

        <div class="p-4 bg-gray-50 border-t flex-shrink-0 space-y-4">
            <div class="space-y-2 text-sm">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Subtotal</span>
                    <span class="font-medium text-gray-800">Bs ${totals.subtotal.toFixed(2)}</span>
                </div>
                
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Impuesto</span>
                    <div class="flex items-center gap-2">
                        <div class="flex items-center rounded-md shadow-sm bg-white border border-gray-300 focus-within:border-[#0d6efd] focus-within:ring-4 focus-within:ring-[#0d6efd]/25 transition-colors duration-150 w-24">
                            <span class="pl-2 text-gray-500 text-sm">%</span>
                            <input type="number" value=${taxRate} onInput=${e => setTaxRate(e.target.value)} placeholder="0" class="w-full border-0 bg-transparent p-1 text-sm text-right text-gray-900 focus:ring-0 focus:outline-none" />
                        </div>
                        <span class="font-medium text-gray-800 w-24 text-right">+ Bs ${totals.taxAmount.toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="flex justify-between items-start">
                    <span class="text-gray-600 pt-1">Descuento</span>
                    <div class="flex flex-col items-end">
                        <div class="flex items-center gap-2">
                            <div class="flex items-center rounded-md shadow-sm bg-white border border-gray-300 focus-within:border-[#0d6efd] focus-within:ring-4 focus-within:ring-[#0d6efd]/25 w-24">
                                <span class="pl-2 text-gray-500 text-sm">Bs</span>
                                <input 
                                    type="number" 
                                    value=${discountValue} 
                                    onInput=${onDiscountChange} 
                                    placeholder="Global" 
                                    class="w-full border-0 bg-transparent p-1 text-sm text-right text-gray-900 focus:ring-0 focus:outline-none"
                                />
                            </div>
                            <span class="font-medium text-red-600 w-24 text-right">- Bs ${totals.totalDiscount.toFixed(2)}</span>
                        </div>
                        ${totals.maxGlobalDiscount > 0 && html`
                            <p class="text-xs text-gray-500 mt-1">Máx: Bs ${totals.maxGlobalDiscount.toFixed(2)}</p>
                        `}
                    </div>
                </div>

                <div class="flex justify-between items-baseline text-2xl font-bold border-t pt-2 mt-2">
                    <span class="text-gray-900">Total</span>
                    <span class="text-primary">Bs ${totals.finalTotal.toFixed(2)}</span>
                </div>
            </div>
            <button onClick=${onFinalizeSale} disabled=${cart.length === 0} class="w-full flex items-center justify-center gap-2 text-center rounded-lg bg-green-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed">
                ${ICONS.pos}
                Finalizar Venta
            </button>
        </div>
    `;
}

export function TerminalVentaPage({ user, onLogout, onProfileUpdate, companyInfo, notifications }) {
    const breadcrumbs = [ { name: 'Punto de Venta', href: '#/terminal-venta' } ];
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    
    const [posData, setPosData] = useState({ products: [], price_lists: [], clients: [] });
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilters, setActiveFilters] = useState({ category: [], brand: [] });
    const [isFilterSidebarOpen, setFilterSidebarOpen] = useState(false);
    
    const [defaultPriceListId, setDefaultPriceListId] = useState(null);
    const [activePriceListId, setActivePriceListId] = useState(null);
    
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [productForDetailView, setProductForDetailView] = useState(null);

    const [isCartSidebarOpen, setCartSidebarOpen] = useState(false);

    const [taxRate, setTaxRate] = useState('');
    const [discountValue, setDiscountValue] = useState('');
    
    const [customPrices, setCustomPrices] = useState<{ [key: string]: { newPrice: number } }>({});
    const [pricePopover, setPricePopover] = useState({ isOpen: false, item: null, target: null });
    
    const [isClienteFormOpen, setIsClienteFormOpen] = useState(false);
    const [clienteToEdit, setClienteToEdit] = useState(null);
    const [selectedClientId, setSelectedClientId] = useState(null);

    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_pos_data');
            if (error) throw error;
            setPosData(data);
            const defaultList = data.price_lists.find(pl => pl.es_predeterminada);
            if (defaultList) {
                setDefaultPriceListId(defaultList.id);
                setActivePriceListId(defaultList.id);
            } else if (data.price_lists.length > 0) {
                setDefaultPriceListId(data.price_lists[0].id);
                setActivePriceListId(data.price_lists[0].id);
            }
        } catch (err) {
            console.error("Error fetching POS data:", err);
            addToast({ message: `Error crítico al cargar datos: ${err.message}`, type: 'error', duration: 10000 });
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (isCartSidebarOpen || isFilterSidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [isCartSidebarOpen, isFilterSidebarOpen]);


    const cartMap = useMemo(() => {
        return new Map(cart.map(item => [item.product.id, item]));
    }, [cart]);

    const totalItemsInCart = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

    const filterCounts = useMemo(() => {
        if (!posData?.products) return { categories: {}, brands: {} };
        const categories = posData.products.reduce((acc, p) => {
            const cat = p.categoria_nombre || 'Sin Categoría';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {});
        const brands = posData.products.reduce((acc, p) => {
            const brand = p.marca || 'Sin Marca';
            acc[brand] = (acc[brand] || 0) + 1;
            return acc;
        }, {});
        return { categories, brands };
    }, [posData.products]);

    const filteredProducts = useMemo(() => {
        return posData.products.filter(p => {
            const matchesCategory = activeFilters.category.length === 0 || activeFilters.category.includes(p.categoria_nombre || 'Sin Categoría');
            const matchesBrand = activeFilters.brand.length === 0 || activeFilters.brand.includes(p.marca || 'Sin Marca');
            const searchTermLower = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' ||
                p.nombre?.toLowerCase().includes(searchTermLower) ||
                p.sku?.toLowerCase().includes(searchTermLower) ||
                p.modelo?.toLowerCase().includes(searchTermLower);
            return matchesCategory && matchesBrand && matchesSearch;
        });
    }, [posData.products, activeFilters, searchTerm]);

    const handleFilterChange = (type, value) => {
        setActiveFilters(prev => {
            const currentValues = prev[type];
            const newValues = currentValues.includes(value)
                ? currentValues.filter(v => v !== value)
                : [...currentValues, value];
            return { ...prev, [type]: newValues };
        });
    };
    
    const handleClearFilters = () => {
        setActiveFilters({ category: [], brand: [] });
        if(isFilterSidebarOpen) setFilterSidebarOpen(false);
    };

    const isPriceRuleActive = (priceInfo) => {
        return priceInfo && Number(priceInfo.ganancia_maxima) > 0;
    };

    const getDefaultPriceForProduct = (product) => {
        return product.prices?.[defaultPriceListId]?.precio ?? 0;
    };

    const getActivePriceForProduct = (product) => {
        const activePriceInfo = product.prices?.[activePriceListId];
        if (isPriceRuleActive(activePriceInfo)) {
            return activePriceInfo.precio;
        }
        const defaultPriceInfo = product.prices?.[defaultPriceListId];
        return defaultPriceInfo?.precio ?? 0;
    };
    
    const getPriceInfoForProduct = (product) => {
        const activePriceInfo = product.prices?.[activePriceListId];
        if (isPriceRuleActive(activePriceInfo)) {
            return activePriceInfo;
        }
        const defaultPriceInfo = product.prices?.[defaultPriceListId];
        if (defaultPriceInfo) {
            return defaultPriceInfo;
        }
        return { precio: 0, ganancia_maxima: 0, ganancia_minima: 0 };
    };
    
    const handleShowDetails = (product) => {
        setProductForDetailView(product);
        setDetailModalOpen(true);
    };

    const handleAddToCart = (product) => {
        setCart(currentCart => {
            const existingItem = currentCart.find(item => item.product.id === product.id);
            if (existingItem) {
                if (existingItem.quantity < product.stock_sucursal) {
                    return currentCart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
                } else {
                    addToast({ message: `Stock máximo alcanzado para ${product.nombre}`, type: 'warning' });
                    return currentCart;
                }
            }
            return [...currentCart, { product, quantity: 1 }];
        });
    };

    const handleProductAction = (product, isAvailable) => {
        if (isAvailable) {
            handleAddToCart(product);
        } else {
            const price = getDefaultPriceForProduct(product);
            if (price <= 0) {
                addToast({ message: 'Este producto no tiene un precio asignado y no puede ser vendido.', type: 'warning' });
            } else { // out of stock
                handleShowDetails(product);
            }
        }
    };

    const handleUpdateQuantity = (productId, newQuantity) => {
        if (isNaN(newQuantity)) {
            return;
        }

        if (newQuantity <= 0) {
            handleRemoveFromCart(productId);
            return;
        }
        setCart(currentCart => {
            const itemToUpdate = currentCart.find(item => item.product.id === productId);
            if (!itemToUpdate) { return currentCart; }

            let finalQuantity = newQuantity;
            if (newQuantity > itemToUpdate.product.stock_sucursal) {
                addToast({ message: `Stock máximo (${itemToUpdate.product.stock_sucursal}) alcanzado.`, type: 'warning' });
                finalQuantity = itemToUpdate.product.stock_sucursal;
            }
            
            return currentCart.map(item => 
                item.product.id === productId ? { ...item, quantity: finalQuantity } : item
            );
        });
    };

    const handleRemoveFromCart = (productId) => {
        setCart(currentCart => currentCart.filter(item => item.product.id !== productId));
        setCustomPrices(prev => {
            const newPrices = { ...prev };
            delete newPrices[productId];
            return newPrices;
        });
    };

    const handleClearCart = () => {
        setCart([]);
        setTaxRate('');
        setDiscountValue('');
        setCustomPrices({});
        setSelectedClientId(null);
    };

    const handleOpenPricePopover = (e, item) => {
        e.stopPropagation();
        setPricePopover({ isOpen: true, item, target: e.currentTarget });
    };

    const handleClosePricePopover = () => {
        setPricePopover({ isOpen: false, item: null, target: null });
    };

    const handleApplyCustomPrice = (productId, newPrice) => {
        const product = cart.find(item => item.product.id === productId)?.product;
        if (!product) return;
        const originalPrice = getActivePriceForProduct(product);

        if (newPrice === originalPrice) {
            setCustomPrices(prev => {
                const newPrices = { ...prev };
                delete newPrices[productId];
                return newPrices;
            });
        } else {
            setCustomPrices(prev => ({ ...prev, [productId]: { newPrice } }));
        }
        handleClosePricePopover();
    };

    const handleSaveCliente = (action, savedClient) => {
        setIsClienteFormOpen(false);
        addToast({ message: `Cliente ${action === 'edit' ? 'actualizado' : 'creado'} con éxito.`, type: 'success' });
        fetchData().then(() => {
             if (action === 'create') {
                setSelectedClientId(savedClient.id);
             }
        });
    };

    const totals = useMemo(() => {
        // Calculate the subtotal based on the *effective price* (custom or original)
        const subtotal = cart.reduce((total, item) => {
            const originalPrice = getActivePriceForProduct(item.product);
            const effectivePrice = customPrices[item.product.id]?.newPrice ?? originalPrice;
            return total + (effectivePrice * item.quantity);
        }, 0);

        // Tax is calculated on the new, adjusted subtotal
        const tax = Number(taxRate) || 0;
        let taxAmount = 0;
        if (tax > 0 && tax < 100) {
            const taxDecimal = tax / 100;
            taxAmount = (subtotal / (1 - taxDecimal)) - subtotal;
        }
        
        // Calculate the implicit discount from price adjustments to limit the global discount
        const implicitDiscountTotal = cart.reduce((total, item) => {
            const originalPrice = getActivePriceForProduct(item.product);
            const customPrice = customPrices[item.product.id]?.newPrice;
            if (customPrice !== undefined && customPrice !== null) {
                total += (originalPrice - customPrice) * item.quantity;
            }
            return total;
        }, 0);

        // Calculate the total available margin for discounts across all items
        const totalAvailableMargin = cart.reduce((margin, item) => {
            const priceInfo = getPriceInfoForProduct(item.product);
            const max = Number(priceInfo.ganancia_maxima || 0);
            const min = Number(priceInfo.ganancia_minima || 0);
            const itemMargin = (max - min) * item.quantity;
            return margin + itemMargin;
        }, 0);
        
        // The maximum global discount is what's left of the margin after implicit discounts
        const maxGlobalDiscount = Math.max(0, totalAvailableMargin - implicitDiscountTotal);
        
        const globalDiscountInput = Number(discountValue) || 0;
        const globalDiscountAmount = Math.max(0, Math.min(globalDiscountInput, maxGlobalDiscount));

        // The displayed discount is *only* the global discount
        const totalDiscount = globalDiscountAmount;
        const finalTotal = subtotal + taxAmount - totalDiscount;

        return {
            subtotal,
            taxAmount,
            totalDiscount,
            maxGlobalDiscount,
            finalTotal: Math.max(0, finalTotal),
        };
    }, [cart, activePriceListId, taxRate, discountValue, customPrices, getActivePriceForProduct, getPriceInfoForProduct]);
    
    const handleDiscountChange = (e) => {
        const rawValue = e.target.value;
        const numericValue = Number(rawValue);

        // Ignore invalid input like '1.2.3' or negative numbers
        if (rawValue !== '' && (isNaN(numericValue) || numericValue < 0)) {
            return;
        }

        // If the typed value exceeds the max discount, cap it and notify the user.
        if (numericValue > totals.maxGlobalDiscount) {
            const maxDiscountStr = totals.maxGlobalDiscount.toFixed(2);
            setDiscountValue(maxDiscountStr);
            addToast({ message: `Descuento ajustado al máximo permitido: Bs ${maxDiscountStr}`, type: 'warning' });
        } else {
            setDiscountValue(rawValue);
        }
    };

    const handleConfirmSale = async (saleDetails) => {
        startLoading();
        setIsCheckoutModalOpen(false); // Close modal immediately
        try {
            const saleItems = cart.map(item => {
                const originalPrice = getActivePriceForProduct(item.product);
                const effectivePrice = customPrices[item.product.id]?.newPrice ?? originalPrice;
                const fullProduct = posData.products.find(p => p.id === item.product.id);
                return {
                    producto_id: item.product.id,
                    cantidad: item.quantity,
                    precio_unitario_aplicado: effectivePrice,
                    costo_unitario_en_venta: fullProduct?.prices?.[defaultPriceListId]?.precio - fullProduct?.prices?.[defaultPriceListId]?.ganancia_maxima || 0
                };
            });

            const payload = {
                p_venta: {
                    cliente_id: selectedClientId,
                    sucursal_id: user.sucursal_id,
                    total: totals.finalTotal,
                    subtotal: totals.subtotal,
                    descuento: totals.totalDiscount,
                    impuestos: totals.taxAmount,
                    metodo_pago: saleDetails.metodoPago,
                    tipo_venta: saleDetails.tipoVenta,
                    abono_inicial: saleDetails.montoRecibido,
                    fecha_vencimiento: saleDetails.fechaVencimiento
                },
                p_items: saleItems
            };

            const { error } = await supabase.rpc('registrar_venta', payload);

            if (error) throw error;
            
            addToast({ message: 'Venta registrada con éxito.', type: 'success' });
            handleClearCart();
            fetchData(); // Refrescar stock de productos

        } catch (err) {
            console.error('Error al registrar la venta:', err);
            addToast({ message: `Error al registrar la venta: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    const cartPanelProps = {
        cart, posData, activePriceListId, setActivePriceListId,
        handleClearCart, getPriceForProduct: getActivePriceForProduct,
        handleUpdateQuantity, handleRemoveFromCart, totals,
        taxRate, setTaxRate, discountValue,
        onDiscountChange: handleDiscountChange,
        onFinalizeSale: () => setIsCheckoutModalOpen(true),
        onOpenPricePopover: handleOpenPricePopover, customPrices,
        defaultPriceListId, isPriceRuleActive, selectedClientId,
        setSelectedClientId, setIsClienteFormOpen
    };

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Punto de Venta"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
            disablePadding=${true}
        >
            <div class="h-full lg:h-auto lg:grid lg:grid-cols-[1fr_450px] lg:gap-6 lg:p-6">
                
                <div class="bg-white rounded-lg border shadow-sm h-full flex flex-col lg:h-auto">
                    <div class="flex-shrink-0 p-4 border-b lg:sticky lg:top-0 lg:bg-white/80 lg:backdrop-blur-sm z-10">
                        <div class="flex items-center gap-2">
                            <div class="relative flex-grow">
                                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">${ICONS.search}</div>
                                <input 
                                    type="text" 
                                    placeholder="Buscar por SKU, nombre o modelo..." 
                                    value=${searchTerm} 
                                    onInput=${e => setSearchTerm(e.target.value)} 
                                    class="block w-full rounded-md border border-gray-300 p-2 pl-10 bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm transition-colors duration-200" 
                                />
                                ${searchTerm && html`
                                    <button 
                                        onClick=${() => setSearchTerm('')}
                                        class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                                        aria-label="Limpiar búsqueda"
                                    >
                                        ${ICONS.close}
                                    </button>
                                `}
                            </div>
                            <button onClick=${() => setFilterSidebarOpen(true)} class="relative flex-shrink-0 flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                                ${ICONS.settings}
                                <span class="hidden sm:inline">Filtrar</span>
                                 ${(activeFilters.category.length > 0 || activeFilters.brand.length > 0) && html`
                                    <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">${activeFilters.category.length + activeFilters.brand.length}</span>
                                `}
                            </button>
                        </div>
                    </div>

                    <div class="p-4 flex-grow lg:flex-grow-0 overflow-y-auto lg:overflow-visible">
                        <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));">
                            ${filteredProducts.map(p => html`
                                <${ProductCard} 
                                    product=${p} 
                                    onAction=${handleProductAction} 
                                    onShowDetails=${handleShowDetails}
                                    defaultPrice=${getDefaultPriceForProduct(p)}
                                    quantityInCart=${cartMap.get(p.id)?.quantity || 0}
                                />
                            `)}
                        </div>
                    </div>
                </div>
                
                <div class="hidden lg:block">
                     <div class="sticky top-6">
                        <div class="flex flex-col bg-white rounded-lg border shadow-sm overflow-hidden max-h-[calc(100vh-7rem)]">
                            <${CartPanel} ...${cartPanelProps} />
                        </div>
                    </div>
                </div>

                <div class="lg:hidden fixed top-20 right-4 z-30">
                    <button 
                        onClick=${() => setCartSidebarOpen(true)}
                        class="relative flex items-center justify-center bg-primary text-white rounded-full w-14 h-14 shadow-lg hover:bg-primary-hover transition-colors"
                        aria-label="Ver carrito"
                    >
                        <span class="text-3xl">${ICONS.shopping_cart}</span>
                        ${totalItemsInCart > 0 && html`
                            <span class="absolute -top-1 -right-1 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 border-2 border-primary">${totalItemsInCart}</span>
                        `}
                    </button>
                </div>
                
                <div class=${`fixed inset-0 z-40 flex justify-end lg:hidden transition-opacity duration-300 ease-linear ${isCartSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} role="dialog" aria-modal="true">
                    <div class="fixed inset-0 bg-gray-600 bg-opacity-75" aria-hidden="true" onClick=${() => setCartSidebarOpen(false)}></div>
                    <div class=${`relative flex w-full max-w-md flex-1 flex-col bg-white transform transition duration-300 ease-in-out ${isCartSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                       <div class="absolute top-0 left-0 -ml-12 pt-2">
                            <button type="button" class="ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" onClick=${() => setCartSidebarOpen(false)}>
                                <span class="sr-only">Cerrar carrito</span>
                                ${ICONS.close}
                            </button>
                        </div>
                        <div class="flex flex-col h-full overflow-hidden">
                            <${CartPanel} ...${cartPanelProps} />
                        </div>
                    </div>
                </div>

                <div class=${`fixed inset-0 z-40 flex transition-opacity duration-300 ease-linear ${isFilterSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} role="dialog" aria-modal="true">
                    <div class="fixed inset-0 bg-gray-600 bg-opacity-75" aria-hidden="true" onClick=${() => setFilterSidebarOpen(false)}></div>
                    <div class=${`relative flex w-full max-w-xs flex-1 flex-col bg-white shadow-xl overflow-y-auto transform transition duration-300 ease-in-out ${isFilterSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                        <div class="absolute top-0 right-0 -mr-12 pt-2">
                            <button type="button" class="ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" onClick=${() => setFilterSidebarOpen(false)}>
                                <span class="sr-only">Cerrar filtros</span>
                                ${ICONS.close}
                            </button>
                        </div>
                        <${FilterPanel} counts=${filterCounts} activeFilters=${activeFilters} onFilterChange=${handleFilterChange} onClearFilters=${handleClearFilters} />
                    </div>
                </div>

            </div>
            
            ${pricePopover.isOpen && html`
                <${SetPricePopover}
                    item=${pricePopover.item}
                    targetElement=${pricePopover.target}
                    onClose=${handleClosePricePopover}
                    onApply=${handleApplyCustomPrice}
                    getPriceInfo=${getPriceInfoForProduct}
                    addToast=${addToast}
                />
            `}
            
            <${ClienteFormModal}
                isOpen=${isClienteFormOpen}
                onClose=${() => setIsClienteFormOpen(false)}
                onSave=${handleSaveCliente}
                clienteToEdit=${clienteToEdit}
                user=${user}
            />

            <${ProductDetailModal} 
                isOpen=${isDetailModalOpen}
                onClose=${() => setDetailModalOpen(false)}
                product=${productForDetailView}
                currentUserSucursal=${user.sucursal}
            />

            <${CheckoutModal}
                isOpen=${isCheckoutModalOpen}
                onClose=${() => setIsCheckoutModalOpen(false)}
                onConfirm=${handleConfirmSale}
                total=${totals.finalTotal}
                clienteId=${selectedClientId}
            />
        <//>
    `;
}