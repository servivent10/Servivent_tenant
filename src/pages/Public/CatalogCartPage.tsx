/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { ICONS } from '../../components/Icons.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';

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

export function CatalogCartPage({ cart, onUpdateQuantity, onPlaceOrder, company, navigate, slug }) {
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
                                                    <h3 class="text-sm"><a href="#" class="font-medium text-gray-700 hover:text-gray-800">${item.nombre}</a></h3>
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
                    <dl class="mt-6 space-y-4">
                        <div class="flex items-center justify-between">
                            <dt class="text-sm text-gray-600">Subtotal</dt>
                            <dd class="text-sm font-medium text-gray-900">${formatCurrency(subtotal, company.moneda_simbolo)}</dd>
                        </div>
                        <div class="flex items-center justify-between border-t border-gray-200 pt-4">
                            <dt class="text-base font-medium text-gray-900">Total del Pedido</dt>
                            <dd class="text-base font-medium text-gray-900">${formatCurrency(subtotal, company.moneda_simbolo)}</dd>
                        </div>
                    </dl>
                    <div class="mt-6">
                        <button onClick=${onPlaceOrder} class="w-full rounded-md border border-transparent bg-primary px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-50">
                            Finalizar Pedido
                        </button>
                    </div>
                    <div class="mt-6 text-center text-sm">
                        <p>o <a href=${`/#/catalogo/${slug}/productos`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}/productos`); }} class="font-medium text-primary hover:text-primary-hover">Continuar Comprando<span aria-hidden="true"> &rarr;</span></a></p>
                    </div>
                </section>
            </div>
        </div>
    `;
}