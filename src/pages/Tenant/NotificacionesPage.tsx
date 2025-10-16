/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { useRealtimeListener } from '../../hooks/useRealtime.js';
import { FormInput } from '../../components/FormComponents.js';
import { SearchableMultiSelectDropdown } from '../../components/SearchableMultiSelectDropdown.js';

const NOTIFICATION_EVENT_ICONS = {
    'NUEVA_VENTA': ICONS.shopping_cart, 'NUEVA_COMPRA': ICONS.purchases, 'NUEVO_GASTO': ICONS.expenses,
    'TRASPASO_ENVIADO': ICONS.transfers, 'TRASPASO_RECIBIDO': ICONS.inventory, 'NUEVO_PRODUCTO': ICONS.package_2,
    'NUEVO_CLIENTE': ICONS.person_add, DEFAULT: ICONS.bolt,
};

const EVENT_TYPES = [
    { value: 'NUEVA_VENTA', label: 'Nuevas Ventas' }, { value: 'NUEVA_COMPRA', label: 'Nuevas Compras' },
    { value: 'NUEVO_GASTO', label: 'Nuevos Gastos' }, { value: 'TRASPASO_ENVIADO', label: 'Traspasos Enviados' },
    { value: 'TRASPASO_RECIBIDO', label: 'Traspasos Recibidos' }, { value: 'NUEVO_PRODUCTO', label: 'Nuevos Productos' },
    { value: 'NUEVO_CLIENTE', label: 'Nuevos Clientes' },
];

const getNotificationLink = (notification) => {
    const { tipo_evento, entidad_id } = notification;
    if (!entidad_id) return null;
    switch (tipo_evento) {
        case 'NUEVA_VENTA': return `#/ventas/${entidad_id}`;
        case 'NUEVA_COMPRA': return `#/compras/${entidad_id}`;
        case 'TRASPASO_ENVIADO':
        case 'TRASPASO_RECIBIDO': return `#/traspasos/${entidad_id}`;
        default: return null;
    }
};

