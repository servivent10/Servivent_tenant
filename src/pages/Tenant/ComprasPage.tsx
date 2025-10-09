

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { FloatingActionButton } from '../../components/FloatingActionButton.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { supabase } from '../../lib/supabaseClient.js';
import { FormInput } from '../../components/FormComponents.js';


const initialFilters = {
    datePreset: 'all',
    startDate: '',
    endDate: '',
    status: 'all',
    type: 'all',
    proveedor_id: 'all',
    usuario_ids: [],
    sucursal_ids: []
};


const SearchableSelect = ({ label, options, selectedValue, onSelect, name, placeholder }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    const selectedOption = useMemo(() => options.find(o => o.id === selectedValue), [options, selectedValue]);

    useEffect(() => {
        setSearchTerm(selectedOption ? selectedOption.nombre : '');
    }, [selectedOption]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm || (selectedOption && searchTerm === selectedOption.nombre)) {
            return options;
        }
        const lowerCaseSearch = searchTerm.toLowerCase();
        return options.filter(o => o.nombre.toLowerCase().includes(lowerCaseSearch));
    }, [searchTerm, options, selectedOption]);

    const handleSelection = (optionId) => {
        onSelect({ target: { name, value: optionId } });
        setIsOpen(false);
    };
    
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
            <input
                id=${name}
                type="text"
                value=${searchTerm}
                onInput=${e => { setSearchTerm(e.target.value); setIsOpen(true); }}
                onFocus=${(e) => { e.target.select(); setIsOpen(true); }}
                placeholder=${placeholder}
                class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm"
            />
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

const MultiSelectDropdown = ({ label, options, selectedValues, onSelectionChange, name }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCheckboxChange = (value) => {
        const newValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onSelectionChange({ target: { name, value: newValues } });
    };

    return html`
        <div ref=${wrapperRef} class="relative">
            <label class="block text-sm font-medium text-gray-700">${label}</label>
            <button onClick=${() => setIsOpen(!isOpen)} type="button" class="mt-1 relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                <span class="block truncate text-gray-900">${selectedValues.length > 0 ? `${selectedValues.length} seleccionados` : 'Todos'}</span>
                <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
                    ${ICONS.chevron_down}
                </span>
            </button>
            ${isOpen && html`
                <div class="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg max-h-60 overflow-auto ring-1 ring-black ring-opacity-5">
                    <div class="p-2">
                    ${options.map(option => html`
                        <label key=${option.value} class="flex w-full items-center gap-2 p-2 rounded-md hover:bg-slate-100 cursor-pointer">
                            <input type="checkbox" checked=${selectedValues.includes(option.value)} onChange=${() => handleCheckboxChange(option.value)} class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                            <span class="text-sm text-gray-900">${option.label}</span>
                        </label>
                    `)}
                    </div>
                </div>
            `}
        </div>
    `;
};

