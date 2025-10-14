/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { supabase } from '../../lib/supabaseClient.js';
import { ICONS } from '../../components/Icons.js';
import { Spinner } from '../../components/Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { NO_IMAGE_ICON_URL } from '../../lib/config.js';

const formatCurrency = (value, currencySymbol = 'Bs') => {
    const number = Number(value || 0);
    return `${currencySymbol} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getStatusPill = (status) => {
    const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
    switch (status) {
        case 'Pagada': return `${baseClasses} bg-green-100 text-green-800`;
        case 'Pendiente': return `${baseClasses} bg-red-100 text-red-800`;
        case 'Abono Parcial': return `${baseClasses} bg-amber-100 text-amber-800`;
        case 'Pedido Web Pendiente': return `${baseClasses} bg-cyan-100 text-cyan-800`;
        default: return `${baseClasses} bg-gray-100 text-gray-800`;
    }
};

export function ClientePedidoDetailPage({ pedidoId, slug, navigate, company }) {
    const [order, setOrder] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        const fetchOrder = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase.rpc('get_my_web_order_details', { p_pedido_id: pedidoId });
                if (error) throw error;
                setOrder(data);
            } catch (err) {
                addToast({ message: `Error al cargar tu pedido: ${err.message}`, type: 'error' });
                navigate(`/catalogo/${slug}/cuenta`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrder();
    }, [pedidoId, slug, navigate]);

    if (isLoading) {
        return html`<div class="flex justify-center items-center h-screen"><${Spinner} color="text-primary" size="h-10 w-10" /></div>`;
    }

    if (!order) {
        return html`<div class="text-center p-10"><h2 class="text-xl font-bold text-red-600">Pedido no encontrado</h2></div>`;
    }

    return html`
        <div class="bg-white">
            <main class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                <div class="flex items-center gap-4 mb-8">
                    <button onClick=${() => navigate(`/catalogo/${slug}/cuenta`)} class="p-2 rounded-full hover:bg-gray-100" aria-label="Volver a mi cuenta">
                        ${ICONS.arrow_back}
                    </button>
                    <div>
                        <h1 class="text-3xl font-bold tracking-tight text-gray-900">Detalles del Pedido</h1>
                        <p class="text-sm text-gray-500">Pedido <span class="font-mono">${order.folio}</span> realizado el ${new Date(order.fecha).toLocaleDateString()}</p>
                    </div>
                </div>

                <section class="mt-8">
                    <h2 class="sr-only">Productos en tu pedido</h2>
                    <div class="space-y-8">
                        ${order.items.map(item => html`
                            <div key=${item.id} class="flex items-start border-b border-gray-200 pb-8">
                                <img src=${item.imagen_principal || NO_IMAGE_ICON_URL} alt=${item.producto_nombre} class="h-24 w-24 flex-shrink-0 rounded-lg object-cover sm:h-32 sm:w-32" />
                                <div class="ml-4 flex-1">
                                    <h3 class="text-base font-medium text-gray-900">${item.producto_nombre}</h3>
                                    <div class="mt-2 flex justify-between text-sm text-gray-600">
                                        <p>${item.cantidad} x ${formatCurrency(item.precio_unitario_aplicado, company.moneda_simbolo)}</p>
                                        <p class="font-medium text-gray-900">${formatCurrency(item.cantidad * item.precio_unitario_aplicado, company.moneda_simbolo)}</p>
                                    </div>
                                </div>
                            </div>
                        `)}
                    </div>
                </section>

                <section class="mt-8 sm:mt-10">
                    <div class="rounded-lg bg-gray-50 px-4 py-6 sm:p-6 lg:p-8">
                        <dl class="space-y-4">
                            <div class="flex items-center justify-between"><dt class="text-gray-600">Subtotal</dt><dd class="font-medium text-gray-900">${formatCurrency(order.subtotal, company.moneda_simbolo)}</dd></div>
                            <div class="flex items-center justify-between"><dt class="text-gray-600">Descuento</dt><dd class="font-medium text-red-600">- ${formatCurrency(order.descuento, company.moneda_simbolo)}</dd></div>
                            <div class="flex items-center justify-between border-t border-gray-200 pt-4 text-base font-medium text-gray-900">
                                <dt>Total del Pedido</dt>
                                <dd>${formatCurrency(order.total, company.moneda_simbolo)}</dd>
                            </div>
                        </dl>
                        <div class="mt-4 border-t border-gray-200 pt-4 flex items-center justify-between">
                             <dt class="text-sm text-gray-600">Estado del Pago</dt>
                             <dd>${getStatusPill(order.estado_pago)}</dd>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    `;
}