/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useCallback, useRef } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { FloatingActionButton } from '../../components/FloatingActionButton.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { supabase } from '../../lib/supabaseClient.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { GastoFormModal } from '../../components/modals/GastoFormModal.js';
import { useRealtimeListener } from '../../hooks/useRealtime.js';
import { FormInput, FormSelect } from '../../components/FormComponents.js';
import { SearchableMultiSelectDropdown } from '../../components/SearchableMultiSelectDropdown.js';

const initialFilters = {
    startDate: '',
    endDate: '',
    category_ids: [],
    usuario_ids: [],
    sucursal_ids: []
};


const AdvancedFilterPanel = ({ isOpen, filters, onFilterChange, filterOptions, user }) => {
    if (!isOpen) return null;

    return html`
        <div class="p-4 bg-slate-50 border-t border-b animate-fade-in-down mb-6 rounded-b-lg shadow-inner">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <${SearchableMultiSelectDropdown}
                    label="Categoría"
                    name="category_ids"
                    options=${filterOptions.categories.map(c => ({ value: c.id, label: c.nombre }))}
                    selectedValues=${filters.category_ids}
                    onSelectionChange=${onFilterChange}
                />
                <${SearchableMultiSelectDropdown}
                    label="Usuario"
                    name="usuario_ids"
                    options=${filterOptions.users.map(u => ({ value: u.id, label: u.nombre_completo }))}
                    selectedValues=${filters.usuario_ids}
                    onSelectionChange=${onFilterChange}
                />
                ${user.role === 'Propietario' && html`
                    <${SearchableMultiSelectDropdown}
                        label="Sucursal"
                        name="sucursal_ids"
                        options=${filterOptions.branches.map(b => ({ value: b.id, label: b.nombre }))}
                        selectedValues=${filters.sucursal_ids}
                        onSelectionChange=${onFilterChange}
                    />
                `}
            </div>
        </div>
    `;
};