const AdvancedFilterPanel = ({ isOpen, filters, onFilterChange, filterOptions, user }) => {
    if (!isOpen) return null;

    return html`
        <div class="p-4 bg-slate-50 border-t border-b animate-fade-in-down mb-6 rounded-b-lg shadow-inner">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <${SearchableSelect}
                    label="Proveedor"
                    name="proveedor_id"
                    placeholder="Buscar proveedor..."
                    options=${[{ id: 'all', nombre: 'Todos los Proveedores' }, ...filterOptions.providers]}
                    selectedValue=${filters.proveedor_id}
                    onSelect=${onFilterChange}
                />
                <${MultiSelectDropdown}
                    label="Usuario"
                    name="usuario_ids"
                    options=${filterOptions.users.map(u => ({ value: u.id, label: u.nombre_completo }))}
                    selectedValues=${filters.usuario_ids}
                    onSelectionChange=${onFilterChange}
                />
                ${user.role === 'Propietario' && html`
                    <${MultiSelectDropdown}
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


const FilterBar = ({ filters, onFilterChange, onClear, onToggleAdvanced, isAdvancedOpen }) => {
    const isCustomDate = filters.datePreset === 'custom';
    
    const advancedFilterCount = (filters.proveedor_id !== 'all' ? 1 : 0) +
                                filters.usuario_ids.length +
                                filters.sucursal_ids.length;

    return html`
        <div class="p-4 bg-white rounded-t-lg shadow-sm border-b-0 border">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label for="datePreset" class="block text-sm font-medium text-gray-700">Rango de Fechas</label>
                    <select id="datePreset" name="datePreset" value=${filters.datePreset} onChange=${onFilterChange} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                        <option value="all">Todas</option>
                        <option value="today">Hoy</option>
                        <option value="yesterday">Ayer</option>
                        <option value="last7">Últimos 7 días</option>
                        <option value="thisMonth">Este Mes</option>
                        <option value="custom">Personalizado</option>
                    </select>
                </div>
                <div>
                    <label for="status" class="block text-sm font-medium text-gray-700">Estado de Pago</label>
                    <select id="status" name="status" value=${filters.status} onChange=${onFilterChange} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                        <option value="all">Todos</option>
                        <option value="Pagada">Pagada</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="Abono Parcial">Abono Parcial</option>
                    </select>
                </div>
                <div>
                    <label for="type" class="block text-sm font-medium text-gray-700">Tipo de Compra</label>
                    <select id="type" name="type" value=${filters.type} onChange=${onFilterChange} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                        <option value="all">Todas</option>
                        <option value="Contado">Contado</option>
                        <option value="Crédito">Crédito</option>
                    </select>
                </div>
                <div class="flex items-end gap-2">
                    <button onClick=${onToggleAdvanced} class="relative w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 flex items-center justify-center gap-2">
                        Búsqueda Avanzada ${isAdvancedOpen ? ICONS.chevron_up : ICONS.chevron_down}
                        ${advancedFilterCount > 0 && html`
                            <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">${advancedFilterCount}</span>
                        `}
                    </button>
                    <button onClick=${onClear} title="Limpiar todos los filtros" class="rounded-md bg-white p-2 text-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                        ${ICONS.delete}
                    </button>
                </div>
            </div>
            ${isCustomDate && html`
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 mt-4 border-t animate-fade-in-down">
                    <${FormInput} label="Fecha Desde" name="startDate" type="date" value=${filters.startDate} onInput=${onFilterChange} required=${false} />
                    <${FormInput} label="Fecha Hasta" name="endDate" type="date" value=${filters.endDate} onInput=${onFilterChange} required=${false} />
                </div>
            `}
        </div>
    `;
};


export function ComprasPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const [compras, setCompras] = useState([]);
    const [filters, setFilters] = useState(initialFilters);
    const [filterOptions, setFilterOptions] = useState({ providers: [], users: [], branches: [] });
    const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();

    const formatCurrency = (value) => {
        const number = Number(value || 0);
        const formattedNumber = number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${companyInfo.monedaSimbolo} ${formattedNumber}`;
    };
    
    const fetchData = async () => {
        startLoading();
        try {
            const [purchasesRes, optionsRes] = await Promise.all([
                supabase.rpc('get_company_purchases'),
                supabase.rpc('get_purchases_filter_data')
            ]);
            if (purchasesRes.error) throw purchasesRes.error;
            if (optionsRes.error) throw optionsRes.error;
            setCompras(purchasesRes.data);
            setFilterOptions(optionsRes.data);
        } catch (err) {
            addToast({ message: `Error al cargar datos: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleClearFilters = () => {
        setFilters(initialFilters);
        setIsAdvancedSearchOpen(false);
    };

    const filteredCompras = useMemo(() => {
        return compras.filter(compra => {
            const compraDate = new Date(compra.fecha);
            if (filters.datePreset !== 'all') {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                let startDate, endDate = new Date(today); endDate.setDate(endDate.getDate() + 1);
                switch(filters.datePreset) {
                    case 'today': startDate = new Date(today); break;
                    case 'yesterday': endDate = new Date(today); startDate = new Date(today); startDate.setDate(startDate.getDate() - 1); break;
                    case 'last7': startDate = new Date(today); startDate.setDate(startDate.getDate() - 6); break;
                    case 'thisMonth': startDate = new Date(today.getFullYear(), today.getMonth(), 1); break;
                    case 'custom':
                        startDate = filters.startDate ? new Date(filters.startDate.replace(/-/g, '/')) : null;
                        endDate = filters.endDate ? new Date(filters.endDate.replace(/-/g, '/')) : null;
                        if (endDate) endDate.setDate(endDate.getDate() + 1);
                        break;
                }
                if ((startDate && compraDate < startDate) || (endDate && compraDate >= endDate)) return false;
            }
            if (filters.status !== 'all' && compra.estado_pago !== filters.status) return false;
            if (filters.type !== 'all' && compra.tipo_pago !== filters.type) return false;

            if (filters.proveedor_id !== 'all' && compra.proveedor_id !== filters.proveedor_id) return false;
            if (filters.usuario_ids.length > 0 && !filters.usuario_ids.includes(compra.usuario_id)) return false;
            if (user.role === 'Propietario' && filters.sucursal_ids.length > 0 && !filters.sucursal_ids.includes(compra.sucursal_id)) return false;
            
            return true;
        });
    }, [compras, filters, user.role]);

    const kpis = useMemo(() => {
        const totalFiltrado = filteredCompras.reduce((sum, c) => sum + Number(c.total_bob || 0), 0);
        const totalComprasCount = filteredCompras.length;
        
        const comprasPorPagar = filteredCompras.filter(c => c.estado_pago !== 'Pagada');
        const cuentasPorPagar = comprasPorPagar.reduce((sum, c) => sum + Number(c.saldo_pendiente || 0), 0);
        const cuentasPorPagarCount = comprasPorPagar.length;

        const comprasACredito = filteredCompras.filter(c => c.tipo_pago === 'Crédito');
        const totalComprasCredito = comprasACredito.reduce((sum, c) => sum + Number(c.total_bob || 0), 0);
        const comprasCreditoCount = comprasACredito.length;

        return { 
            totalFiltrado,
            totalComprasCount,
            cuentasPorPagar,
            cuentasPorPagarCount,
            totalComprasCredito,
            comprasCreditoCount
        };
    }, [filteredCompras]);

    const breadcrumbs = [ { name: 'Compras', href: '#/compras' } ];

    const getStatusPill = (status) => {
        const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
        switch (status) {
            case 'Pagada': return `${baseClasses} bg-green-100 text-green-800`;
            case 'Pendiente': return `${baseClasses} bg-red-100 text-red-800`;
            case 'Abono Parcial': return `${baseClasses} bg-amber-100 text-amber-800`;
            default: return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };
    
    const ComprasList = ({ compras }) => {
        const handleRowClick = (compra) => {
            navigate(`/compras/${compra.id}`);
        };
        
        if (compras.length === 0) {
            return html`
                <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white mt-6">
                    <div class="text-6xl text-gray-300">${ICONS.purchases}</div>
                    <h3 class="mt-2 text-lg font-medium text-gray-900">No se encontraron compras</h3>
                    <p class="mt-1 text-sm text-gray-500">Intenta ajustar los filtros o registra tu primera compra.</p>
                </div>
            `;
        }
        
        return html`
            <div class="space-y-4 md:hidden mt-6">
                ${compras.map(c => html`
                    <div key=${c.id} onClick=${() => handleRowClick(c)} class="bg-white p-4 rounded-lg shadow border cursor-pointer">
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="font-bold text-gray-800">${c.proveedor_nombre}</div>
                                <div class="text-sm text-gray-600">Folio: ${c.folio}</div>
                            </div>
                            <span class=${getStatusPill(c.estado_pago)}>${c.estado_pago}</span>
                        </div>
                        <div class="flex justify-between items-end mt-2 pt-2 border-t">
                            <div class="text-sm">
                                <p class="text-gray-500">${new Date(c.fecha).toLocaleString()}</p>
                                <p class="text-lg font-bold text-gray-900">${formatCurrency(c.total_bob)}</p>
                            </div>
                            <span class="text-xs text-primary font-semibold">Ver Detalles ${ICONS.chevron_right}</span>
                        </div>
                    </div>
                `)}
            </div>

            <div class="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg mt-0">
                <table class="min-w-full divide-y divide-gray-300">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Folio</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Proveedor</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Total (BOB)</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white">
                        ${compras.map(c => html`
                            <tr key=${c.id} onClick=${() => handleRowClick(c)} class="hover:bg-gray-50 cursor-pointer">
                                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">${c.folio}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${c.proveedor_nombre}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${new Date(c.fecha).toLocaleString()}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-800">${formatCurrency(c.total_bob)}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm"><span class=${getStatusPill(c.estado_pago)}>${c.estado_pago}</span></td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        `;
    };

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Compras"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Gestión de Compras</h1>
                    <p class="mt-1 text-sm text-gray-600">Registra y supervisa las adquisiciones de tu negocio.</p>
                </div>
                 <button 
                    onClick=${() => navigate('/compras/nueva')}
                    class="hidden sm:inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
                >
                    ${ICONS.add} Registrar Nueva Compra
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
                 <${KPI_Card}
                    title="Total Comprado"
                    value=${formatCurrency(kpis.totalFiltrado)}
                    icon=${ICONS.shopping_cart}
                    color="primary"
                    count=${kpis.totalComprasCount}
                    countLabel="Total de compras"
                />
                 <${KPI_Card}
                    title="Cuentas por Pagar"
                    value=${formatCurrency(kpis.cuentasPorPagar)}
                    icon=${ICONS.credit_score}
                    color="amber"
                    count=${kpis.cuentasPorPagarCount}
                    countLabel="Compras por pagar"
                />
                 <${KPI_Card}
                    title="Compras a Crédito"
                    value=${formatCurrency(kpis.totalComprasCredito)}
                    icon=${ICONS.newExpense}
                    color="green"
                    count=${kpis.comprasCreditoCount}
                    countLabel="Cantidad de compras a crédito"
                 />
            </div>

            <div class="mt-8">
                <${FilterBar} filters=${filters} onFilterChange=${handleFilterChange} onClear=${handleClearFilters} onToggleAdvanced=${() => setIsAdvancedSearchOpen(prev => !prev)} isAdvancedOpen=${isAdvancedSearchOpen} />
                <${AdvancedFilterPanel} isOpen=${isAdvancedSearchOpen} filters=${filters} onFilterChange=${handleFilterChange} filterOptions=${filterOptions} user=${user} />
                <div class="mt-6 md:mt-0">
                    <${ComprasList} compras=${filteredCompras} />
                </div>
            </div>

            <div class="sm:hidden">
                <${FloatingActionButton} onClick=${() => navigate('/compras/nueva')} label="Registrar Nueva Compra" />
            </div>
        <//>
    `;
}