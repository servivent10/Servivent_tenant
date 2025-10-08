/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { supabase } from '../../lib/supabaseClient.js';

export function TraspasoDetailPage({ traspasoId, user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const [traspaso, setTraspaso] = useState(null);
    const { isLoading, startLoading, stopLoading } = useLoading();
    const { addToast } = useToast();

    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_traspaso_details', { p_traspaso_id: traspasoId });
            if (error) throw error;
            setTraspaso(data);
        } catch(err) {
            addToast({ message: `Error al cargar detalles: ${err.message}`, type: 'error' });
            navigate('/traspasos');
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, [traspasoId]);
    
    const handleReceive = async () => {
        startLoading();
        try {
            const { error } = await supabase.rpc('confirmar_recepcion_traspaso', { p_traspaso_id: traspasoId });
            if (error) throw error;
            addToast({ message: 'Mercancía recibida y stock actualizado.', type: 'success' });
            fetchData();
        } catch (err) {
            addToast({ message: `Error al recibir: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    const breadcrumbs = [
        { name: 'Traspasos', href: '#/traspasos' },
        { name: traspaso ? `Detalle ${traspaso.folio}` : 'Cargando...', href: `#/traspasos/${traspasoId}` }
    ];

    if (isLoading || !traspaso) {
        return html`<${DashboardLayout} user=${user} onLogout=${onLogout} activeLink="Traspasos" breadcrumbs=${breadcrumbs} />`;
    }
    
    const getStatusPill = (status) => {
        const baseClasses = 'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold';
        switch (status) {
            case 'En Camino': return `${baseClasses} bg-amber-100 text-amber-800`;
            case 'Recibido': return `${baseClasses} bg-green-100 text-green-800`;
            default: return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };

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
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div class="flex items-center gap-4">
                    <button onClick=${() => navigate('/traspasos')} class="p-2 rounded-full hover:bg-gray-200" aria-label="Volver">
                        ${ICONS.arrow_back}
                    </button>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Detalle de Traspaso: ${traspaso.folio}</h1>
                        <p class="text-sm text-gray-500">Fecha de Creación: ${new Date(traspaso.fecha).toLocaleString()}</p>
                    </div>
                </div>
                <div class=${getStatusPill(traspaso.estado)}>${traspaso.estado}</div>
            </div>
            
            ${traspaso.estado === 'En Camino' && user.sucursal_id === traspaso.sucursal_destino_id && html`
                <div class="mt-4 mb-6">
                    <button onClick=${handleReceive} class="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500">
                        ${ICONS.inventory} Confirmar Recepción de Mercancía
                    </button>
                </div>
            `}

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white p-6 rounded-lg shadow-md border space-y-4">
                    <h3 class="font-semibold text-gray-800">Ruta del Traspaso</h3>
                    <div class="p-4 bg-slate-50 border rounded-lg flex justify-between items-center text-center">
                        <div><p class="text-sm text-gray-600">Origen</p><p class="font-bold text-lg text-gray-800">${traspaso.origen_nombre}</p></div>
                        <div class="text-3xl text-primary mt-4">${ICONS.transfers}</div>
                        <div><p class="text-sm text-gray-600">Destino</p><p class="font-bold text-lg text-gray-800">${traspaso.destino_nombre}</p></div>
                    </div>
                     ${traspaso.notas && html`
                        <div>
                            <h4 class="text-sm font-medium text-gray-600">Notas:</h4>
                            <p class="text-sm text-gray-800 p-2 bg-gray-100 border rounded-md mt-1">${traspaso.notas}</p>
                        </div>
                    `}
                </div>
                
                <div class="bg-white p-6 rounded-lg shadow-md border space-y-4">
                    <h3 class="font-semibold text-gray-800">Auditoría</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 class="text-sm font-bold text-blue-800">Enviado por:</h4>
                            <p class="text-base font-semibold text-gray-900">${traspaso.usuario_envio_nombre}</p>
                            <p class="text-xs text-gray-600">${traspaso.fecha_envio ? new Date(traspaso.fecha_envio).toLocaleString() : 'N/A'}</p>
                        </div>
                         <div class="p-3 ${traspaso.estado === 'Recibido' ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-200'} rounded-lg">
                            <h4 class="text-sm font-bold ${traspaso.estado === 'Recibido' ? 'text-green-800' : 'text-gray-500'}">Recibido por:</h4>
                             ${traspaso.estado === 'Recibido' ? html`
                                <p class="text-base font-semibold text-gray-900">${traspaso.usuario_recibio_nombre}</p>
                                <p class="text-xs text-gray-600">${traspaso.fecha_recibido ? new Date(traspaso.fecha_recibido).toLocaleString() : 'N/A'}</p>
                            ` : html`<p class="text-sm text-gray-500 mt-2">Pendiente de recepción</p>`}
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-6 bg-white rounded-lg shadow-md border">
                <h3 class="font-semibold text-gray-800 p-6">Productos Transferidos</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${traspaso.items.map(item => html`
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.producto_nombre}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-800">${item.cantidad}</td>
                                </tr>
                            `)}
                        </tbody>
                    </table>
                </div>
            </div>
        <//>
    `;
}