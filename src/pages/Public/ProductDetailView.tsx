/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { ICONS } from '../../components/Icons.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';

const formatCurrency = (value, currencySymbol = 'Bs') => {
    const number = Number(value || 0);
    return `${currencySymbol} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getStockStatus = (stock) => {
    if (stock <= 0) return { text: 'Agotado', color: 'text-red-600' };
    if (stock <= 5) return { text: 'Pocas Unidades', color: 'text-amber-600' };
    return { text: 'Disponible', color: 'text-green-600' };
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


export function ProductDetailView({ product, company, onAddToCart, navigate, slug }) {
    const [quantity, setQuantity] = useState(1);
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    const isAvailable = product.stock_consolidado > 0;
    const hasOffer = product.precio_oferta > 0 && product.precio_oferta < product.precio_base;
    const displayPrice = hasOffer ? product.precio_oferta : product.precio_base;
    const stockStatus = getStockStatus(product.stock_consolidado);
    const images = product.imagenes && product.imagenes.length > 0 ? product.imagenes : [{ url: product.imagen_principal || NO_IMAGE_ICON_URL }];

    const DetailItem = ({ label, value, isMono = false }) => {
        if (!value) return null;
        return html`
            <div class="sm:col-span-1">
                <dt class="text-sm font-medium text-gray-500">${label}</dt>
                <dd class="mt-1 text-sm text-gray-900 ${isMono ? 'font-mono' : ''}">${value}</dd>
            </div>
        `;
    };

    return html`
        <div>
            <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                <button onClick=${() => navigate(`/catalogo/${slug}/productos`)} class="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover mb-6">
                    ${ICONS.arrow_back} Volver al catálogo
                </button>
                <div class="flex flex-col lg:flex-row lg:gap-x-12">
                    <div class="lg:w-1/2">
                        <div class="flex flex-col-reverse">
                            {/* Thumbnails */}
                            <div class="mx-auto mt-6 hidden w-full max-w-2xl sm:block lg:max-w-none">
                                <div class="grid grid-cols-4 gap-6" aria-orientation="horizontal" role="tablist">
                                    ${images.map((image, idx) => html`
                                        <button onClick=${() => setActiveImageIndex(idx)} type="button" class="relative flex h-24 cursor-pointer items-center justify-center rounded-md bg-white text-sm font-medium uppercase text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring focus:ring-opacity-50 focus:ring-offset-4">
                                            <span class="sr-only">${idx + 1}</span>
                                            <span class="absolute inset-0 overflow-hidden rounded-md">
                                                <img src=${image.url} alt="" class="h-full w-full object-cover object-center" />
                                            </span>
                                            ${activeImageIndex === idx && html`<span class="pointer-events-none absolute inset-0 rounded-md ring-2 ring-primary ring-offset-2" aria-hidden="true"></span>`}
                                        </button>
                                    `)}
                                </div>
                            </div>
                            {/* Main Image */}
                            <div class="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden border">
                                <img src=${images[activeImageIndex].url} alt=${product.nombre} class="h-full w-full object-contain object-center" />
                            </div>
                        </div>
                    </div>

                    <div class="lg:w-1/2 mt-10 lg:mt-0">
                        <h1 class="text-3xl font-bold tracking-tight text-gray-900">${product.nombre}</h1>
                        <div class="mt-3">
                            <h2 class="sr-only">Información del producto</h2>
                             <div class="flex items-baseline gap-2">
                                <p class="text-3xl tracking-tight text-gray-900">${formatCurrency(displayPrice, company.moneda_simbolo)}</p>
                                ${hasOffer && html`<p class="text-xl text-gray-500 line-through">${formatCurrency(product.precio_base, company.moneda_simbolo)}</p>`}
                            </div>
                        </div>
                        <div class="mt-6">
                            <p class="font-medium ${stockStatus.color}">${stockStatus.text}</p>
                            <div class="mt-4 flex gap-4">
                                <${QuantityControl} quantity=${quantity} onUpdate=${setQuantity} />
                                <button 
                                    onClick=${() => onAddToCart(product, quantity)}
                                    disabled=${!isAvailable}
                                    class="flex-1 rounded-md px-8 py-3 text-base font-medium text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${isAvailable ? 'bg-primary hover:bg-primary-hover focus-visible:outline-primary' : 'bg-gray-400 cursor-not-allowed'}"
                                >
                                    Añadir al Carrito
                                </button>
                            </div>
                        </div>
                        
                        <div class="mt-8 border-t border-gray-200 pt-8">
                            <h3 class="text-base font-medium text-gray-900">Detalles Adicionales</h3>
                             <dl class="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                                <${DetailItem} label="Marca" value=${product.marca} />
                                <${DetailItem} label="Modelo" value=${product.modelo} />
                                <${DetailItem} label="Categoría" value=${product.categoria_nombre} />
                                <${DetailItem} label="SKU" value=${product.sku} isMono=${true} />
                            </dl>
                        </div>

                         <div class="mt-8 border-t border-gray-200 pt-8">
                            <h3 class="text-base font-medium text-gray-900">Descripción</h3>
                            <div class="mt-4 space-y-6 text-base text-gray-700" dangerouslySetInnerHTML=${{ __html: product.descripcion || 'Sin descripción detallada.'}}>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}