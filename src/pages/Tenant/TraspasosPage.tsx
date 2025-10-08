/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { FloatingActionButton } from '../../components/FloatingActionButton.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useRealtimeListener } from '../../hooks/useRealtime.js';

export function TraspasosPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    const [data, setData] = useState({ traspasos: [], kpis: {} });

    const canCreate = user.role === 'Propietario' || user.role === 'Administrador';

    const fetchData = async () => {
        if (!canCreate) return;
        startLoading();
        try {
            const { data: result, error } = await supabase.rpc('get_traspasos_data');
            if (error) throw error;
            setData(result);
        } catch (err) {
            addToast({ message: `Error al cargar traspasos: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        if (!canCreate) {
            addToast({ message: 'No tienes permiso para acceder a este módulo.', type: 'warning' });
            navigate('/dashboard');
        } else {
            fetchData();
        }
    }, [canCreate]);

    useRealtimeListener(fetchData);

    const kpis = { traspasos_this_month: 0, producto_mas_traspasado: null, total_productos_movidos: 0, ...data?.kpis };
    const traspasos = data?.traspasos || [];
    
    const getStatusPill = (status) => {
        const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
        switch (status) {
            case 'En Camino': return `${baseClasses} bg-amber-100 text-amber-800`;
            case 'Recibido': return `${baseClasses} bg-green-100 text-green-800`;
            default: return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };

    const TraspasosList = () => {
        if (traspasos.length === 0) {
            return html`
                <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white mt-6">
                    <div class="text-6xl text-gray-300">${ICONS.transfers}</div>
                    <h3 class="mt-2 text-lg font-medium text-gray-900">No se han realizado traspasos</h3>
                    <p class="mt-1 text-sm text-gray-500">Comienza tu primer traspaso para mover inventario entre sucursales.</p>
                </div>
            `;
        }

        return html`
            <div class="space-y-4 md:hidden mt-6">
                ${traspasos.map(t => html`
                    <div key=${t.id} class="bg-white p-4 rounded-lg shadow border cursor-pointer" onClick=${() => navigate(`/traspasos/${t.id}`)}>
                        <div>
                            <div class="flex justify-between items-start">
                                <div class="font-bold text-gray-800">Folio: ${t.folio}</div>
                                <span class=${getStatusPill(t.estado)}>${t.estado}</span>
                            </div>
                            <div class="flex items-center justify-between mt-2">
                                <div class="text-sm">
                                    <p class="text-gray-500">Origen</p>
                                    <p class="font-semibold text-gray-800">${t.origen_nombre}</p>
                                </div>
                                <div class="text-2xl text-primary">${ICONS.chevron_right}</div>
                                <div class="text-sm text-right">
                                    <p class="text-gray-500">Destino</p>
                                    <p class="font-semibold text-gray-800">${t.destino_nombre}</p>
                                </div>
                            </div>
                            <div class="mt-2 pt-2 border-t text-xs text-gray-600">
                                ${t.total_items} ${t.total_items === 1 ? 'producto' : 'productos'} movidos por ${t.usuario_nombre}
                            </div>
                        </div>
                    </div>
                `)}
            </div>

            <div class="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg mt-6">
                <table class="min-w-full divide-y divide-gray-300">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Folio</th>
                            <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha</th>
                            <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Origen</th>
                            <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Destino</th>
                            <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                            <th class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Acciones</span></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white">
                        ${traspasos.map(t => html`
                            <tr key=${t.id} onClick=${() => navigate(`/traspasos/${t.id}`)} class="hover:bg-gray-50 cursor-pointer">
                                <td class="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">${t.folio}</td>
                                <td class="px-3 py-4 text-sm text-gray-500">${new Date(t.fecha).toLocaleString()}</td>
                                <td class="px-3 py-4 text-sm text-gray-500">${t.origen_nombre}</td>
                                <td class="px-3 py-4 text-sm text-gray-500">${t.destino_nombre}</td>
                                <td class="px-3 py-4 text-sm"><span class=${getStatusPill(t.estado)}>${t.estado}</span></td>
                                <td class="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6"></td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        `;
    };

    const breadcrumbs = [ { name: 'Traspasos', href: '#/traspasos' } ];

    if (!canCreate) {
        return html`<${DashboardLayout} user=${user} onLogout=${onLogout} activeLink="Traspasos" />`;
    }

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Traspasos"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Traspasos de Inventario</h1>
                    <p class="mt-1 text-sm text-gray-600">Movimientos de stock entre tus sucursales.</p>
                </div>
                 <button 
                    onClick=${() => navigate('/traspasos/nuevo')}
                    class="hidden sm:inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
                >
                    ${ICONS.add} Nuevo Traspaso
                </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
                <${KPI_Card} title="Traspasos este Mes" value=${kpis.traspasos_this_month} icon=${ICONS.transfers} color="primary" />
                <${KPI_Card} title="Productos más Traspasado" value=${kpis.producto_mas_traspasado || 'N/A'} icon=${ICONS.package_2} />
                <${KPI_Card} title="Total de Productos Movidos" value=${kpis.total_productos_movidos} icon=${ICONS.inventory} />
            </div>

            <div class="mt-8">
                <${TraspasosList} />
            </div>

            <div class="sm:hidden">
                <${FloatingActionButton} onClick=${() => navigate('/traspasos/nuevo')} label="Nuevo Traspaso" />
            </div>
        <//>
    `;
}