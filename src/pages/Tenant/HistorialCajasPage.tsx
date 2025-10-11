

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { supabase } from '../../lib/supabaseClient.js';
import { FormInput, FormSelect } from '../../components/FormComponents.js';
import { useRealtimeListener } from '../../hooks/useRealtime.js';
import { HistorialCajaDetailModal } from '../../components/modals/HistorialCajaDetailModal.js';


const getDatesFromPreset = (preset) => {
    const now = new Date();
    let start, end;

    const toISODateString = (date) => {
        if (!date) return null;
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    switch (preset) {
        case 'today':
            start = new Date(now);
            end = new Date(now);
            break;
        case 'this_week': {
            start = new Date(now);
            const day = start.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            start.setDate(start.getDate() + diffToMonday);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            break;
        }
        case 'this_month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'this_year':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
            break;
        default:
            return { startDate: null, endDate: null };
    }
    return { startDate: toISODateString(start), endDate: toISODateString(end) };
};

export function HistorialCajasPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    // FIX: Initialize kpis with default values to prevent errors on initial render.
    const [data, setData] = useState({ kpis: { total_ventas_efectivo: 0, total_faltantes: 0, total_sobrantes: 0, total_ventas_digitales: 0 }, historial: [], filterOptions: { sucursales: [], usuarios: [] } });
    const [datePreset, setDatePreset] = useState('this_month');
    const [filters, setFilters] = useState(() => {
        const { startDate, endDate } = getDatesFromPreset('this_month');
        return {
            startDate,
            endDate,
            sucursal_id: 'all',
            usuario_id: 'all',
            estado_arqueo: 'Todos'
        };
    });
    const [selectedSession, setSelectedSession] = useState(null);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);

    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();

    const formatCurrency = (value) => {
        const number = Number(value || 0);
        const formattedNumber = number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${companyInfo.monedaSimbolo} ${formattedNumber}`;
    };
    
    const fetchData = useCallback(async () => {
        if (!companyInfo.timezone) return;
        startLoading();
        try {
            const { data: result, error } = await supabase.rpc('get_historial_cajas', {
                p_start_date: filters.startDate,
                p_end_date: filters.endDate,
                p_timezone: companyInfo.timezone,
                p_sucursal_id: filters.sucursal_id === 'all' ? null : filters.sucursal_id,
                p_usuario_id: filters.usuario_id === 'all' ? null : filters.usuario_id,
                p_estado_arqueo: filters.estado_arqueo === 'Todos' ? null : filters.estado_arqueo
            });
            if (error) throw error;
            setData(result);
        } catch (err) {
            addToast({ message: `Error al cargar historial: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    }, [filters, companyInfo.timezone]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    useRealtimeListener(fetchData);

    const handleDatePresetChange = (preset) => {
        setDatePreset(preset);
        if (preset !== 'custom') {
            const { startDate, endDate } = getDatesFromPreset(preset);
            setFilters(prev => ({ ...prev, startDate, endDate }));
        }
    };

    const handleFilterChange = (e) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRowClick = (session) => {
        setSelectedSession(session);
        setDetailModalOpen(true);
    };

    // This provides a fallback in case the kpis object from the RPC is null.
    const kpis = data.kpis || { total_ventas_efectivo: 0, total_faltantes: 0, total_sobrantes: 0, total_ventas_digitales: 0 };

    const breadcrumbs = [ { name: 'Historial de Cajas', href: '#/historial-cajas' } ];

    const DiferenciaPill = ({ diferencia }) => {
        const value = Number(diferencia);
        if (value > 0.005) return html`<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">Sobrante</span>`;
        if (value < -0.005) return html`<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">Faltante</span>`;
        return html`<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">Cuadrado</span>`;
    };

    return html`
        <${DashboardLayout} 
            user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate}
            activeLink="Historial de Cajas" breadcrumbs=${breadcrumbs} companyInfo=${companyInfo} notifications=${notifications}
        >
            <h1 class="text-2xl font-semibold text-gray-900">Historial de Cajas</h1>
            <p class="mt-1 text-sm text-gray-600">Audita y revisa todos los cierres de caja realizados en tu negocio.</p>
            
             <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
                <${KPI_Card} title="Total Ventas en Efectivo" value=${formatCurrency(kpis.total_ventas_efectivo)} icon=${ICONS.payments} color="primary" />
                <${KPI_Card} title="Total Faltantes" value=${formatCurrency(kpis.total_faltantes)} icon=${ICONS.warning} color="red" />
                <${KPI_Card} title="Total Sobrantes" value=${formatCurrency(kpis.total_sobrantes)} icon=${ICONS.savings} color="green" />
                <${KPI_Card} title="Total Ventas Digitales" value=${formatCurrency(kpis.total_ventas_digitales)} icon=${ICONS.credit_card} />
            </div>

            <div class="mt-8">
                 <div class="p-4 bg-white rounded-lg shadow-sm border mb-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <div class="lg:col-span-2">
                             <label class="block text-sm font-medium text-gray-700">Rango de Fechas</label>
                             <div class="mt-1 flex items-center bg-white border-0 rounded-md p-1 w-min">
                                <button onClick=${() => handleDatePresetChange('today')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'today' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Hoy</button>
                                <button onClick=${() => handleDatePresetChange('this_week')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_week' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Semana</button>
                                <button onClick=${() => handleDatePresetChange('this_month')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_month' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Mes</button>
                                <button onClick=${() => handleDatePresetChange('this_year')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_year' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Año</button>
                                <button onClick=${() => handleDatePresetChange('custom')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'custom' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`} title="Rango personalizado">${ICONS.calendar_month}</button>
                            </div>
                        </div>
                        <${FormSelect} 
                            label="Estado de Arqueo" 
                            name="estado_arqueo" 
                            value=${filters.estado_arqueo} 
                            onInput=${handleFilterChange} 
                            options=${[
                                {value: 'Todos', label: 'Todos'}, 
                                {value: 'Cuadrado', label: 'Cuadrado'}, 
                                {value: 'Faltante', label: 'Faltante'}, 
                                {value: 'Sobrante', label: 'Sobrante'}
                            ]} 
                        />
                        ${user.role === 'Propietario' && html`
                            <${FormSelect} label="Sucursal" name="sucursal_id" value=${filters.sucursal_id} onInput=${handleFilterChange}>
                                <option value="all">Todas las Sucursales</option>
                                ${data.filterOptions.sucursales.map(s => html`<option value=${s.id}>${s.nombre}</option>`)}
                            <//>
                        `}
                    </div>
                     ${datePreset === 'custom' && html`
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4 border-t animate-fade-in-down">
                            <${FormInput} label="Fecha Desde" name="startDate" type="date" value=${filters.startDate} onInput=${handleFilterChange} required=${false} />
                            <${FormInput} label="Fecha Hasta" name="endDate" type="date" value=${filters.endDate} onInput=${handleFilterChange} required=${false} />
                        </div>
                    `}
                </div>
                
                ${(data.historial || []).length === 0 ? html`
                    <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-200 bg-white">
                        <h3 class="text-lg font-medium text-gray-900">No se encontraron registros</h3>
                        <p class="mt-1 text-sm text-gray-500">Intenta con otro rango de fechas o ajusta los filtros.</p>
                    </div>
                ` : html `
                    <div class="space-y-4 lg:hidden">
                        ${data.historial.map(s => html`
                            <div key=${s.id} onClick=${() => handleRowClick(s)} class="bg-white p-4 rounded-lg shadow-sm border cursor-pointer">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <p class="font-semibold text-gray-800">${s.sucursal_nombre}</p>
                                        <p class="text-xs text-gray-500">${new Date(s.fecha_cierre).toLocaleString()}</p>
                                    </div>
                                    <${DiferenciaPill} diferencia=${s.diferencia_efectivo} />
                                </div>
                                <div class="mt-3 pt-3 border-t flex justify-between items-center text-sm">
                                    <div class="text-gray-600">Diferencia: <span class="font-bold ${s.diferencia_efectivo < -0.005 ? 'text-red-600' : (s.diferencia_efectivo > 0.005 ? 'text-green-600' : 'text-gray-800')}">${formatCurrency(s.diferencia_efectivo)}</span></div>
                                    <div class="text-gray-600">Usuario: <span class="font-semibold text-gray-800">${s.usuario_cierre_nombre}</span></div>
                                </div>
                            </div>
                        `)}
                    </div>
                    <div class="hidden lg:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                        <table class="min-w-full divide-y divide-gray-300">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Fecha Cierre</th>
                                    <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Sucursal</th>
                                    <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Usuario</th>
                                    <th class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">S. Teórico</th>
                                    <th class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">S. Real</th>
                                    <th class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Diferencia</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 bg-white">
                            ${data.historial.map(s => html`
                                <tr key=${s.id} onClick=${() => handleRowClick(s)} class="hover:bg-gray-50 cursor-pointer">
                                    <td class="py-4 pl-4 pr-3 text-sm text-gray-700 sm:pl-6">${new Date(s.fecha_cierre).toLocaleString()}</td>
                                    <td class="px-3 py-4 text-sm text-gray-500">${s.sucursal_nombre}</td>
                                    <td class="px-3 py-4 text-sm text-gray-500">${s.usuario_cierre_nombre}</td>
                                    <td class="px-3 py-4 text-sm text-right text-gray-500">${formatCurrency(s.saldo_final_teorico_efectivo)}</td>
                                    <td class="px-3 py-4 text-sm text-right font-semibold text-gray-800">${formatCurrency(s.saldo_final_real_efectivo)}</td>
                                    <td class="px-3 py-4 text-sm text-right font-bold ${s.diferencia_efectivo < -0.005 ? 'text-red-600' : (s.diferencia_efectivo > 0.005 ? 'text-green-600' : 'text-gray-800')}">
                                        ${formatCurrency(s.diferencia_efectivo)}
                                    </td>
                                </tr>
                            `)}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>

            <${HistorialCajaDetailModal}
                isOpen=${isDetailModalOpen}
                onClose=${() => setDetailModalOpen(false)}
                session=${selectedSession}
                companyInfo=${companyInfo}
            />
        <//>
    `;
}