export function NotificacionesPage({ user, companyInfo, onLogout, onProfileUpdate, navigate }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    const [notifications, setNotifications] = useState([]);
    const [filters, setFilters] = useState({ startDate: '', endDate: '', eventTypes: [], branchIds: [], readStatus: 'all' });
    const [filterOptions, setFilterOptions] = useState({ branches: [], clients: [], users: [] });

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const fetchData = useCallback(async () => {
        startLoading();
        try {
            const [notifRes, optionsRes] = await Promise.all([
                supabase.rpc('get_all_notificaciones_filtered', {
                    p_start_date: filters.startDate || null,
                    p_end_date: filters.endDate || null,
                    p_event_types: filters.eventTypes.length > 0 ? filters.eventTypes : null,
                    p_sucursal_ids: user.role === 'Propietario' && filters.branchIds.length > 0 ? filters.branchIds : null,
                    p_read_status: filters.readStatus === 'all' ? null : filters.readStatus === 'read'
                }),
                supabase.rpc('get_sales_filter_data') // Re-use this function to get branch list
            ]);

            if (notifRes.error) throw notifRes.error;
            if (optionsRes.error) throw optionsRes.error;

            setNotifications(Array.isArray(notifRes.data) ? notifRes.data : []);
            setFilterOptions(optionsRes.data || { branches: [], clients: [], users: [] });
        } catch (err) {
            addToast({ message: `Error al cargar notificaciones: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    }, [filters, user.role, startLoading, stopLoading, addToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useRealtimeListener(fetchData);

    const groupedNotifications = useMemo(() => {
        const groups: { [key: string]: any[] } = {};
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const todayStr = today.toLocaleDateString();
        const yesterdayStr = yesterday.toLocaleDateString();

        notifications.forEach(n => {
            const date = new Date(n.created_at);
            const dateStr = date.toLocaleDateString();
            let groupName;

            if (dateStr === todayStr) groupName = 'Hoy';
            else if (dateStr === yesterdayStr) groupName = 'Ayer';
            else groupName = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(n);
        });
        return Object.entries(groups);
    }, [notifications]);

    const breadcrumbs = [{ name: 'Notificaciones', href: '#/notificaciones' }];

    return html`
        <${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} activeLink="" breadcrumbs=${breadcrumbs} companyInfo=${companyInfo}>
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div class="flex items-center gap-3">
                    <div class="text-3xl text-primary">${ICONS.history_edu}</div>
                    <div>
                        <h1 class="text-2xl font-semibold text-gray-900">Historial de Notificaciones</h1>
                        <p class="mt-1 text-sm text-gray-600">Revisa todos los eventos importantes de tu negocio.</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white p-4 rounded-lg shadow-sm border mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <${FormInput} label="Desde" name="startDate" type="date" value=${filters.startDate} onInput=${handleFilterChange} required=${false} />
                    <${FormInput} label="Hasta" name="endDate" type="date" value=${filters.endDate} onInput=${handleFilterChange} required=${false} />
                    <div>
                        <label for="readStatus" class="block text-sm font-medium text-gray-700">Estado</label>
                        <select id="readStatus" name="readStatus" value=${filters.readStatus} onChange=${handleFilterChange} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                            <option value="all">Todas</option>
                            <option value="unread">No Leídas</option>
                            <option value="read">Leídas</option>
                        </select>
                    </div>
                    <${SearchableMultiSelectDropdown} label="Tipo de Evento" name="eventTypes" options=${EVENT_TYPES} selectedValues=${filters.eventTypes} onSelectionChange=${handleFilterChange} />
                    ${user.role === 'Propietario' && html`
                        <div class="lg:col-span-2">
                            <${SearchableMultiSelectDropdown} label="Sucursal" name="branchIds" options=${(filterOptions.branches || []).map(b => ({ value: b.id, label: b.nombre }))} selectedValues=${filters.branchIds} onSelectionChange=${handleFilterChange} />
                        </div>
                    `}
                </div>
            </div>

            <div class="space-y-6">
                ${groupedNotifications.length === 0 ? html`
                    <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-200 bg-white">
                        <h3 class="text-lg font-medium text-gray-900">No se encontraron notificaciones</h3>
                        <p class="mt-1 text-sm text-gray-500">Intenta ajustar los filtros de búsqueda.</p>
                    </div>
                ` : groupedNotifications.map(([groupName, groupNotifs]) => html`
                    <div key=${groupName}>
                        <h2 class="text-sm font-semibold text-gray-500 mb-2">${groupName}</h2>
                        <ul class="bg-white rounded-lg shadow-sm border divide-y divide-gray-200">
                            ${groupNotifs.map(n => {
                                const icon = NOTIFICATION_EVENT_ICONS[n.tipo_evento] || NOTIFICATION_EVENT_ICONS.DEFAULT;
                                const link = getNotificationLink(n);
                                const Tag = link ? 'a' : 'div';
                                const props = link ? { href: link, onClick: (e) => { e.preventDefault(); navigate(link); }} : {};
                                
                                return html`
                                    <li key=${n.id}>
                                        <${Tag} ...${props} class="block p-4 ${link ? 'hover:bg-gray-50' : ''} ${!n.is_read ? 'bg-primary-light/20' : ''}">
                                            <div class="flex items-start gap-4">
                                                <div class="flex-shrink-0 p-2 bg-slate-100 rounded-full mt-0.5 text-slate-500">${icon}</div>
                                                <div class="flex-1">
                                                    <p class="text-sm text-gray-800" dangerouslySetInnerHTML=${{ __html: n.mensaje }}></p>
                                                    <div class="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                                        <span>${new Date(n.created_at).toLocaleTimeString()}</span>
                                                        <span>Por: ${n.usuario_generador_nombre}</span>
                                                    </div>
                                                </div>
                                                ${!n.is_read && html`<div class="h-2.5 w-2.5 rounded-full bg-primary mt-1 flex-shrink-0" title="No leído"></div>`}
                                            </div>
                                        <//>
                                    </li>
                                `;
                            })}
                        </ul>
                    </div>
                `)}
            </div>
        <//>
    `;
}