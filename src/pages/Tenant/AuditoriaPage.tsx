/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { useRealtimeListener } from '../../hooks/useRealtime.js';
import { FormInput } from '../../components/FormComponents.js';
import { SearchableMultiSelectDropdown } from '../../components/SearchableMultiSelectDropdown.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { Avatar } from '../../components/Avatar.js';

const ENTITY_ICONS = {
    productos: ICONS.products,
    precios_productos: ICONS.dollar,
    clientes: ICONS.clients,
    proveedores: ICONS.suppliers,
    sucursales: ICONS.storefront,
    usuarios: ICONS.users,
    gastos: ICONS.expenses,
    ventas: ICONS.sales,
    compras: ICONS.purchases,
    categorias: ICONS.category,
    gastos_categorias: ICONS.category,
    listas_precios: ICONS.local_offer,
    default: ICONS.bolt,
};

const ENTITY_NAMES = {
    productos: 'Producto', precios_productos: 'Precio de Producto', clientes: 'Cliente',
    proveedores: 'Proveedor', sucursales: 'Sucursal', usuarios: 'Usuario',
    gastos: 'Gasto', ventas: 'Venta', compras: 'Compra', categorias: 'Categoría',
    gastos_categorias: 'Categoría de Gasto', listas_precios: 'Lista de Precios',
};

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

const DiffViewer = ({ oldData, newData }) => {
    const ignoredKeys = ['created_at', 'updated_at', 'empresa_id'];
    const keys = [...new Set([...(oldData ? Object.keys(oldData) : []), ...(newData ? Object.keys(newData) : [])])];

    const renderValue = (value) => {
        if (value === null || value === undefined) return html`<i class="text-gray-400">null</i>`;
        if (typeof value === 'boolean') return value ? 'Sí' : 'No';
        if (typeof value === 'object') return html`<pre class="text-xs bg-gray-100 p-1 rounded whitespace-pre-wrap"><code>${JSON.stringify(value, null, 2)}</code></pre>`;
        return String(value);
    };

    return html`
        <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-3 py-2 text-left font-medium text-gray-500 w-1/3">Campo</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500">Cambio</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${keys.filter(key => !ignoredKeys.includes(key)).map(key => {
                    const oldValue = oldData ? oldData[key] : undefined;
                    const newValue = newData ? newData[key] : undefined;
                    const hasChanged = JSON.stringify(oldValue) !== JSON.stringify(newValue);

                    if (!hasChanged) return null;

                    return html`
                        <tr key=${key}>
                            <td class="px-3 py-2 font-mono text-xs text-gray-700 align-top">${key}</td>
                            <td class="px-3 py-2 align-top">
                                ${oldData && html`<div class="text-red-600 bg-red-50 p-1 rounded line-through">${renderValue(oldValue)}</div>`}
                                ${newData && html`<div class="text-green-600 bg-green-50 p-1 rounded mt-1">${renderValue(newValue)}</div>`}
                            </td>
                        </tr>
                    `;
                })}
            </tbody>
        </table>
    `;
};

