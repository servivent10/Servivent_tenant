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
import { Tabs } from '../../components/Tabs.js';
import { Avatar } from '../../components/Avatar.js';

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

const MisPedidosTab = ({ slug, company, navigate }) => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        const fetchOrders = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase.rpc('get_my_web_orders', { p_slug: slug });
                if (error) throw error;
                setOrders(data);
            } catch (err) {
                addToast({ message: `Error al cargar tus pedidos: ${err.message}`, type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, [slug]);

    if (isLoading) {
        return html`<div class="flex justify-center items-center h-64"><${Spinner} color="text-primary" /></div>`;
    }

    if (orders.length === 0) {
        return html`
            <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-200 bg-white">
                <div class="text-5xl text-gray-400">${ICONS.shopping_cart}</div>
                <h3 class="mt-2 text-lg font-medium text-gray-900">Aún no tienes pedidos</h3>
                <p class="mt-1 text-sm text-gray-500">Cuando realices una compra, aparecerá aquí.</p>
            </div>
        `;
    }

    return html`
        <div class="space-y-4">
            ${orders.map(order => html`
                <div key=${order.id} class="bg-white p-4 rounded-lg shadow-sm border">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-gray-800">Pedido ${order.folio}</p>
                            <p class="text-xs text-gray-500">${new Date(order.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        </div>
                        <span class=${getStatusPill(order.estado_pago)}>${order.estado_pago}</span>
                    </div>
                    <div class="mt-3 pt-3 border-t flex justify-between items-center text-sm">
                        <div class="text-gray-600">Total: <span class="font-bold text-lg text-primary">${formatCurrency(order.total, company.moneda_simbolo)}</span></div>
                        <button onClick=${() => navigate(`/catalogo/${slug}/cuenta/pedido/${order.id}`)} class="font-semibold text-primary hover:underline flex items-center gap-1">
                            Ver Detalles ${ICONS.chevron_right}
                        </button>
                    </div>
                </div>
            `)}
        </div>
    `;
};

const MisDatosTab = ({ profile }) => {
    const DetailItem = ({ label, value, icon }) => html`
        <div>
            <dt class="flex items-center gap-2 text-sm font-medium text-gray-500">
                ${icon}
                <span>${label}</span>
            </dt>
            <dd class="mt-1 text-base text-gray-900">${value || 'No especificado'}</dd>
        </div>
    `;

    return html`
        <div class="bg-white p-6 rounded-lg shadow-sm border">
            <h2 class="text-lg font-semibold text-gray-800 mb-4">Información de tu Cuenta</h2>
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                <div class="sm:col-span-2">
                    <${DetailItem} label="Nombre Completo" value=${profile.nombre} icon=${ICONS.account_circle} />
                </div>
                <${DetailItem} label="Correo Electrónico" value=${profile.correo} icon=${ICONS.users} />
                <${DetailItem} label="Teléfono" value=${profile.telefono} icon=${ICONS.phone} />
            </dl>
        </div>
    `;
};

const MisDireccionesTab = () => {
     return html`
        <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-200 bg-white">
            <div class="text-5xl text-gray-400">${ICONS.storefront}</div>
            <h3 class="mt-2 text-lg font-medium text-gray-900">No tienes direcciones guardadas</h3>
            <p class="mt-1 text-sm text-gray-500">Próximamente podrás añadir y gestionar tus direcciones de envío aquí.</p>
        </div>
    `;
};

export function CuentaClientePage({ customerProfile, slug, navigate, company }) {
    const [activeTab, setActiveTab] = useState('pedidos');

    const tabs = [
        { id: 'pedidos', label: 'Mis Pedidos' },
        { id: 'datos', label: 'Mis Datos' },
        { id: 'direcciones', label: 'Mis Direcciones' },
    ];

    if (!customerProfile) {
        useEffect(() => {
            navigate(`/catalogo/${slug}/login`);
        }, [slug, navigate]);
        return html`<div class="flex justify-center items-center h-64"><${Spinner} color="text-primary" /></div>`;
    }

    return html`
        <div class="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
            <div class="flex flex-col sm:flex-row items-center gap-6 mb-8 p-6 bg-slate-50 rounded-lg border">
                <${Avatar} name=${customerProfile.nombre} avatarUrl=${customerProfile.avatar_url} size="h-24 w-24" />
                <div>
                    <h1 class="text-3xl font-bold text-gray-900">¡Hola, ${customerProfile.nombre.split(' ')[0]}!</h1>
                    <p class="mt-1 text-gray-600">Bienvenido a tu portal de cliente. Aquí puedes gestionar tus pedidos y tu información personal.</p>
                </div>
            </div>
            
            <${Tabs} tabs=${tabs} activeTab=${activeTab} onTabClick=${setActiveTab} />

            <div class="mt-6">
                ${activeTab === 'pedidos' && html`<${MisPedidosTab} slug=${slug} company=${company} navigate=${navigate} />`}
                ${activeTab === 'datos' && html`<${MisDatosTab} profile=${customerProfile} />`}
                ${activeTab === 'direcciones' && html`<${MisDireccionesTab} />`}
            </div>
        </div>
    `;
}