const FilterBar = ({ datePreset, onDatePresetChange, filters, onFilterChange, onClear, onToggleAdvanced, isAdvancedOpen }) => {
    return html`
        <div class="p-4 bg-white rounded-t-lg shadow-sm border-b-0 border">
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                <div class="lg:col-span-8">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Rango de Fechas</label>
                    <div class="flex items-center flex-wrap bg-white border rounded-md shadow-sm p-1">
                        <button onClick=${() => onDatePresetChange('today')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'today' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Hoy</button>
                        <button onClick=${() => onDatePresetChange('this_week')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_week' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Semana</button>
                        <button onClick=${() => onDatePresetChange('this_month')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_month' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Mes</button>
                        <button onClick=${() => onDatePresetChange('this_year')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_year' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Año</button>
                        <button onClick=${() => onDatePresetChange('custom')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'custom' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`} title="Rango personalizado">${ICONS.calendar_month}</button>
                    </div>
                </div>

                <div class="lg:col-span-4 flex items-center gap-2">
                    <button onClick=${onToggleAdvanced} class="relative w-full rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 flex items-center justify-between text-left">
                        <span>Filtros Avanzados</span>
                        ${isAdvancedOpen ? ICONS.chevron_up : ICONS.chevron_down}
                    </button>
                    <button onClick=${onClear} title="Limpiar todos los filtros" class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-white p-2 text-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                        ${ICONS.delete}
                    </button>
                </div>
            </div>
            
            ${datePreset === 'custom' && html`
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4 border-t animate-fade-in-down">
                    <${FormInput} label="Fecha Desde" name="startDate" type="date" value=${filters.startDate} onInput=${onFilterChange} required=${false} />
                    <${FormInput} label="Fecha Hasta" name="endDate" type="date" value=${filters.endDate} onInput=${onFilterChange} required=${false} />
                </div>
            `}
        </div>
    `;
};

const GastosList = ({ gastos, onEdit, onDelete, formatCurrency }) => {
    const getStatusPill = (comprobante_url) => {
        const hasReceipt = comprobante_url && comprobante_url.trim() !== '';
        const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
        return hasReceipt
            ? `${baseClasses} bg-blue-100 text-blue-800`
            : `${baseClasses} bg-gray-100 text-gray-800`;
    };

    if (gastos.length === 0) {
        return html`
            <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white mt-6">
                <div class="text-6xl text-gray-300">${ICONS.expenses}</div>
                <h3 class="mt-2 text-lg font-medium text-gray-900">No se encontraron gastos</h3>
                <p class="mt-1 text-sm text-gray-500">Intenta ajustar los filtros o registra tu primer gasto.</p>
            </div>
        `;
    }

    return html`
        <div class="space-y-4 md:hidden mt-6">
            ${gastos.map(g => html`
                <div key=${g.id} class="bg-white p-4 rounded-lg shadow border">
                    <div class="flex justify-between items-start">
                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-gray-800 truncate">${g.concepto}</div>
                            <div class="text-sm text-gray-500">${g.categoria_nombre || 'Sin categoría'}</div>
                        </div>
                         <div class="flex items-center gap-2">
                             <span class=${getStatusPill(g.comprobante_url)}>${g.comprobante_url ? 'Con Recibo' : 'Sin Recibo'}</span>
                        </div>
                    </div>
                    <div class="flex justify-between items-end mt-2 pt-2 border-t">
                        <div class="text-sm">
                            <p class="text-gray-500">${new Date(g.fecha).toLocaleDateString()}</p>
                            <p class="text-lg font-bold text-gray-900">${formatCurrency(g.monto)}</p>
                        </div>
                        <div class="flex items-center">
                            <button onClick=${() => onEdit(g)} class="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-full">${ICONS.edit}</button>
                            <button onClick=${() => onDelete(g)} class="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full">${ICONS.delete}</button>
                        </div>
                    </div>
                </div>
            `)}
        </div>

        <div class="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg mt-0">
            <table class="min-w-full divide-y divide-gray-300">
                <thead class="bg-gray-50">
                    <tr>
                        <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Fecha</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Concepto</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Categoría</th>
                        <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Monto</th>
                        <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Acciones</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                    ${gastos.map(g => html`
                        <tr key=${g.id} class="hover:bg-gray-50">
                            <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">${new Date(g.fecha).toLocaleDateString()}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">${g.concepto}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${g.categoria_nombre || 'Sin categoría'}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-right font-semibold text-gray-800">${formatCurrency(g.monto)}</td>
                            <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                <div class="flex justify-end gap-2">
                                    ${g.comprobante_url && html`<a href=${g.comprobante_url} target="_blank" title="Ver Comprobante" class="text-gray-400 hover:text-blue-600 p-1 rounded-full hover:bg-gray-100">${ICONS.upload_file}</a>`}
                                    <button onClick=${() => onEdit(g)} class="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                                    <button onClick=${() => onDelete(g)} class="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-gray-100">${ICONS.delete}</button>
                                </div>
                            </td>
                        </tr>
                    `)}
                </tbody>
            </table>
        </div>
    `;
};

const getDatesFromPreset = (preset) => {
    const now = new Date();
    let start, end;

    const toISODateString = (date) => {
        if (!date) return '';
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split("T")[0];
    };

    switch (preset) {
        case 'today':
            start = new Date(now);
            end = new Date(now);
            break;
        case 'this_week':
            start = new Date(now);
            const day = start.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            start.setDate(start.getDate() + diffToMonday);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            break;
        case 'this_month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'this_year':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
            break;
        case 'all':
            return { startDate: '', endDate: '' };
        default:
            return { startDate: '', endDate: '' };
    }
    return { startDate: toISODateString(start), endDate: toISODateString(end) };
};


export function GastosPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    
    const [data, setData] = useState({ gastos: [], stats: { total: 0, count: 0 } });
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [gastoToEdit, setGastoToEdit] = useState(null);
    const [gastoToDelete, setGastoToDelete] = useState(null);

    const [datePreset, setDatePreset] = useState('this_month');
    const [filters, setFilters] = useState(() => {
        const { startDate, endDate } = getDatesFromPreset('this_month');
        return { ...initialFilters, startDate, endDate };
    });
    const [filterOptions, setFilterOptions] = useState({ categories: [], users: [], branches: [] });
    const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
    
    const formatCurrency = (value) => {
        const number = Number(value || 0);
        const formattedNumber = number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${companyInfo.monedaSimbolo} ${formattedNumber}`;
    };
    
    useEffect(() => {
        if (user.role === 'Empleado') {
            addToast({ message: 'No tienes permiso para acceder a este módulo.', type: 'warning' });
            navigate('/dashboard');
        }
    }, [user.role, navigate, addToast]);

    const fetchData = useCallback(async () => {
        if (user.role === 'Empleado') return;
        startLoading();
        try {
            let sucursalIdsToSend = null;
            if (user.role === 'Propietario') {
                if (filters.sucursal_ids.length > 0) {
                    sucursalIdsToSend = filters.sucursal_ids;
                }
            } else if (user.role === 'Administrador') {
                sucursalIdsToSend = [user.sucursal_id];
            }
            
            const [gastosRes, optionsRes] = await Promise.all([
                supabase.rpc('get_company_gastos', {
                    p_start_date: filters.startDate || null,
                    p_end_date: filters.endDate || null,
                    p_category_ids: filters.category_ids.length > 0 ? filters.category_ids : null,
                    p_user_ids: filters.usuario_ids.length > 0 ? filters.usuario_ids : null,
                    p_sucursal_ids: sucursalIdsToSend
                }),
                supabase.rpc('get_gastos_filter_data')
            ]);
            
            if (gastosRes.error) throw gastosRes.error;
            if (optionsRes.error) throw optionsRes.error;

            setData(gastosRes.data);
            setFilterOptions(optionsRes.data);
        } catch (err) {
            addToast({ message: `Error al cargar gastos: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    }, [user.role, user.sucursal_id, addToast, startLoading, stopLoading, filters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useRealtimeListener(fetchData);
    
    if (user.role === 'Empleado') {
        return null; 
    }
    
    const kpis = useMemo(() => {
        const total = data.stats?.total || 0;
        const count = data.stats?.count || 0;
        return {
            totalGastado: total,
            numGastos: count,
            gastoPromedio: count > 0 ? total / count : 0,
        };
    }, [data.stats]);
    
    const handleAdd = () => { setGastoToEdit(null); setFormModalOpen(true); };
    const handleEdit = (gasto) => { setGastoToEdit(gasto); setFormModalOpen(true); };
    const handleDelete = (gasto) => { setGastoToDelete(gasto); setDeleteModalOpen(true); };

    const handleConfirmDelete = async () => {
        if (!gastoToDelete) return;
        startLoading();
        try {
            const { error } = await supabase.rpc('delete_gasto', { p_id: gastoToDelete.id });
            if (error) throw error;
            addToast({ message: `Gasto eliminado.`, type: 'success' });
            fetchData();
        } catch(err) {
             addToast({ message: `Error al eliminar: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
            setDeleteModalOpen(false);
        }
    };

    const handleSave = () => {
        setFormModalOpen(false);
        fetchData();
    };

    const handleDatePresetChange = (preset) => {
        setDatePreset(preset);
        if (preset !== 'custom') {
            const { startDate, endDate } = getDatesFromPreset(preset);
            setFilters(prev => ({ ...prev, startDate, endDate }));
        }
    };
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };
    const handleClearFilters = () => { 
        const { startDate, endDate } = getDatesFromPreset('this_month');
        setFilters({ ...initialFilters, startDate, endDate }); 
        setDatePreset('this_month'); 
        setIsAdvancedSearchOpen(false); 
    };
    
    const breadcrumbs = [ { name: 'Gastos', href: '#/gastos' } ];

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Gastos"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Gestión de Gastos</h1>
                    <p class="mt-1 text-sm text-gray-600">Registra y supervisa todos los gastos operativos de tu negocio.</p>
                </div>
                 <button 
                    onClick=${handleAdd}
                    class="hidden sm:inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
                >
                    ${ICONS.add} Registrar Gasto
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
                <${KPI_Card} title="Total Gastado (Filtrado)" value=${formatCurrency(kpis.totalGastado)} icon=${ICONS.paid} color="amber" />
                <${KPI_Card} title="Nº de Gastos (Filtrado)" value=${kpis.numGastos} icon=${ICONS.newExpense} />
                <${KPI_Card} title="Gasto Promedio (Filtrado)" value=${formatCurrency(kpis.gastoPromedio)} icon=${ICONS.chart} />
            </div>

            <div class="mt-8">
                <${FilterBar} datePreset=${datePreset} onDatePresetChange=${handleDatePresetChange} filters=${filters} onFilterChange=${handleFilterChange} onClear=${handleClearFilters} onToggleAdvanced=${() => setIsAdvancedSearchOpen(p => !p)} isAdvancedOpen=${isAdvancedSearchOpen} />
                <${AdvancedFilterPanel} isOpen=${isAdvancedSearchOpen} filters=${filters} onFilterChange=${handleFilterChange} filterOptions=${filterOptions} user=${user} />

                <div class="mt-6 md:mt-0">
                    <${GastosList} gastos=${data.gastos} onEdit=${handleEdit} onDelete=${handleDelete} formatCurrency=${formatCurrency} />
                </div>
            </div>

            <div class="sm:hidden">
                <${FloatingActionButton} onClick=${handleAdd} label="Registrar Gasto" />
            </div>

            <${GastoFormModal}
                isOpen=${isFormModalOpen}
                onClose=${() => setFormModalOpen(false)}
                onSave=${handleSave}
                onCategoryAdded=${fetchData}
                gastoToEdit=${gastoToEdit}
                categorias=${filterOptions.categories}
                user=${user}
            />
            
            <${ConfirmationModal}
                isOpen=${isDeleteModalOpen}
                onClose=${() => setDeleteModalOpen(false)}
                onConfirm=${handleConfirmDelete}
                title="Confirmar Eliminación"
                confirmText="Sí, eliminar"
                confirmVariant="danger"
                icon=${ICONS.warning_amber}
            >
                 <p class="text-sm text-gray-600">¿Estás seguro de que quieres eliminar el gasto <span class="font-bold text-gray-800">${gastoToDelete?.concepto}</span>?</p>
            <//>
        <//>
    `;
}