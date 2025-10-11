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
import { SearchableMultiSelectDropdown } from '../../components/SearchableMultiSelectDropdown.js';
import { useRealtimeListener } from '../../hooks/useRealtime.js';

const getDatesFromPreset = (preset) => {
    const now = new Date();
    let start, end;
    const toISODateString = (date) => date ? new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split("T")[0] : '';
    switch (preset) {
        case 'today': start = end = new Date(now); break;
        case 'this_week': {
            start = new Date(now);
            const day = start.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            start.setDate(start.getDate() + diffToMonday);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            break;
        }
        case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0); break;
        case 'this_year': start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear(), 11, 31); break;
        default: return { startDate: '', endDate: '' };
    }
    return { startDate: toISODateString(start), endDate: toISODateString(end) };
};

const MOVEMENT_TYPES = ['Venta', 'Compra', 'Ajuste', 'Salida por Traspaso', 'Entrada por Traspaso'];

export function HistorialInventarioPage({ user, onLogout, onProfileUpdate, companyInfo, navigate }) {
    const [data, setData] = useState({ kpis: { total_entradas: 0, total_salidas: 0 }, historial: [], filterOptions: { productos: [], sucursales: [], usuarios: [] } });
    const [datePreset, setDatePreset] = useState('this_month');
    const [filters, setFilters] = useState(() => {
        const { startDate, endDate } = getDatesFromPreset('this_month');
        return {
            startDate,
            endDate,
            producto_ids: [],
            sucursal_ids: [],
            usuario_ids: [],
            tipo_movimiento: 'Todos',
        };
    });

    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();

    const fetchData = useCallback(async () => {
        if (!companyInfo.timezone) return;
        startLoading();
        try {
            const { data: result, error } = await supabase.rpc('get_movimientos_inventario', {
                p_start_date: filters.startDate,
                p_end_date: filters.endDate,
                p_timezone: companyInfo.timezone,
                p_producto_id: filters.producto_ids.length > 0 ? filters.producto_ids[0] : null,
                p_sucursal_id: filters.sucursal_ids.length > 0 ? filters.sucursal_ids[0] : null,
                p_usuario_id: filters.usuario_ids.length > 0 ? filters.usuario_ids[0] : null,
                p_tipo_movimiento: filters.tipo_movimiento === 'Todos' ? null : filters.tipo_movimiento,
            });
            if (error) throw error;
            setData(result || { kpis: { total_entradas: 0, total_salidas: 0 }, historial: [], filterOptions: { productos: [], sucursales: [], usuarios: [] } });
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

    const breadcrumbs = [ { name: 'Inventarios', href: '#/inventarios' }, { name: 'Historial', href: '#/historial-inventario' } ];
    const kpis = data?.kpis || { total_entradas: 0, total_salidas: 0 };
    const historial = data?.historial || [];
    const filterOptions = data?.filterOptions || { productos: [], sucursales: [], usuarios: [] };
    
    const getTypePill = (type) => {
        const colors = {
            'Venta': 'bg-red-100 text-red-800', 'Compra': 'bg-green-100 text-green-800',
            'Ajuste': 'bg-yellow-100 text-yellow-800', 'Salida por Traspaso': 'bg-orange-100 text-orange-800',
            'Entrada por Traspaso': 'bg-blue-100 text-blue-800',
        };
        return html`<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-800'}">${type}</span>`;
    };

    return html`
        <${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} activeLink="Historial de Inventario" breadcrumbs=${breadcrumbs} companyInfo=${companyInfo}>
            <div class="flex items-center gap-3 mb-6">
                <div class="text-3xl text-primary">${ICONS.inventory_history}</div>
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Historial de Movimientos de Inventario</h1>
                    <p class="mt-1 text-sm text-gray-600">Audita cada entrada y salida de productos en tu negocio.</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <${KPI_Card} title="Total Unidades Entrantes" value=${kpis.total_entradas || 0} icon=${ICONS.add_circle} color="green" />
                <${KPI_Card} title="Total Unidades Salientes" value=${kpis.total_salidas || 0} icon=${ICONS.remove_circle} color="red" />
            </div>

            <div class="mt-8 bg-white p-4 rounded-lg shadow-sm border mb-6">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Rango de Fechas</label>
                        <div class="flex items-center flex-wrap bg-white border-0 rounded-md p-1 w-full">
                            <button onClick=${() => handleDatePresetChange('today')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'today' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Hoy</button>
                            <button onClick=${() => handleDatePresetChange('this_week')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_week' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Semana</button>
                            <button onClick=${() => handleDatePresetChange('this_month')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_month' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Mes</button>
                            <button onClick=${() => handleDatePresetChange('this_year')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_year' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Año</button>
                            <button onClick=${() => handleDatePresetChange('custom')} class=${`flex items-center gap-1 px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'custom' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`} title="Rango personalizado">${ICONS.calendar_month} Personalizar</button>
                        </div>
                    </div>
                    
                    ${datePreset === 'custom' && html`
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t animate-fade-in-down">
                            <${FormInput} label="Desde" name="startDate" type="date" value=${filters.startDate} onInput=${handleFilterChange} required=${false} />
                            <${FormInput} label="Hasta" name="endDate" type="date" value=${filters.endDate} onInput=${handleFilterChange} required=${false} />
                        </div>
                    `}

                    <div class="pt-4 border-t">
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                            ${user.role === 'Propietario' && html`
                                <${SearchableMultiSelectDropdown} label="Sucursal" name="sucursal_ids" options=${(filterOptions.sucursales || []).map(s => ({ value: s.id, label: s.nombre }))} selectedValues=${filters.sucursal_ids} onSelectionChange=${handleFilterChange} />
                            `}
                            <${SearchableMultiSelectDropdown} label="Usuario" name="usuario_ids" options=${(filterOptions.usuarios || []).map(u => ({ value: u.id, label: u.nombre_completo }))} selectedValues=${filters.usuario_ids} onSelectionChange=${handleFilterChange} />
                            <${SearchableMultiSelectDropdown} label="Producto" name="producto_ids" options=${(filterOptions.productos || []).map(p => ({ value: p.id, label: p.nombre }))} selectedValues=${filters.producto_ids} onSelectionChange=${handleFilterChange} />
                            <${FormSelect} label="Tipo de Movimiento" name="tipo_movimiento" value=${filters.tipo_movimiento} onInput=${handleFilterChange} options=${[{value: 'Todos', label: 'Todos'}, ...MOVEMENT_TYPES.map(t => ({value: t, label: t}))]} />
                        </div>
                    </div>
                </div>
            </div>
            
            ${(historial || []).length === 0 ? html`
                <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-200 bg-white">
                    <h3 class="text-lg font-medium text-gray-900">No se encontraron movimientos</h3>
                    <p class="mt-1 text-sm text-gray-500">Intenta con otro rango de fechas o ajusta los filtros.</p>
                </div>
            ` : html`
                <div class="hidden lg:block overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                    <table class="min-w-full divide-y divide-gray-300">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Fecha</th>
                                <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Producto</th>
                                <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Sucursal</th>
                                <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Usuario</th>
                                <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tipo</th>
                                <th class="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Stock Anterior</th>
                                <th class="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Ajuste</th>
                                <th class="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Stock Nuevo</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white">
                            ${historial.map(m => html`
                                <tr>
                                    <td class="py-4 pl-4 pr-3 text-sm text-gray-700">${new Date(m.created_at).toLocaleString()}</td>
                                    <td class="px-3 py-4 text-sm font-medium text-gray-900">${m.producto_nombre}</td>
                                    <td class="px-3 py-4 text-sm text-gray-500">${m.sucursal_nombre}</td>
                                    <td class="px-3 py-4 text-sm text-gray-500">${m.usuario_nombre || 'Sistema'}</td>
                                    <td class="px-3 py-4 text-sm">${getTypePill(m.tipo_movimiento)}</td>
                                    <td class="px-3 py-4 text-sm text-center text-gray-500">${m.stock_anterior}</td>
                                    <td class="px-3 py-4 text-sm text-center font-bold ${m.cantidad_ajustada > 0 ? 'text-green-600' : 'text-red-600'}">${m.cantidad_ajustada > 0 ? '+' : ''}${m.cantidad_ajustada}</td>
                                    <td class="px-3 py-4 text-sm text-center font-bold text-gray-900">${m.stock_nuevo}</td>
                                </tr>
                            `)}
                        </tbody>
                    </table>
                </div>
                 <div class="space-y-4 lg:hidden">
                    ${historial.map(m => html`
                        <div class="bg-white p-4 rounded-lg shadow-sm border">
                            <div class="flex justify-between items-start">
                                <div>
                                    <p class="font-semibold text-gray-800">${m.producto_nombre}</p>
                                    <p class="text-xs text-gray-500">${new Date(m.created_at).toLocaleString()}</p>
                                </div>
                                ${getTypePill(m.tipo_movimiento)}
                            </div>
                            <div class="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-center text-sm">
                                <div><p class="text-xs text-gray-500">Anterior</p><p class="font-semibold text-gray-700">${m.stock_anterior}</p></div>
                                <div><p class="text-xs text-gray-500">Ajuste</p><p class="font-bold ${m.cantidad_ajustada > 0 ? 'text-green-600' : 'text-red-600'}">${m.cantidad_ajustada > 0 ? '+' : ''}${m.cantidad_ajustada}</p></div>
                                <div><p class="text-xs text-gray-500">Nuevo</p><p class="font-bold text-lg text-gray-900">${m.stock_nuevo}</p></div>
                            </div>
                            <div class="mt-2 text-xs text-gray-500">
                                En <span class="font-medium">${m.sucursal_nombre}</span> por <span class="font-medium">${m.usuario_nombre || 'Sistema'}</span>
                            </div>
                        </div>
                    `)}
                </div>
            `}
        <//>
    `;
}