export function AuditoriaPage({ user, companyInfo, onLogout, onProfileUpdate, navigate }) {
    if (user.role === 'Empleado') {
        navigate('/dashboard');
        return null;
    }
    
    const [data, setData] = useState({ history: [], filterOptions: { usuarios: [] } });
    const [datePreset, setDatePreset] = useState('this_week');
    const [filters, setFilters] = useState(() => {
        const { startDate, endDate } = getDatesFromPreset('this_week');
        return { startDate, endDate, userIds: [], tables: [] };
    });
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [isDetailModalOpen, setDetailModalOpen] = useState(false);
    
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    
    const fetchData = useCallback(async () => {
        if (!companyInfo.timezone) return;
        startLoading();
        try {
            const { data: result, error } = await supabase.rpc('get_historial_cambios', {
                p_start_date: filters.startDate,
                p_end_date: filters.endDate,
                p_timezone: companyInfo.timezone,
                p_user_ids: filters.userIds.length > 0 ? filters.userIds : null,
                p_tables: filters.tables.length > 0 ? filters.tables : null
            });
            if (error) throw error;
            setData(result || { history: [], filterOptions: { usuarios: [] } });
        } catch(err) {
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
    
    const handleFilterChange = (e) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleDetailClick = (entry) => { setSelectedEntry(entry); setDetailModalOpen(true); };

    const groupedHistory = useMemo(() => {
        const groups: { [key: string]: any[] } = {};
        (data?.history || []).forEach(entry => {
            const date = new Date(entry.timestamp).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            if (!groups[date]) groups[date] = [];
            groups[date].push(entry);
        });
        return Object.entries(groups);
    }, [data]);

    const breadcrumbs = [{ name: 'Auditoría', href: '#/auditoria' }];

    return html`
        <${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} activeLink="Auditoría" breadcrumbs=${breadcrumbs} companyInfo=${companyInfo}>
            <div class="flex items-center gap-3 mb-6">
                <div class="text-3xl text-primary">${ICONS.manage_history}</div>
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Historial de Auditoría</h1>
                    <p class="mt-1 text-sm text-gray-600">Revisa todos los cambios importantes realizados en el sistema.</p>
                </div>
            </div>

            <div class="bg-white p-4 rounded-lg shadow-sm border mb-6">
                 <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div class="lg:col-span-2">
                         <label class="block text-sm font-medium text-gray-700 mb-1">Rango de Fechas</label>
                         <div class="flex items-center flex-wrap bg-white border rounded-md shadow-sm p-1">
                             <button onClick=${() => handleDatePresetChange('today')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'today' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Hoy</button>
                             <button onClick=${() => handleDatePresetChange('this_week')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_week' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Semana</button>
                             <button onClick=${() => handleDatePresetChange('this_month')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_month' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Mes</button>
                             <button onClick=${() => handleDatePresetChange('this_year')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_year' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Año</button>
                             <button onClick=${() => handleDatePresetChange('custom')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'custom' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`} title="Rango personalizado">${ICONS.calendar_month}</button>
                         </div>
                    </div>
                     <${SearchableMultiSelectDropdown} label="Usuario" name="userIds" options=${(data?.filterOptions?.usuarios || []).map(u => ({ value: u.id, label: u.nombre_completo }))} selectedValues=${filters.userIds} onSelectionChange=${handleFilterChange} />
                     <${SearchableMultiSelectDropdown} label="Tipo de Entidad" name="tables" options=${Object.entries(ENTITY_NAMES).map(([key, val]) => ({ value: key, label: val }))} selectedValues=${filters.tables} onSelectionChange=${handleFilterChange} />
                </div>
                 ${datePreset === 'custom' && html`
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4 border-t animate-fade-in-down">
                        <${FormInput} label="Desde" name="startDate" type="date" value=${filters.startDate} onInput=${handleFilterChange} required=${false} />
                        <${FormInput} label="Hasta" name="endDate" type="date" value=${filters.endDate} onInput=${handleFilterChange} required=${false} />
                    </div>
                `}
            </div>

            <div class="space-y-8">
                ${groupedHistory.length === 0 ? html`
                    <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-200 bg-white">
                        <h3 class="text-lg font-medium text-gray-900">No se encontraron registros de auditoría</h3>
                        <p class="mt-1 text-sm text-gray-500">Intenta con otro rango de fechas o ajusta los filtros.</p>
                    </div>
                ` : groupedHistory.map(([groupName, groupEntries]) => html`
                    <div key=${groupName}>
                        <h2 class="text-base font-semibold text-gray-600 mb-2">${groupName}</h2>
                        <ul class="space-y-4">
                            ${groupEntries.map(entry => {
                                const entityName = ENTITY_NAMES[entry.tabla_afectada] || entry.tabla_afectada;
                                let summary;

                                if (entry.accion?.includes('(BULK)')) {
                                    const resumen = entry.datos_nuevos?.resumen;
                                    if (resumen) {
                                        let action = '';
                                        let details = resumen;
                                        
                                        if (resumen.startsWith('Se crearon')) {
                                            action = 'inserto';
                                            details = resumen.substring('Se crearon'.length);
                                        } else if (resumen.startsWith('Se actualizaron')) {
                                            action = 'Actualizo';
                                            details = resumen.substring('Se actualizaron'.length);
                                        }

                                        // Fix pluralization if number is 1
                                        if (details.trim().startsWith('1 ')) {
                                            details = details.replace(/s\b/g, '');
                                        }

                                        if (action) {
                                            summary = `${entry.usuario_nombre} ${action}${details}`.replace(' mediante importación CSV', '').replace(' existentes', '');
                                        } else {
                                             summary = `${entry.usuario_nombre} realizó una operación masiva.`;
                                        }
                                    } else {
                                        summary = `${entry.usuario_nombre} realizó una operación masiva.`;
                                    }
                                } else {
                                    // Original logic for non-bulk operations
                                    let actionText;
                                    switch(entry.accion) {
                                        case 'INSERT': actionText = 'creó un nuevo'; break;
                                        case 'UPDATE': actionText = 'actualizó el'; break;
                                        case 'DELETE': actionText = 'eliminó el'; break;
                                        default: actionText = 'modificó el';
                                    }
                                    summary = `${entry.usuario_nombre || 'Usuario del Sistema'} ${actionText} ${entityName.toLowerCase()}.`;
                                }
                                
                                return html`
                                    <li key=${entry.id} class="bg-white p-4 rounded-lg shadow-sm border flex items-start gap-4">
                                        <${Avatar} name=${entry.usuario_nombre} avatarUrl=${entry.avatar} />
                                        <div class="flex-1">
                                            <p class="text-sm text-gray-800">${summary}</p>
                                            <p class="text-xs text-gray-500 mt-1">${new Date(entry.timestamp).toLocaleTimeString()}</p>
                                        </div>
                                        <button onClick=${() => handleDetailClick(entry)} class="text-sm font-semibold text-primary hover:underline">Ver Detalles</button>
                                    </li>
                                `;
                            })}
                        </ul>
                    </div>
                `)}
            </div>
            
            <${ConfirmationModal}
                isOpen=${isDetailModalOpen}
                onClose=${() => setDetailModalOpen(false)}
                onConfirm=${() => setDetailModalOpen(false)}
                title="Detalle del Cambio"
                confirmText="Cerrar"
                icon=${selectedEntry ? (ENTITY_ICONS[selectedEntry.tabla_afectada] || ENTITY_ICONS.default) : null}
                maxWidthClass="max-w-3xl"
            >
                ${selectedEntry && html`
                    <div class="space-y-4">
                        <div class="p-3 bg-slate-50 rounded-lg border grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div><dt class="text-gray-500">Usuario</dt><dd class="font-medium text-gray-800">${selectedEntry.usuario_nombre}</dd></div>
                            <div><dt class="text-gray-500">Acción</dt><dd class="font-medium text-gray-800">${selectedEntry.accion}</dd></div>
                            <div><dt class="text-gray-500">Fecha</dt><dd class="font-medium text-gray-800">${new Date(selectedEntry.timestamp).toLocaleString()}</dd></div>
                            <div><dt class="text-gray-500">Entidad</dt><dd class="font-medium text-gray-800">${ENTITY_NAMES[selectedEntry.tabla_afectada] || selectedEntry.tabla_afectada}</dd></div>
                        </div>
                        <${DiffViewer} oldData=${selectedEntry.datos_anteriores} newData=${selectedEntry.datos_nuevos} />
                    </div>
                `}
            <//>
        <//>
    `;
}