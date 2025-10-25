/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { ICONS } from '../../components/Icons.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../hooks/useToast.js';
import { DireccionFormModal } from '../../components/modals/DireccionFormModal.js';
import { Spinner } from '../../components/Spinner.js';

const formatCurrency = (value, currencySymbol = 'Bs') => {
    const number = Number(value || 0);
    return `${currencySymbol} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const QuantityControl = ({ quantity, onUpdate }) => {
    const handleInput = (e) => {
        const value = parseInt(e.target.value, 10);
        onUpdate(isNaN(value) || value < 1 ? 1 : value);
    };

    return html`
        <div class="flex items-center rounded-md border border-gray-300 bg-white shadow-sm overflow-hidden focus-within:border-[#0d6efd] focus-within:ring-4 focus-within:ring-[#0d6efd]/25 w-28 transition-all">
            <button onClick=${() => onUpdate(Math.max(1, quantity - 1))} class="px-2 py-1 text-gray-500 hover:bg-gray-100 h-full">${ICONS.remove_circle}</button>
            <input 
                type="number"
                value=${quantity}
                onInput=${handleInput}
                onFocus=${e => e.target.select()}
                class="w-full text-center border-0 bg-white text-gray-900 font-semibold p-1 focus:ring-0"
                min="1"
            />
            <button onClick=${() => onUpdate(quantity + 1)} class="px-2 py-1 text-gray-500 hover:bg-gray-100 h-full">${ICONS.add_circle}</button>
        </div>
    `;
};

export function CatalogCartPage({ cart, onUpdateQuantity, onPlaceOrder, company, navigate, slug, customerProfile, sucursales = [] }) {
    const [deliveryMethod, setDeliveryMethod] = useState('domicilio');
    const [addresses, setAddresses] = useState([]);
    const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [selectedSucursalId, setSelectedSucursalId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { addToast } = useToast();
    
    const [selectedDispatchSucursalId, setSelectedDispatchSucursalId] = useState(null);

    const dispatchOptions = useMemo(() => {
        if (!sucursales || !cart || cart.length === 0) return [];
        
        return sucursales.map(sucursal => {
            let fullStock = true;
            let partialStock = false;
            
            for (const item of cart) {
                const stockInfo = item.all_branch_stock?.find(s => s.id === sucursal.id);
                const stock = stockInfo ? stockInfo.cantidad : 0;
                
                if (stock < item.quantity) {
                    fullStock = false;
                }
                if (stock > 0) {
                    partialStock = true;
                }
            }
            
            if (fullStock) return { ...sucursal, stockStatus: 'full' };
            if (partialStock) return { ...sucursal, stockStatus: 'partial' };
            return { ...sucursal, stockStatus: 'none' };
        }).sort((a, b) => {
            if (a.stockStatus === 'full' && b.stockStatus !== 'full') return -1;
            if (a.stockStatus !== 'full' && b.stockStatus === 'full') return 1;
            if (a.stockStatus === 'partial' && b.stockStatus === 'none') return -1;
            if (a.stockStatus === 'none' && b.stockStatus === 'partial') return 1;
            return 0;
        });
    }, [sucursales, cart]);

    const fetchAddresses = useCallback(async () => {
        if (!customerProfile) return;
        setIsLoadingAddresses(true);
        try {
            const { data, error } = await supabase.rpc('get_my_direcciones');
            if (error) throw error;
            setAddresses(data);
            const principal = data.find(d => d.es_principal);
            if (principal) {
                setSelectedAddressId(principal.id);
            } else if (data.length > 0) {
                setSelectedAddressId(data[0].id);
            }
        } catch (err) {
            addToast({ message: 'Error al cargar tus direcciones.', type: 'error' });
        } finally {
            setIsLoadingAddresses(false);
        }
    }, [customerProfile, addToast]);

    useEffect(() => {
        if (deliveryMethod === 'domicilio') {
            fetchAddresses();
        } else if (deliveryMethod === 'retiro' && sucursales.length > 0) {
            setSelectedSucursalId(sucursales[0].id);
        }
    }, [deliveryMethod, fetchAddresses, sucursales]);
    
    useEffect(() => {
        if (deliveryMethod === 'domicilio' && dispatchOptions.length > 0 && !selectedDispatchSucursalId) {
            const firstFullStock = dispatchOptions.find(opt => opt.stockStatus === 'full');
            if (firstFullStock) {
                setSelectedDispatchSucursalId(firstFullStock.id);
            }
        }
    }, [deliveryMethod, dispatchOptions, selectedDispatchSucursalId]);


    const handleConfirmOrder = () => {
        if (deliveryMethod === 'domicilio') {
            if (!selectedDispatchSucursalId) {
                addToast({ message: 'Por favor, selecciona una sucursal para el despacho.', type: 'warning'});
                return;
            }
            if (!selectedAddressId) {
                addToast({ message: 'Por favor, selecciona o añade una dirección de envío.', type: 'warning' });
                return;
            }
            onPlaceOrder({ addressId: selectedAddressId, sucursalId: selectedDispatchSucursalId });
        } else if (deliveryMethod === 'retiro') {
            if (!selectedSucursalId) {
                addToast({ message: 'Por favor, selecciona una sucursal para el retiro.', type: 'warning' });
                return;
            }
            onPlaceOrder({ addressId: null, sucursalId: selectedSucursalId });
        }
    };
    
    const subtotal = cart.reduce((sum, item) => sum + (item.precio_oferta > 0 && item.precio_oferta < item.precio_base ? item.precio_oferta : item.precio_base) * item.quantity, 0);

    if (cart.length === 0) {
        return html`
            <div class="mx-auto max-w-2xl px-4 pb-24 pt-16 sm:px-6 lg:max-w-7xl lg:px-8 text-center">
                <div class="text-6xl text-gray-300">${ICONS.shopping_cart}</div>
                <h1 class="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Tu carrito está vacío</h1>
                <p class="mt-4 text-base text-gray-500">Explora nuestros productos y encuentra algo que te guste.</p>
                <div class="mt-6">
                    <a href=${`/#/catalogo/${slug}/productos`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}/productos`); }} class="inline-block rounded-md border border-transparent bg-primary px-5 py-3 text-base font-medium text-white hover:bg-primary-hover">
                        Explorar Productos
                    </a>
                </div>
            </div>
        `;
    }

    return html`
        <div class="mx-auto max-w-2xl px-4 pb-24 pt-16 sm:px-6 lg:max-w-7xl lg:px-8">
            <h1 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Tu Carrito</h1>
            <div class="mt-12 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-12 xl:gap-x-16">
                <section aria-labelledby="cart-heading" class="lg:col-span-7">
                    <h2 id="cart-heading" class="sr-only">Items en tu carrito</h2>
                    <ul role="list" class="divide-y divide-gray-200 border-b border-t border-gray-200">
                        ${cart.map(item => {
                            const displayPrice = item.precio_oferta > 0 && item.precio_oferta < item.precio_base ? item.precio_oferta : item.precio_base;
                            return html`
                                <li key=${item.id} class="flex py-6 sm:py-10">
                                    <div class="flex-shrink-0">
                                        <img src=${item.imagen_principal || NO_IMAGE_ICON_URL} alt=${item.nombre} class="h-24 w-24 rounded-md object-cover object-center sm:h-48 sm:w-48" />
                                    </div>
                                    <div class="ml-4 flex flex-1 flex-col justify-between sm:ml-6">
                                        <div class="relative pr-9 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:pr-0">
                                            <div>
                                                <div class="flex justify-between">
                                                    <h3 class="text-sm"><a href=${`/#/catalogo/${slug}/producto/${item.id}`} onClick=${(e) => {e.preventDefault(); navigate(`/catalogo/${slug}/producto/${item.id}`)}} class="font-medium text-gray-700 hover:text-gray-800">${item.nombre}</a></h3>
                                                </div>
                                                <p class="mt-1 text-sm font-medium text-gray-900">${formatCurrency(displayPrice, company.moneda_simbolo)}</p>
                                            </div>
                                            <div class="mt-4 sm:mt-0 sm:pr-9">
                                                <${QuantityControl} quantity=${item.quantity} onUpdate=${(newQty) => onUpdateQuantity(item.id, newQty)} />
                                                <div class="absolute right-0 top-0">
                                                    <button onClick=${() => onUpdateQuantity(item.id, 0)} type="button" class="-m-2 inline-flex p-2 text-gray-400 hover:text-gray-500">
                                                        <span class="sr-only">Remove</span>
                                                        ${ICONS.close}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            `;
                        })}
                    </ul>
                </section>

                <section aria-labelledby="summary-heading" class="mt-16 rounded-lg bg-gray-50 px-4 py-6 sm:p-6 lg:col-span-5 lg:mt-0 lg:p-8 sticky top-24">
                    <h2 id="summary-heading" class="text-lg font-medium text-gray-900">Resumen del Pedido</h2>
                    
                    <div class="mt-6">
                        <h3 class="text-base font-medium text-gray-800">Método de Entrega</h3>
                        <div class="mt-2 grid grid-cols-2 gap-2">
                            <button onClick=${() => setDeliveryMethod('domicilio')} class=${`flex flex-col items-center justify-center p-3 rounded-md border text-sm transition-colors ${deliveryMethod === 'domicilio' ? 'bg-primary-light border-primary ring-2 ring-primary text-primary-dark' : 'bg-white text-gray-900'}`}>
                                <div class=${deliveryMethod === 'domicilio' ? 'text-primary-dark' : 'text-gray-900'}>${ICONS.suppliers}</div> <span class="font-semibold mt-1">Envío a Domicilio</span>
                            </button>
                            <button onClick=${() => setDeliveryMethod('retiro')} class=${`flex flex-col items-center justify-center p-3 rounded-md border text-sm transition-colors ${deliveryMethod === 'retiro' ? 'bg-primary-light border-primary ring-2 ring-primary text-primary-dark' : 'bg-white text-gray-900'}`}>
                                <div class=${deliveryMethod === 'retiro' ? 'text-primary-dark' : 'text-gray-900'}>${ICONS.storefront}</div> <span class="font-semibold mt-1">Retiro en Sucursal</span>
                            </button>
                        </div>
                    </div>

                    ${deliveryMethod === 'domicilio' && html`
                        <div class="mt-6 space-y-6 animate-fade-in-down">
                            <div>
                                <h3 class="text-base font-medium text-gray-800">1. Selecciona Sucursal de Despacho</h3>
                                <div class="mt-2 space-y-2">
                                    ${dispatchOptions.map(opt => {
                                        const statusColors = {
                                            full: { bg: 'bg-green-50', border: 'border-green-300', ring: 'ring-green-500', text: 'text-green-900', subtext: 'text-green-700', label: 'Stock Completo' },
                                            partial: { bg: 'bg-amber-50', border: 'border-amber-300', ring: 'ring-amber-500', text: 'text-amber-900', subtext: 'text-amber-700', label: 'Stock Parcial' },
                                            none: { bg: 'bg-gray-100', border: 'border-gray-300', ring: 'ring-gray-500', text: 'text-gray-900', subtext: 'text-gray-500', label: 'Sin Stock' },
                                        };
                                        const colors = statusColors[opt.stockStatus];
                                        return html`
                                            <div onClick=${() => setSelectedDispatchSucursalId(opt.id)} class=${`p-3 rounded-md border cursor-pointer ${selectedDispatchSucursalId === opt.id ? `${colors.bg} ${colors.border} ring-2 ${colors.ring}` : 'bg-white'}`}>
                                                <div class="flex justify-between items-start">
                                                    <p class="font-semibold text-sm ${colors.text}">${opt.nombre}</p>
                                                    <span class="text-xs font-bold ${colors.subtext}">${colors.label}</span>
                                                </div>
                                                <p class="text-xs ${colors.subtext}">${opt.direccion}</p>
                                            </div>
                                        `;
                                    })}
                                </div>
                            </div>

                            ${selectedDispatchSucursalId && html`
                                <div class="animate-fade-in-down">
                                    <h3 class="text-base font-medium text-gray-800">2. Selecciona Dirección de Envío</h3>
                                    ${isLoadingAddresses ? html`<div class="flex justify-center p-4"><${Spinner} color="text-primary"/></div>` :
                                        addresses.length === 0 ? html`
                                            <div class="mt-2 text-center p-4 bg-white rounded-md border">
                                                <p class="text-sm text-gray-600">No tienes direcciones guardadas.</p>
                                                <button onClick=${() => setIsModalOpen(true)} class="mt-2 text-sm font-semibold text-primary hover:underline">Añadir una dirección</button>
                                            </div>
                                        ` : html`
                                            <div class="mt-2 space-y-2">
                                                ${addresses.map(addr => html`
                                                    <div onClick=${() => setSelectedAddressId(addr.id)} class=${`p-3 rounded-md border cursor-pointer ${selectedAddressId === addr.id ? 'bg-blue-100 border-blue-300 ring-2 ring-blue-500' : 'bg-white'}`}>
                                                        <p class="font-semibold text-sm ${selectedAddressId === addr.id ? 'text-blue-900' : 'text-gray-900'}">${addr.nombre} ${addr.es_principal ? '(Principal)' : ''}</p>
                                                        <p class="text-xs ${selectedAddressId === addr.id ? 'text-blue-700' : 'text-gray-600'}">${addr.direccion_texto}</p>
                                                    </div>
                                                `)}
                                                <button onClick=${() => setIsModalOpen(true)} class="text-sm font-semibold text-primary hover:underline">+ Añadir otra dirección</button>
                                            </div>
                                        `
                                    }
                                </div>
                            `}
                        </div>
                    `}
                     ${deliveryMethod === 'retiro' && html`
                        <div class="mt-6 animate-fade-in-down">
                            <h3 class="text-base font-medium text-gray-800">Sucursal para Retiro</h3>
                            ${sucursales.length === 0 ? html`
                                <p class="mt-2 text-sm p-4 bg-white rounded-md border text-gray-600">No hay sucursales disponibles para retiro.</p>
                            ` : html`
                                <div class="mt-2 space-y-2">
                                    ${sucursales.map(s => html`
                                        <div onClick=${() => setSelectedSucursalId(s.id)} class=${`p-3 rounded-md border cursor-pointer ${selectedSucursalId === s.id ? 'bg-blue-100 border-blue-300 ring-2 ring-blue-500' : 'bg-white'}`}>
                                            <p class="font-semibold text-sm ${selectedSucursalId === s.id ? 'text-blue-900' : 'text-gray-900'}">${s.nombre}</p>
                                            <p class="text-xs ${selectedSucursalId === s.id ? 'text-blue-700' : 'text-gray-600'}">${s.direccion}</p>
                                            <a href=${`https://maps.google.com/?q=${s.latitud},${s.longitud}`} target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-primary hover:underline mt-1 inline-block">Ver en mapa</a>
                                        </div>
                                    `)}
                                </div>
                            `}
                        </div>
                    `}

                    <dl class="mt-6 space-y-4 border-t pt-4">
                        <div class="flex items-center justify-between"><dt class="text-sm text-gray-600">Subtotal</dt><dd class="text-sm font-medium text-gray-900">${formatCurrency(subtotal, company.moneda_simbolo)}</dd></div>
                        <div class="flex items-center justify-between border-t border-gray-200 pt-4"><dt class="text-base font-medium text-gray-900">Total del Pedido</dt><dd class="text-base font-medium text-gray-900">${formatCurrency(subtotal, company.moneda_simbolo)}</dd></div>
                    </dl>
                    <div class="mt-6">
                        <button onClick=${handleConfirmOrder} class="w-full rounded-md border border-transparent bg-primary px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-50">
                            Finalizar Pedido
                        </button>
                    </div>
                </section>
            </div>
        </div>
        <${DireccionFormModal} 
            isOpen=${isModalOpen}
            onClose=${() => setIsModalOpen(false)}
            onSave=${() => { setIsModalOpen(false); fetchAddresses(); }}
        />
    `;
}