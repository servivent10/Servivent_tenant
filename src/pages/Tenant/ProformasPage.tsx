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
import { useRealtimeListener } from '../../hooks/useRealtime.js';
import { FormInput, FormSelect } from '../../components/FormComponents.js';
import { SearchableMultiSelectDropdown } from '../../components/SearchableMultiSelectDropdown.js';

const initialFilters = {
    startDate: '',
    endDate: '',
    estado: 'all',
    cliente_id: 'all',
    usuario_ids: [],
    sucursal_ids: []
};

const getDatesFromPreset = (preset) => {
    const now = new Date();
    let start, end;
    const toISODateString = (d) => d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split("T")[0] : '';
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

const SearchableSelect = ({ label, options, selectedValue, onSelect, name, placeholder }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);
    const selectedOption = useMemo(() => options.find(o => o.id === selectedValue), [options, selectedValue]);
    useEffect(() => { setSearchTerm(selectedOption ? selectedOption.nombre : ''); }, [selectedOption]);
    const filteredOptions = useMemo(() => {
        if (!searchTerm || (selectedOption && searchTerm === selectedOption.nombre)) return options;
        return options.filter(o => o.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, options, selectedOption]);
    const handleSelection = (optionId) => { onSelect({ target: { name, value: optionId } }); setIsOpen(false); };
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm(selectedOption ? selectedOption.nombre : '');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedOption]);
    return html`
        <div ref=${wrapperRef} class="relative">
            <label for=${name} class="block text-sm font-medium text-gray-700">${label}</label>
            <input id=${name} type="text" value=${searchTerm} onInput=${e => { setSearchTerm(e.target.value); setIsOpen(true); }} onFocus=${(e) => { e.target.select(); setIsOpen(true); }} placeholder=${placeholder} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm" />
            ${isOpen && html`
                <ul class="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg max-h-60 overflow-auto py-1 text-base ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    ${filteredOptions.map(option => html`
                        <li onClick=${() => handleSelection(option.id)} class="text-gray-900 relative cursor-default select-none py-2 px-4 hover:bg-slate-100">
                            <span class="block truncate ${option.id === selectedValue ? 'font-semibold' : 'font-normal'}">${option.nombre}</span>
                        </li>
                    `)}
                </ul>
            `}
        </div>
    `;
};


export function ProformasPage({ user, onLogout, onProfileUpdate, companyInfo, navigate }) {
    const [data, setData] = useState({ proformas: [], kpis: { total_cotizado: 0, tasa_conversion: 0, proformas_vigentes: 0 }, filterOptions: { clients: [], users: [], branches: [] } });
    const [datePreset, setDatePreset] = useState('this_month');
    const [filters, setFilters] = useState(() => {
        const { startDate, endDate } = getDatesFromPreset('this_month');
        return { ...initialFilters, startDate, endDate };
    });
    const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();

    const formatCurrency = (value) => {
        const number = Number(value || 0);
        const formattedNumber = number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${companyInfo.monedaSimbolo} ${formattedNumber}`;
    };
    
    const fetchData = useCallback(async () => {
        startLoading();
        try {
            const { data: result, error } = await supabase.rpc('get_proformas_data_filtered', {
                p_start_date: filters.startDate || null,
                p_end_date: filters.endDate || null,
                p_timezone: companyInfo.timezone,
                p_estado: filters.estado === 'all' ? null : filters.estado,
                p_cliente_id: filters.cliente_id === 'all' ? null : filters.cliente_id,
                p_usuario_ids: filters.usuario_ids.length > 0 ? filters.usuario_ids : null,
                p_sucursal_ids: user.role === 'Propietario' && filters.sucursal_ids.length > 0 ? filters.sucursal_ids : null,
            });
            if (error) throw error;
            setData(result || { proformas: [], kpis: {}, filterOptions: {} });
        } catch (err) {
            addToast({ message: `Error al cargar proformas: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    }, [filters, companyInfo.timezone, user.role]);

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

    const handleClearFilters = () => {
        const { startDate, endDate } = getDatesFromPreset('this_month');
        setFilters({ ...initialFilters, startDate, endDate });
        setDatePreset('this_month');
        setIsAdvancedSearchOpen(false);
    };

    const { proformas, kpis, filterOptions } = data;
    const breadcrumbs = [ { name: 'Proformas', href: '#/proformas' } ];
    
    const getStatusPill = (status) => {
        const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
        switch (status) {
            case 'Vigente': return `${baseClasses} bg-blue-100 text-blue-800`;
            case 'Convertida': return `${baseClasses} bg-green-100 text-green-800`;
            case 'Anulada': return `${baseClasses} bg-gray-100 text-gray-800`;
            case 'Vencida': return `${baseClasses} bg-red-100 text-red-800`;
            default: return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };
    
    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Proformas"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Proformas / Cotizaciones</h1>
                    <p class="mt-1 text-sm text-gray-600">Crea y gestiona cotizaciones para tus clientes sin afectar tu inventario.</p>
                </div>
                 <button 
                    onClick=${() => navigate('/proformas/nueva')}
                    class="hidden sm:inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
                >
                    ${ICONS.add} Nueva Proforma
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
                <${KPI_Card} title="Total Cotizado (Filtrado)" value=${formatCurrency(kpis.total_cotizado)} icon=${ICONS.dollar} color="primary" />
                <${KPI_Card} title="Tasa de Conversión" value=${`${kpis.tasa_conversion || 0}%`} icon=${ICONS.chart} color="green" />
                <${KPI_Card} title="Proformas Vigentes" value=${kpis.proformas_vigentes || 0} icon=${ICONS.edit_note} color="amber" />
            </div>

            <div class="mt-8">
                <div class="p-4 bg-white rounded-t-lg shadow-sm border-b-0 border">
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                        <div class="sm:col-span-2 lg:col-span-6">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Rango de Fechas</label>
                            <div class="flex items-center flex-wrap bg-white border rounded-md shadow-sm p-1">
                                <button onClick=${() => handleDatePresetChange('today')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'today' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Hoy</button>
                                <button onClick=${() => handleDatePresetChange('this_week')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_week' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Semana</button>
                                <button onClick=${() => handleDatePresetChange('this_month')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_month' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Mes</button>
                                <button onClick=${() => handleDatePresetChange('this_year')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_year' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Año</button>
                                <button onClick=${() => handleDatePresetChange('custom')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'custom' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`} title="Rango personalizado">${ICONS.calendar_month}</button>
                            </div>
                        </div>
                        <div class="lg:col-span-3"><${FormSelect} label="Estado" name="estado" value=${filters.estado} onInput=${handleFilterChange} options=${[{value:'all', label:'Todos'}, {value:'Vigente', label:'Vigente'}, {value:'Convertida', label:'Convertida'}, {value:'Anulada', label:'Anulada'}, {value:'Vencida', label:'Vencida'}]} /></div>
                        <div class="lg:col-span-3 flex items-center gap-2">
                            <button onClick=${() => setIsAdvancedSearchOpen(p => !p)} class="w-full rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 flex items-center justify-between">Avanzada ${isAdvancedSearchOpen ? ICONS.chevron_up : ICONS.chevron_down}</button>
                            <button onClick=${handleClearFilters} title="Limpiar filtros" class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-white p-2 text-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">${ICONS.delete}</button>
                        </div>
                    </div>
                    ${datePreset === 'custom' && html`<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4 border-t animate-fade-in-down"><${FormInput} label="Desde" name="startDate" type="date" value=${filters.startDate} onInput=${handleFilterChange} required=${false} /><${FormInput} label="Hasta" name="endDate" type="date" value=${filters.endDate} onInput=${handleFilterChange} required=${false} /></div>`}
                </div>

                ${isAdvancedSearchOpen && html`
                    <div class="p-4 bg-slate-50 border-t border-b animate-fade-in-down mb-6 rounded-b-lg shadow-inner">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <${SearchableSelect} label="Cliente" name="cliente_id" placeholder="Buscar cliente..." options=${[{id:'all', nombre:'Todos'}, ...(filterOptions.clients || [])]} selectedValue=${filters.cliente_id} onSelect=${handleFilterChange} />
                            <${SearchableMultiSelectDropdown} label="Usuario" name="usuario_ids" options=${(filterOptions.users || []).map(u => ({value: u.id, label: u.nombre_completo}))} selectedValues=${filters.usuario_ids} onSelectionChange=${handleFilterChange} />
                            ${user.role === 'Propietario' && html`<${SearchableMultiSelectDropdown} label="Sucursal" name="sucursal_ids" options=${(filterOptions.branches || []).map(b => ({value: b.id, label: b.nombre}))} selectedValues=${filters.sucursal_ids} onSelectionChange=${handleFilterChange} />`}
                        </div>
                    </div>
                `}

                <div class="mt-6 md:mt-0">
                    ${(proformas || []).length === 0 ? html`
                        <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white mt-6">
                            <h3 class="mt-2 text-lg font-medium text-gray-900">No se encontraron proformas</h3>
                            <p class="mt-1 text-sm text-gray-500">Intenta ajustar los filtros de búsqueda.</p>
                        </div>
                    ` : html`
                        <div class="space-y-4 md:hidden">
                            ${proformas.map(p => html`<div key=${p.id} onClick=${() => navigate(`/proformas/${p.id}`)} class="bg-white p-4 rounded-lg shadow border cursor-pointer"><div class="flex justify-between items-start"><div><div class="font-bold text-gray-800">${p.folio}</div><div class="text-sm text-gray-600">${p.cliente_nombre}</div></div><span class=${getStatusPill(p.estado)}>${p.estado}</span></div><div class="flex justify-between items-end mt-2 pt-2 border-t"><div class="text-sm"><p class="text-gray-500">${new Date(p.fecha_emision).toLocaleDateString()}</p><p class="text-lg font-bold text-gray-900">${formatCurrency(p.total)}</p></div><span class="text-xs text-primary font-semibold">Ver Detalles ${ICONS.chevron_right}</span></div></div>`)}
                        </div>
                        <div class="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                            <table class="min-w-full divide-y divide-gray-300">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Folio</th>
                                        <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Cliente</th>
                                        <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha</th>
                                        <th class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Total</th>
                                        <th class="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Estado</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-200 bg-white">
                                    ${proformas.map(p => html`<tr key=${p.id} onClick=${() => navigate(`/proformas/${p.id}`)} class="hover:bg-gray-50 cursor-pointer"><td class="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">${p.folio}</td><td class="px-3 py-4 text-sm text-gray-500">${p.cliente_nombre}</td><td class="px-3 py-4 text-sm text-gray-500">${new Date(p.fecha_emision).toLocaleDateString()}</td><td class="px-3 py-4 text-sm text-right font-semibold text-gray-800">${formatCurrency(p.total)}</td><td class="px-3 py-4 text-sm text-center"><span class=${getStatusPill(p.estado)}>${p.estado}</span></td></tr>`)}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>

            <div class="sm:hidden">
                <${FloatingActionButton} onClick=${() => navigate('/proformas/nueva')} label="Nueva Proforma" />
            </div>
        <//>
    `;
}
