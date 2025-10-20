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
import { CheckoutModal } from '../../components/modals/CheckoutModal.js';
import { useRealtimeListener } from '../../hooks/useRealtime.js';
import { FormInput, FormSelect } from '../../components/FormComponents.js';
import { CameraScanner } from '../../components/CameraScanner.js';
import { AperturaCajaModal } from '../../components/modals/AperturaCajaModal.js';
import { CierreCajaModal } from '../../components/modals/CierreCajaModal.js';
import { Spinner } from '../../components/Spinner.js';
import { useTerminalVenta } from '../../contexts/StatePersistence.js';

const ClienteSelector = ({ clients, selectedClientId, onSelect, onAddNew }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
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
                if (!searchTerm) {
                    onSelect(null);
                } else if (selectedClient) {
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
    
    const clearButton = html`
        <button 
            type="button"
            onClick=${handleClear}
            class="text-gray-400 hover:text-gray-600"
            aria-label="Limpiar búsqueda"
        >
            ${ICONS.close}
        </button>
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
                onKeyDown=${handleKeyDown}
                placeholder="Buscar cliente..."
                icon=${ICONS.search}
                required=${false}
                rightElement=${searchTerm ? clearButton : null}
            />
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

const ProductDetailModal = ({ isOpen, onClose, product, currentUserSucursal }) => {
    if (!product) return null;

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
                                <li class="grid grid-cols-[1fr_auto] items-center gap-2 py-3 px-4 ${isCurrentUserSucursal ? 'bg-blue-50' : ''}">
                                    <div class="flex items-baseline gap-2 min-w-0">
                                        <p class="font-medium text-gray-800 truncate" title=${stockInfo.sucursal_nombre}>
                                            ${stockInfo.sucursal_nombre}
                                        </p>
                                        ${isCurrentUserSucursal && html`<p class="text-xs font-bold text-primary whitespace-nowrap">(Tu Sucursal)</p>`}
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


const ProductCard = ({ product, onAction, defaultPrice, quantityInCart, onShowDetails, formatCurrency }) => {
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
                            <p class="text-sm font-bold text-gray-900">${formatCurrency(defaultPrice)}</p>
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

const CartItem = ({ item, onUpdateQuantity, onRemove, originalPrice, customPrice, onOpenPricePopover, priceSource, activePriceListName, formatCurrency }) => {
    const effectivePrice = customPrice ?? originalPrice;
    const hasCustomPrice = customPrice !== null && customPrice !== undefined;
    const priceListTooltip = `Precio ${activePriceListName} aplicado`;

    const [translateX, setTranslateX] = useState(0);
    const touchStartRef = useRef(null);
    const isSwipingRef = useRef(false);

    const handleTouchStart = (e) => {
        touchStartRef.current = e.touches[0].clientX;
        isSwipingRef.current = true;
    };

    const handleTouchMove = (e) => {
        if (!isSwipingRef.current || touchStartRef.current === null) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - touchStartRef.current;
        if (diff < 0) { // Only allow swiping to the left
            setTranslateX(diff);
        }
    };

    const handleTouchEnd = (e) => {
        if (!isSwipingRef.current) return;
        
        const itemWidth = e.currentTarget.offsetWidth;
        if (translateX < -itemWidth * 0.4) {
            setTranslateX(-itemWidth);
            setTimeout(() => {
                onRemove(item.product.id);
                setTranslateX(0); // Reset for potential re-render of same item
            }, 200);
        } else {
            setTranslateX(0);
        }
        touchStartRef.current = null;
        isSwipingRef.current = false;
    };
    
    return html`
        <div class="relative bg-white overflow-hidden">
             <div class="absolute inset-0 bg-red-500 flex justify-end items-center pr-6 pointer-events-none">
                 <span class="text-white">${ICONS.delete}</span>
            </div>
            <div 
                class="relative flex items-center gap-3 py-3 bg-white"
                style=${{ transform: `translateX(${translateX}px)`, transition: 'transform 0.2s ease-out' }}
                onTouchStart=${handleTouchStart}
                onTouchMove=${handleTouchMove}
                onTouchEnd=${handleTouchEnd}
            >
                <img src=${item.product.imagen_principal || NO_IMAGE_ICON_URL} alt=${item.product.nombre} class="h-14 w-14 rounded-md object-cover border" />
                <div class="flex-grow">
                    <p class="text-sm font-semibold text-gray-800">${item.product.nombre}</p>
                     <div class="flex items-center gap-1.5">
                        <p class="text-xs text-gray-500">
                            ${hasCustomPrice && html`<span class="line-through mr-1">${formatCurrency(originalPrice)}</span>`}
                            <span class=${hasCustomPrice ? 'font-bold text-primary' : ''}>${formatCurrency(effectivePrice)} c/u</span>
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
                    <p class="text-base font-bold text-gray-900">${formatCurrency(effectivePrice * item.quantity)}</p>
                    <button onClick=${() => onRemove(item.product.id)} title="Eliminar del carrito" class="mt-1 p-1 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600">
                        ${ICONS.delete}
                    </button>
                </div>
            </div>
        </div>
    `;
};

function CartPanel({ companyInfo, posData, handleClearCart, getPriceForProduct, handleUpdateQuantity, handleRemoveFromCart, totals, onDiscountChange, onFinalizeSale, onOpenPricePopover, isPriceRuleActive, setIsClienteFormOpen, formatCurrency, handleOpenCierreModal, currentModoCaja, user,
    cart, customPrices, selectedClientId, setSelectedClientId, activePriceListId, setActivePriceListId, taxRate, setTaxRate, discountValue, canUseCashRegister
}) {
    const activePriceListName = useMemo(() => {
        return posData.price_lists.find(pl => pl.id === activePriceListId)?.nombre || '';
    }, [activePriceListId, posData.price_lists]);

    const canCloseCaja = user.role !== 'Empleado' || currentModoCaja === 'por_usuario';
    
    const { listas_precios, catalogo_web } = companyInfo.planDetails.features;

    const availablePriceLists = useMemo(() => {
        if (listas_precios) {
            return posData.price_lists; // Funcionalidad completa
        }
        if (!listas_precios && catalogo_web) {
            return posData.price_lists.filter(
                pl => pl.es_predeterminada || pl.nombre === 'Ofertas Web'
            ); // Funcionalidad limitada
        }
        // !listas_precios && !catalogo_web
        return posData.price_lists.filter(pl => pl.es_predeterminada); // Funcionalidad básica
    }, [posData.price_lists, listas_precios, catalogo_web]);

    const isPriceListDisabled = !listas_precios && !catalogo_web;
    
    return html`
        <div class="p-4 flex-shrink-0 border-b flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-800">Carrito de Venta</h2>
            
            <div class="flex items-center gap-3">
                ${canUseCashRegister && currentModoCaja && canCloseCaja && html`
                    <div class="flex items-center bg-slate-100 rounded-full text-sm font-medium text-slate-700 shadow-sm">
                        <div class="flex items-center gap-1.5 pl-3 py-1.5">
                            ${currentModoCaja === 'por_usuario' ? ICONS.users : ICONS.storefront}
                            <span>${currentModoCaja === 'por_usuario' ? 'Por Usuario' : 'Por Sucursal'}</span>
                        </div>
                        <div class="h-5 w-px bg-slate-300 mx-2"></div>
                        <button onClick=${handleOpenCierreModal} class="flex items-center gap-1 pr-3 py-1.5 text-amber-600 hover:text-amber-800 rounded-r-full hover:bg-slate-200 transition-colors">
                            ${ICONS.savings}
                            <span>Cerrar Caja</span>
                        </button>
                    </div>
                `}

                <button onClick=${handleClearCart} disabled=${cart.length === 0} class="p-2 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600 disabled:text-gray-300 disabled:bg-transparent disabled:cursor-not-allowed transition-colors" title="Vaciar Carrito">
                    ${ICONS.delete}
                </button>
            </div>
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
                    <div class="text-5xl">${ICONS.pos}</div>
                    <p class="mt-2 font-semibold">Carrito Vacío</p>
                    <p class="text-sm">Añade productos desde el catálogo.</p>
                </div>
            ` : cart.map((item, index) => {
                const product = item.product;
                let priceSource = 'default';
                const activePriceInfo = product.prices?.[activePriceListId];

                if (activePriceListId !== posData.price_lists.find(pl => pl.es_predeterminada)?.id && isPriceRuleActive(activePriceInfo)) {
                    priceSource = 'specific';
                }

                return html`
                <div class="border-b ${index === cart.length - 1 ? 'border-transparent' : 'border-gray-200'}">
                    <${CartItem} 
                        item=${item} 
                        originalPrice=${getPriceForProduct(item.product)}
                        customPrice=${customPrices[item.product.id]?.newPrice}
                        onUpdateQuantity=${handleUpdateQuantity} 
                        onRemove=${handleRemoveFromCart}
                        onOpenPricePopover=${onOpenPricePopover}
                        priceSource=${priceSource}
                        activePriceListName=${activePriceListName}
                        formatCurrency=${formatCurrency}
                    />
                </div>
            `})}
        </div>

        <div class="p-4 bg-gray-50 border-t flex-shrink-0 space-y-4">
            <div class="space-y-2 text-sm">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Subtotal</span>
                    <span class="font-medium text-gray-800">${formatCurrency(totals.subtotal)}</span>
                </div>
                
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Impuesto</span>
                    <div class="flex items-center gap-2">
                        <div class="flex items-center rounded-md shadow-sm bg-white border border-gray-300 focus-within:border-[#0d6efd] focus-within:ring-4 focus-within:ring-[#0d6efd]/25 transition-colors duration-150 w-24">
                            <span class="pl-2 text-gray-500 text-sm">%</span>
                            <input type="number" value=${taxRate} onInput=${e => setTaxRate(e.target.value)} placeholder="0" class="w-full border-0 bg-transparent p-1 text-sm text-right text-gray-900 focus:ring-0 focus:outline-none" />
                        </div>
                        <span class="font-medium text-gray-800 w-24 text-right">+ ${formatCurrency(totals.taxAmount)}</span>
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
                            <span class="font-medium text-red-600 w-24 text-right">- ${formatCurrency(totals.totalDiscount)}</span>
                        </div>
                        ${totals.maxGlobalDiscount > 0 && html`
                            <p class="text-xs text-gray-500 mt-1">Máx: ${formatCurrency(totals.maxGlobalDiscount)}</p>
                        `}
                    </div>
                </div>

                <div class="flex justify-between items-baseline text-2xl font-bold border-t pt-2 mt-2">
                    <span class="text-gray-900">Total</span>
                    <span class="text-primary">${formatCurrency(totals.finalTotal)}</span>
                </div>
            </div>
            <button onClick=${onFinalizeSale} disabled=${cart.length === 0} class="w-full flex items-center justify-center gap-2 text-center rounded-lg bg-green-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed">
                ${ICONS.pos}
                Finalizar Venta
            </button>
        </div>
    `;
}

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

export function TerminalVentaPage({ user, onLogout, onProfileUpdate, companyInfo, navigate }) {
    const breadcrumbs = [ { name: 'Punto de Venta', href: '#/terminal-venta' } ];
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    
    // State from Context
    const {
        cart, setCart, customPrices, setCustomPrices, selectedClientId, setSelectedClientId,
        activePriceListId, setActivePriceListId, taxRate, setTaxRate, discountValue, setDiscountValue
    } = useTerminalVenta();

    // Local UI State
    const [posData, setPosData] = useState({ products: [], price_lists: [], clients: [] });
    const [filters, setFilters] = useState(initialFilters);
    const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ categories: [], brands: [] });
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    const [productForDetailView, setProductForDetailView] = useState(null);
    const [isCartSidebarOpen, setCartSidebarOpen] = useState(false);
    const [pricePopover, setPricePopover] = useState({ isOpen: false, item: null, target: null });
    const [isClienteFormOpen, setIsClienteFormOpen] = useState(false);
    const [clienteToEdit, setClienteToEdit] = useState(null);
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [skuInput, setSkuInput] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [activeSession, setActiveSession] = useState(null);
    const [sessionState, setSessionState] = useState('checking');
    const [isCierreModalOpen, setIsCierreModalOpen] = useState(false);
    const [sessionSummary, setSessionSummary] = useState(null);
    const [currentModoCaja, setCurrentModoCaja] = useState(companyInfo.modo_caja);
    
    const canUseCashRegister = !!companyInfo?.planDetails?.features?.aperturar_cajas;

    const formatCurrency = (value) => {
        const number = Number(value || 0);
        const formattedNumber = number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${companyInfo.monedaSimbolo} ${formattedNumber}`;
    };
    
    const checkActiveSession = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('get_sesion_activa');
            if (error) throw error;
            setActiveSession(data?.session || null);
            if (data?.modo_caja) setCurrentModoCaja(data.modo_caja);
            setSessionState(data?.session ? 'open' : 'closed');
        } catch (err) {
            addToast({ message: `Error al verificar sesión: ${err.message}`, type: 'error' });
            setSessionState('closed');
        }
    }, [addToast]);
    
    const handleOpenCierreModal = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_resumen_sesion_activa');
            if (error) throw error;
            const summaryWithTheoretical = { ...data, saldo_final_teorico_efectivo: data.saldo_inicial + data.total_ventas_efectivo - data.total_gastos_efectivo };
            setSessionSummary(summaryWithTheoretical);
            setIsCierreModalOpen(true);
        } catch (err) {
            addToast({ message: `Error al obtener resumen: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    const handleConfirmCierre = async (saldoReal, totales) => {
        startLoading();
        try {
            const { error } = await supabase.rpc('cerrar_caja', { p_sesion_id: sessionSummary.id, p_saldo_final_real_efectivo: saldoReal, p_totales: totales });
            if (error) throw error;
            addToast({ message: 'Caja cerrada exitosamente.', type: 'success' });
            setIsCierreModalOpen(false);
            setSessionSummary(null);
            setActiveSession(null);
            setSessionState('closed');
        } catch (err) {
            addToast({ message: `Error al cerrar la caja: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    const fetchData = useCallback(async () => {
        try {
            const [posDataRes, optionsRes, clientsRes] = await Promise.all([
                supabase.rpc('get_pos_data'),
                supabase.rpc('get_inventory_filter_data'),
                supabase.rpc('get_company_clients') // Added specific call for clients
            ]);
    
            if (posDataRes.error) throw posDataRes.error;
            if (optionsRes.error) throw optionsRes.error;
            if (clientsRes.error) throw clientsRes.error; // Added error check for clients
    
            // Combine data, prioritizing the specific client fetch over the potentially failing one
            const combinedData = {
                ...(posDataRes.data || { products: [], price_lists: [] }),
                clients: clientsRes.data || []
            };
    
            setPosData(combinedData);
            setFilterOptions(optionsRes.data || { categories: [], brands: [] });
            
            const defaultList = combinedData.price_lists.find(pl => pl.es_predeterminada);
            if (activePriceListId === null) {
                if (defaultList) setActivePriceListId(defaultList.id);
                else if (combinedData.price_lists.length > 0) setActivePriceListId(combinedData.price_lists[0].id);
            }
        } catch (err) {
            addToast({ message: `Error crítico al cargar datos: ${err.message}`, type: 'error', duration: 10000 });
        }
    }, [addToast, activePriceListId, setActivePriceListId]);
    
    const internalFetch = useCallback(async () => {
        startLoading();
        try {
            const promises = [fetchData()];
            if (canUseCashRegister) {
                promises.push(checkActiveSession());
            }
            await Promise.all(promises);
        } finally {
            stopLoading();
        }
    }, [checkActiveSession, fetchData, startLoading, stopLoading, canUseCashRegister]);

    useEffect(() => {
        internalFetch();
    }, [internalFetch]);
    
    useRealtimeListener(internalFetch);

    useEffect(() => {
        if (isCartSidebarOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'auto';
        return () => { document.body.style.overflow = 'auto'; };
    }, [isCartSidebarOpen]);


    const cartMap = useMemo(() => new Map(cart.map(item => [item.product.id, item])), [cart]);
    const totalItemsInCart = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

    const filteredProducts = useMemo(() => {
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

    const quickAccessProducts = useMemo(() => {
        return [...posData.products]
            .filter(p => p.stock_sucursal > 0)
            .sort((a, b) => (b.unidades_vendidas_90_dias || 0) - (a.unidades_vendidas_90_dias || 0))
            .slice(0, 8);
    }, [posData.products]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };
    
    const handleClearFilters = () => {
        setFilters(initialFilters);
        if(isAdvancedSearchOpen) setIsAdvancedSearchOpen(false);
    };

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
    
    const handleShowDetails = (product) => { setProductForDetailView(product); setDetailModalOpen(true); };

    const handleAddToCart = (product) => {
        setCart((currentCart) => {
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
        if (isAvailable) handleAddToCart(product);
        else {
            if (getDefaultPriceForProduct(product) <= 0) addToast({ message: 'Este producto no tiene un precio asignado.', type: 'warning' });
            else handleShowDetails(product);
        }
    };

    const handleScanSuccess = (scannedSku) => {
        setIsScannerOpen(false);
        const product = posData.products.find(p => p.sku === scannedSku);
        if (product) {
            addToast({ message: `Producto "${product.nombre}" añadido.`, type: 'success' });
            handleProductAction(product, product.stock_sucursal > 0 && getDefaultPriceForProduct(product) > 0);
        } else {
            addToast({ message: `Producto con código "${scannedSku}" no encontrado.`, type: 'error' });
        }
    };

    const handleSkuSubmit = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const term = skuInput.trim();
            if (!term) return;

            const product = posData.products.find(p => p.sku === term);
            if (product) {
                handleProductAction(product, product.stock_sucursal > 0 && getDefaultPriceForProduct(product) > 0);
                setSkuInput('');
            } else {
                addToast({ message: `Producto con SKU "${term}" no encontrado.`, type: 'error' });
            }
        }
    };

    const handleUpdateQuantity = (productId, newQuantity) => {
        if (isNaN(newQuantity)) return;
        if (newQuantity <= 0) { handleRemoveFromCart(productId); return; }
        setCart((currentCart) => {
            const itemToUpdate = currentCart.find(item => item.product.id === productId);
            if (!itemToUpdate) return currentCart;
            let finalQuantity = newQuantity > itemToUpdate.product.stock_sucursal ? itemToUpdate.product.stock_sucursal : newQuantity;
            if (newQuantity > itemToUpdate.product.stock_sucursal) addToast({ message: `Stock máximo (${itemToUpdate.product.stock_sucursal}) alcanzado.`, type: 'warning' });
            return currentCart.map(item => item.product.id === productId ? { ...item, quantity: finalQuantity } : item);
        });
    };

    const handleRemoveFromCart = (productId) => {
        setCart((currentCart) => currentCart.filter(item => item.product.id !== productId));
        setCustomPrices(prev => { const newPrices = { ...prev }; delete newPrices[productId]; return newPrices; });
    };

    const handleClearCart = () => { setCart([]); setTaxRate(''); setDiscountValue(''); setCustomPrices({}); setSelectedClientId(null); };
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

    const handleSaveCliente = (action, savedClient) => {
        setIsClienteFormOpen(false);
        addToast({ message: `Cliente ${action === 'edit' ? 'actualizado' : 'creado'} con éxito.`, type: 'success' });
        fetchData().then(() => { if (action === 'create') setSelectedClientId(savedClient.id); });
    };

    const totals = useMemo(() => {
        const subtotal = cart.reduce((total, item) => {
            const originalPrice = getActivePriceForProduct(item.product);
            const effectivePrice = customPrices[item.product.id]?.newPrice ?? originalPrice;
            return total + (effectivePrice * item.quantity);
        }, 0);
        const tax = Number(taxRate) || 0;
        let taxAmount = 0;
        if (tax > 0 && tax < 100) taxAmount = (subtotal / (1 - tax / 100)) - subtotal;
        const implicitDiscountTotal = cart.reduce((total, item) => {
            const originalPrice = getActivePriceForProduct(item.product);
            const customPrice = customPrices[item.product.id]?.newPrice;
            if (customPrice !== undefined) total += (originalPrice - customPrice) * item.quantity;
            return total;
        }, 0);
        const totalAvailableMargin = cart.reduce((margin, item) => {
            const priceInfo = getPriceInfoForProduct(item.product);
            return margin + ((Number(priceInfo.ganancia_maxima || 0) - Number(priceInfo.ganancia_minima || 0)) * item.quantity);
        }, 0);
        const maxGlobalDiscount = Math.max(0, totalAvailableMargin - implicitDiscountTotal);
        const globalDiscountAmount = Math.max(0, Math.min(Number(discountValue) || 0, maxGlobalDiscount));
        const totalDiscount = globalDiscountAmount;
        const finalTotal = subtotal + taxAmount - totalDiscount;
        return { subtotal, taxAmount, totalDiscount, maxGlobalDiscount, finalTotal: Math.max(0, finalTotal) };
    }, [cart, activePriceListId, taxRate, discountValue, customPrices, getActivePriceForProduct, getPriceInfoForProduct]);
    
    const handleDiscountChange = (e) => {
        const rawValue = e.target.value;
        const numericValue = Number(rawValue);
        if (rawValue !== '' && (isNaN(numericValue) || numericValue < 0)) return;
        if (numericValue > totals.maxGlobalDiscount) {
            setDiscountValue(totals.maxGlobalDiscount.toFixed(2));
            addToast({ message: `Descuento ajustado al máximo: ${formatCurrency(totals.maxGlobalDiscount)}`, type: 'warning' });
        } else setDiscountValue(rawValue);
    };

    const handleConfirmSale = async (saleDetails) => {
        startLoading();
        setIsCheckoutModalOpen(false);
        try {
            const { error } = await supabase.rpc('registrar_venta', {
                p_venta: {
                    cliente_id: selectedClientId,
                    sucursal_id: user.sucursal_id,
                    total: saleDetails.total,
                    subtotal: totals.subtotal,
                    descuento: totals.totalDiscount,
                    impuestos: totals.taxAmount,
                    tipo_venta: saleDetails.tipoVenta,
                    fecha_vencimiento: saleDetails.fechaVencimiento,
                },
                p_items: cart.map(item => {
                    const originalPrice = getActivePriceForProduct(item.product);
                    const effectivePrice = customPrices[item.product.id]?.newPrice ?? originalPrice;
                    const priceInfo = getPriceInfoForProduct(item.product);
                    return {
                        producto_id: item.product.id,
                        cantidad: item.quantity,
                        precio_unitario_aplicado: effectivePrice,
                        costo_unitario_en_venta: (priceInfo.precio - priceInfo.ganancia_maxima) || 0,
                    };
                }),
                p_pagos: saleDetails.pagos
            });

            if (error) throw error;
            addToast({ message: 'Venta registrada con éxito.', type: 'success' });
            handleClearCart();
            await fetchData();
        } catch (err) {
            addToast({ message: `Error al registrar la venta: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };
    
    if (canUseCashRegister) {
        if (sessionState === 'checking') {
            return html`<${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} activeLink="Punto de Venta" breadcrumbs=${breadcrumbs} companyInfo=${companyInfo} disablePadding=${true}><div class="h-full"></div><//>`;
        }
    
        if (sessionState === 'closed') {
            return html`<${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} activeLink="Punto de Venta" breadcrumbs=${breadcrumbs} companyInfo=${companyInfo} disablePadding=${true}><${AperturaCajaModal} onSessionOpen=${internalFetch} companyInfo=${companyInfo} user=${user} navigate=${navigate} modoCaja=${currentModoCaja} /><//>`;
        }
    }

    const cartPanelProps = {
        posData, companyInfo, handleClearCart, getPriceForProduct: getActivePriceForProduct, handleUpdateQuantity, handleRemoveFromCart, totals,
        onDiscountChange: handleDiscountChange, onFinalizeSale: () => setIsCheckoutModalOpen(true), onOpenPricePopover: handleOpenPricePopover,
        isPriceRuleActive, setIsClienteFormOpen, formatCurrency, handleOpenCierreModal, currentModoCaja, user,
        cart, customPrices, selectedClientId, setSelectedClientId, activePriceListId, setActivePriceListId, taxRate, setTaxRate, discountValue,
        canUseCashRegister
    };
    
    const mobileActions = html`
        <div class="flex lg:hidden items-center gap-2">
            <button onClick=${() => setIsScannerOpen(true)} class="flex-shrink-0 flex items-center justify-center p-2.5 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors" title="Escanear código de barras con la cámara">
                ${ICONS.qr_code_scanner}
            </button>
            <button onClick=${() => setCartSidebarOpen(true)} class="relative flex-shrink-0 flex items-center justify-center p-2.5 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors" title="Ver carrito">
                <span class="text-2xl">${ICONS.shopping_cart}</span>
                ${totalItemsInCart > 0 && html`<div class="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold">${totalItemsInCart > 9 ? '9+' : totalItemsInCart}</div>`}
            </button>
        </div>
    `;

    return html`
        <${DashboardLayout} 
            user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate}
            activeLink="Punto de Venta" breadcrumbs=${breadcrumbs} companyInfo=${companyInfo}
            disablePadding=${true}
        >
            <div class="h-full lg:grid lg:grid-cols-[1fr_450px] lg:gap-6 lg:p-6">
                <div class="bg-white rounded-lg border shadow-sm h-full flex flex-col lg:h-auto overflow-hidden">
                    <div class="flex-shrink-0 p-4 border-b space-y-4">
                        <div class="hidden lg:flex gap-2">
                            <div class="relative flex-grow">
                                <${FormInput}
                                    name="sku_input" type="text" label="" value=${skuInput} onInput=${e => setSkuInput(e.target.value)} onKeyDown=${handleSkuSubmit}
                                    placeholder="Ingresar SKU y presionar Enter" required=${false} icon=${ICONS.search}
                                />
                            </div>
                            <button onClick=${() => setIsScannerOpen(true)} class="flex-shrink-0 flex items-center justify-center p-2.5 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors" title="Escanear código de barras con la cámara">
                                ${ICONS.qr_code_scanner}
                            </button>
                        </div>
                         <${FilterBar} 
                            filters=${filters} onFilterChange=${handleFilterChange} onClear=${handleClearFilters}
                            onToggleAdvanced=${() => setIsAdvancedSearchOpen(p => !p)} isAdvancedOpen=${isAdvancedSearchOpen}
                            statusOptions=${posStatusOptions}
                            rightActions=${mobileActions}
                        />
                        <${AdvancedFilterPanel} isOpen=${isAdvancedSearchOpen} filters=${filters} onFilterChange=${handleFilterChange} filterOptions=${filterOptions} />
                    </div>

                    <div class="p-4 flex-grow overflow-y-auto">
                        ${quickAccessProducts.length > 0 && html`
                            <div class="mb-6">
                                <h3 class="text-sm font-semibold text-gray-600 mb-2">Acceso Rápido</h3>
                                <div class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                                    ${quickAccessProducts.map(p => html`
                                        <${QuickAccessButton} product=${p} onClick=${() => handleProductAction(p, true)} formatCurrency=${formatCurrency}/>
                                    `)}
                                </div>
                            </div>
                        `}
                        <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));">
                            ${filteredProducts.map(p => html`
                                <${ProductCard} 
                                    product=${p} onAction=${handleProductAction} onShowDetails=${handleShowDetails}
                                    defaultPrice=${getDefaultPriceForProduct(p)} quantityInCart=${cartMap.get(p.id)?.quantity || 0}
                                    formatCurrency=${formatCurrency}
                                />
                            `)}
                        </div>
                    </div>
                </div>
                
                <div class="hidden lg:block">
                     <div class="sticky top-6">
                        <div class="flex flex-col bg-white rounded-lg border shadow-sm max-h-[calc(100vh-7rem)]">
                            <${CartPanel} ...${cartPanelProps} />
                        </div>
                    </div>
                </div>
                
                <div class=${`fixed inset-0 z-40 flex justify-end lg:hidden transition-opacity duration-300 ${isCartSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} role="dialog" aria-modal="true">
                    <div class="fixed inset-0 bg-black/60" aria-hidden="true" onClick=${() => setCartSidebarOpen(false)}></div>
                    <div class=${`relative flex w-full max-w-md flex-1 flex-col bg-slate-50 transform transition duration-300 ${isCartSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                       <div class="absolute top-0 left-0 -ml-12 pt-2">
                            <button type="button" class="ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white focus:outline-none" onClick=${() => setCartSidebarOpen(false)}>
                                <span class="sr-only">Cerrar carrito</span>
                                ${ICONS.close}
                            </button>
                        </div>
                        <div class="flex flex-col h-full overflow-hidden">
                            <${CartPanel} ...${cartPanelProps} />
                        </div>
                    </div>
                </div>
            </div>
            
            ${pricePopover.isOpen && html`<${SetPricePopover} item=${pricePopover.item} targetElement=${pricePopover.target} onClose=${handleClosePricePopover} onApply=${handleApplyCustomPrice} getPriceInfo=${getPriceInfoForProduct} addToast=${addToast} formatCurrency=${formatCurrency} />`}
            <${ClienteFormModal} isOpen=${isClienteFormOpen} onClose=${() => setIsClienteFormOpen(false)} onSave=${handleSaveCliente} clienteToEdit=${clienteToEdit} user=${user} />
            <${ProductDetailModal} isOpen=${isDetailModalOpen} onClose=${() => setDetailModalOpen(false)} product=${productForDetailView} currentUserSucursal=${user.sucursal} />
            <${CheckoutModal} isOpen=${isCheckoutModalOpen} onClose=${() => setIsCheckoutModalOpen(false)} onConfirm=${handleConfirmSale} total=${totals.finalTotal} clienteId=${selectedClientId} companyInfo=${companyInfo} />
            <${CameraScanner} isOpen=${isScannerOpen} onClose=${() => setIsScannerOpen(false)} onScanSuccess=${handleScanSuccess} />
            <${CierreCajaModal} isOpen=${isCierreModalOpen} onClose=${() => setIsCierreModalOpen(false)} onConfirm=${handleConfirmCierre} sessionSummary=${sessionSummary} companyInfo=${companyInfo} user=${user} modoCaja=${currentModoCaja} />
        <//>
    `;
}