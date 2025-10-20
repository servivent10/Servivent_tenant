/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { supabase } from '../../lib/supabaseClient.js';
import { FormInput, FormSelect } from '../../components/FormComponents.js';
import { generatePdfFromComponent } from '../../lib/pdfGenerator.js';
import { NotaVentaTemplate } from '../../components/receipts/NotaVentaTemplate.js';
import { Spinner } from '../../components/Spinner.js';

const initialFilters = {
    startDate: '',
    endDate: '',
    status: 'all',
    type: 'all',
    cliente_id: 'all',
    vendedor_ids: [],
    sucursal_ids: [],
    metodos_pago: [],
    estado_vencimiento: 'all' // Nuevo filtro
};

const PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'QR', 'Transferencia Bancaria'];


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
                // Restore search term if user clicks away without selecting
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
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <${SearchableSelect}
                    label="Cliente"
                    name="cliente_id"
                    placeholder="Buscar cliente..."
                    options=${[{ id: 'all', nombre: 'Todos los Clientes' }, ...filterOptions.clients]}
                    selectedValue=${filters.cliente_id}
                    onSelect=${onFilterChange}
                />
                <${MultiSelectDropdown}
                    label="Vendedor"
                    name="vendedor_ids"
                    options=${filterOptions.users.map(u => ({ value: u.id, label: u.nombre_completo }))}
                    selectedValues=${filters.vendedor_ids}
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
                <${MultiSelectDropdown}
                    label="Método de Pago"
                    name="metodos_pago"
                    options=${PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
                    selectedValues=${filters.metodos_pago}
                    onSelectionChange=${onFilterChange}
                />
            </div>
        </div>
    `;
};


const FilterBar = ({ datePreset, onDatePresetChange, filters, onFilterChange, onClear, onToggleAdvanced, isAdvancedOpen }) => {
    return html`
        <div class="p-4 bg-white rounded-t-lg shadow-sm border-b-0 border">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                <div class="sm:col-span-2 lg:col-span-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Rango de Fechas</label>
                    <div class="flex items-center flex-wrap bg-white border rounded-md shadow-sm p-1">
                        <button onClick=${() => onDatePresetChange('today')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'today' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Hoy</button>
                        <button onClick=${() => onDatePresetChange('this_week')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_week' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Semana</button>
                        <button onClick=${() => onDatePresetChange('this_month')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_month' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Mes</button>
                        <button onClick=${() => onDatePresetChange('this_year')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_year' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Año</button>
                        <button onClick=${() => onDatePresetChange('custom')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'custom' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`} title="Rango personalizado">${ICONS.calendar_month}</button>
                    </div>
                </div>
                
                <div class="lg:col-span-2">
                    <${FormSelect}
                        label="Estado de Pago"
                        name="status"
                        value=${filters.status}
                        onInput=${onFilterChange}
                        options=${[
                            { value: 'all', label: 'Todos' },
                            { value: 'Pagada', label: 'Pagada' },
                            { value: 'Pendiente', label: 'Pendiente' },
                            { value: 'Abono Parcial', label: 'Abono Parcial' },
                            { value: 'Pedido Web Pendiente', label: 'Pedido Web Pendiente' },
                        ]}
                    />
                </div>
                 <div class="lg:col-span-2">
                    <${FormSelect} 
                        label="Estado de Vencimiento"
                        name="estado_vencimiento"
                        value=${filters.estado_vencimiento}
                        onInput=${onFilterChange}
                        options=${[
                            { value: 'all', label: 'Todos' },
                            { value: 'Al día', label: 'Al día' },
                            { value: 'Vencida', label: 'Vencida' },
                            { value: 'Pagada', label: 'Pagada' },
                        ]}
                    />
                </div>
                <div class="lg:col-span-2">
                    <${FormSelect}
                        label="Tipo de Venta"
                        name="type"
                        value=${filters.type}
                        onInput=${onFilterChange}
                        options=${[
                            { value: 'all', label: 'Todas' },
                            { value: 'Contado', label: 'Contado' },
                            { value: 'Crédito', label: 'Crédito' },
                        ]}
                    />
                </div>

                <div class="lg:col-span-2 flex items-center gap-2">
                    <button onClick=${onToggleAdvanced} class="relative w-full rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 flex items-center justify-between text-left">
                        <span>Avanzada</span>
                        ${isAdvancedOpen ? ICONS.chevron_up : ICONS.chevron_down}
                    </button>
                    <button onClick=${onClear} title="Limpiar filtros" class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-white p-2 text-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
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

const getDatesFromPreset = (preset) => {
    const now = new Date();
    let start, end;
    now.setHours(0, 0, 0, 0);

    switch (preset) {
        case 'today':
            start = new Date(now);
            end = new Date(now);
            end.setHours(23, 59, 59, 999);
            break;
        case 'this_week':
            start = new Date(now);
            const day = start.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            start.setDate(start.getDate() + diffToMonday);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            break;
        case 'this_month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case 'this_year':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
            end.setHours(23, 59, 59, 999);
            break;
        case 'all':
            return { startDate: null, endDate: null };
        default:
            return { startDate: null, endDate: null };
    }
    return { startDate: start, endDate: end };
};


export function VentasPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const [ventas, setVentas] = useState([]);
    const [datePreset, setDatePreset] = useState('this_month');
    const [filters, setFilters] = useState(() => {
        const { startDate, endDate } = getDatesFromPreset('this_month');
        const toISODateString = (d) => d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split("T")[0] : '';
        return {
            ...initialFilters,
            startDate: toISODateString(startDate),
            endDate: toISODateString(endDate)
        };
    });
    const [filterOptions, setFilterOptions] = useState({ clients: [], users: [], branches: [] });
    const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
    
    const [downloadingId, setDownloadingId] = useState(null);
    const [receiptData, setReceiptData] = useState(null);
    const receiptRef = useRef(null);

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
            const [salesRes, optionsRes] = await Promise.all([
                supabase.rpc('get_company_sales'),
                supabase.rpc('get_sales_filter_data')
            ]);
            
            if (salesRes.error) throw salesRes.error;
            if (optionsRes.error) throw optionsRes.error;
            
            setVentas(salesRes.data);
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

    const handleDatePresetChange = (preset) => {
        setDatePreset(preset);
        const toISODateString = (d) => d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split("T")[0] : '';
        if (preset !== 'custom') {
            const { startDate, endDate } = getDatesFromPreset(preset);
            setFilters(prev => ({ 
                ...prev, 
                startDate: toISODateString(startDate), 
                endDate: toISODateString(endDate)
            }));
        }
    };
    
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleClearFilters = () => {
        const { startDate, endDate } = getDatesFromPreset('this_month');
        const toISODateString = (d) => d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split("T")[0] : '';
        setFilters({
            ...initialFilters,
            startDate: toISODateString(startDate),
            endDate: toISODateString(endDate),
        });
        setDatePreset('this_month');
        setIsAdvancedSearchOpen(false);
    };
    
    const handleDownloadReceipt = async (venta) => {
        if (downloadingId) return;
        setDownloadingId(venta.id);
        try {
            const { data, error } = await supabase.rpc('get_sale_details', { p_venta_id: venta.id });
            if (error) throw error;
            setReceiptData(data); // Set data to render the hidden component
        } catch (err) {
            addToast({ message: `Error al generar recibo: ${err.message}`, type: 'error' });
            setDownloadingId(null);
        }
    };

    useEffect(() => {
        if (receiptData && receiptRef.current) {
            generatePdfFromComponent(receiptRef.current, `NotaVenta-${receiptData.folio}.pdf`, 'a4')
                .then(() => {
                    addToast({ message: 'Descarga iniciada.', type: 'success' });
                })
                .catch((err) => {
                    addToast({ message: `Error en PDF: ${err.message}`, type: 'error' });
                })
                .finally(() => {
                    setReceiptData(null);
                    setDownloadingId(null);
                });
        }
    }, [receiptData]);

    const filteredVentas = useMemo(() => {
        let { startDate, endDate } = getDatesFromPreset(datePreset);
        if (datePreset === 'custom') {
            startDate = filters.startDate ? new Date(filters.startDate.replace(/-/g, '/')) : null;
            if(startDate) startDate.setHours(0,0,0,0);
            endDate = filters.endDate ? new Date(filters.endDate.replace(/-/g, '/')) : null;
            if(endDate) endDate.setHours(23,59,59,999);
        }

        return ventas.filter(venta => {
            const ventaDate = new Date(venta.fecha);
            
            if (startDate && ventaDate < startDate) return false;
            if (endDate && ventaDate > endDate) return false;
            if (filters.status !== 'all' && venta.estado_pago !== filters.status) return false;
            if (filters.type !== 'all' && venta.tipo_venta !== filters.type) return false;
            if (filters.cliente_id !== 'all' && venta.cliente_id !== filters.cliente_id) return false;
            if (filters.vendedor_ids.length > 0 && !filters.vendedor_ids.includes(venta.usuario_id)) return false;
            if (user.role === 'Propietario' && filters.sucursal_ids.length > 0 && !filters.sucursal_ids.includes(venta.sucursal_id)) return false;
            if (filters.metodos_pago.length > 0 && !filters.metodos_pago.includes(venta.metodo_pago)) return false;
            if (filters.estado_vencimiento !== 'all' && venta.estado_vencimiento !== filters.estado_vencimiento) return false;
            
            return true;
        });
    }, [ventas, filters, datePreset, user.role]);


    const kpis = useMemo(() => {
        const totalFiltrado = filteredVentas.reduce((sum, v) => sum + Number(v.total || 0), 0);
        
        const cuentasPorCobrarVentas = filteredVentas.filter(v => v.estado_pago !== 'Pagada');
        const cuentasPorCobrar = cuentasPorCobrarVentas.reduce((sum, v) => sum + Number(v.saldo_pendiente || 0), 0);
        const cuentasPorCobrarCount = cuentasPorCobrarVentas.length;
        
        const ventasCredito = filteredVentas.filter(v => v.tipo_venta === 'Crédito');
        const ventasCreditoCount = ventasCredito.length;
        const totalVentasCredito = ventasCredito.reduce((sum, v) => sum + Number(v.total || 0), 0);

        const totalImpuestos = filteredVentas.reduce((sum, v) => sum + Number(v.impuestos || 0), 0);
        const ventasConImpuestosCount = filteredVentas.filter(v => Number(v.impuestos || 0) > 0).length;
        
        return { 
            totalFiltrado,
            cuentasPorCobrar, 
            cuentasPorCobrarCount,
            ventasCreditoCount, 
            totalVentasCredito,
            totalImpuestos, 
            ventasConImpuestosCount,
        };
    }, [filteredVentas]);

    const breadcrumbs = [ { name: 'Ventas', href: '#/ventas' } ];

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
    
    const VencimientoPill = ({ estado, dias }) => {
        if (!estado || estado === 'Pagada' || estado === 'N/A') return null;

        const diasAbs = Math.abs(dias);
        const diaText = diasAbs === 1 ? 'día' : 'días';

        if (estado === 'Vencida') {
            return html`<span class="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full ml-2">Vencida hace ${diasAbs} ${diaText}</span>`;
        }
        if (estado === 'Al día') {
            if (dias === 0) return html`<span class="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full ml-2">Vence Hoy</span>`;
            return html`<span class="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full ml-2">Vence en ${diasAbs} ${diaText}</span>`;
        }
        return null;
    };
    
    const VentasList = ({ ventas }) => {
        const handleRowClick = (venta) => navigate(`/ventas/${venta.id}`);
        
        if (ventas.length === 0) {
            return html`<div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white mt-6"><div class="text-6xl text-gray-300">${ICONS.sales}</div><h3 class="mt-2 text-lg font-medium text-gray-900">No se encontraron ventas</h3><p class="mt-1 text-sm text-gray-500">Intenta ajustar los filtros o realiza tu primera venta.</p></div>`;
        }
        
        return html`
            <div class="space-y-4 md:hidden mt-6">
                ${ventas.map(v => html`
                    <div key=${v.id} class="bg-white p-4 rounded-lg shadow border">
                        <div onClick=${() => handleRowClick(v)} class="cursor-pointer">
                            <div class="flex justify-between items-start">
                                <div class="min-w-0">
                                    <div class="font-bold text-gray-800 truncate">${v.cliente_nombre || 'Consumidor Final'}</div>
                                    <div class="text-sm text-gray-600">Folio: ${v.folio}</div>
                                </div>
                                <div class="flex flex-col items-end gap-1">
                                    <span class=${getStatusPill(v.estado_pago)}>${v.estado_pago}</span>
                                    <${VencimientoPill} estado=${v.estado_vencimiento} dias=${v.dias_diferencia} />
                                </div>
                            </div>
                            <div class="flex justify-between items-end mt-2">
                                <div class="text-sm">
                                    <p class="text-gray-500">${new Date(v.fecha).toLocaleDateString()}</p>
                                    <p class="text-lg font-bold text-primary">${formatCurrency(v.total)}</p>
                                </div>
                                <span class="text-xs text-primary font-semibold">Ver Detalles ${ICONS.chevron_right}</span>
                            </div>
                        </div>
                        <div class="mt-3 pt-3 border-t">
                            <button onClick=${(e) => { e.stopPropagation(); handleDownloadReceipt(v); }} disabled=${downloadingId === v.id} class="w-full flex items-center justify-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50">
                                ${downloadingId === v.id ? html`<${Spinner} size="h-4 w-4" color="text-gray-500" />` : ICONS.download}
                                Descargar Nota (PDF)
                            </button>
                        </div>
                    </div>
                `)}
            </div>
            <div class="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg mt-0">
                <table class="min-w-full divide-y divide-gray-300">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Folio</th>
                            <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Cliente</th>
                            <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha</th>
                            <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Total</th>
                            <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado Pago</th>
                            <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Vencimiento</th>
                            <th class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Acciones</span></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white">
                        ${ventas.map(v => html`
                            <tr key=${v.id} onClick=${() => handleRowClick(v)} class="hover:bg-gray-50 cursor-pointer">
                                <td class="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">${v.folio}</td>
                                <td class="px-3 py-4 text-sm text-gray-500 truncate">${v.cliente_nombre || 'Consumidor Final'}</td>
                                <td class="px-3 py-4 text-sm text-gray-500">${new Date(v.fecha).toLocaleDateString()}</td>
                                <td class="px-3 py-4 text-sm font-semibold text-primary">${formatCurrency(v.total)}</td>
                                <td class="px-3 py-4 text-sm"><span class=${getStatusPill(v.estado_pago)}>${v.estado_pago}</span></td>
                                <td class="px-3 py-4 text-sm"><${VencimientoPill} estado=${v.estado_vencimiento} dias=${v.dias_diferencia} /></td>
                                 <td class="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                    <button onClick=${(e) => { e.stopPropagation(); handleDownloadReceipt(v); }} disabled=${downloadingId === v.id} class="p-2 rounded-full text-gray-400 hover:text-primary hover:bg-gray-100 disabled:opacity-50" title="Descargar Nota de Venta (PDF)">
                                        ${downloadingId === v.id ? html`<${Spinner} size="h-5 w-5" color="text-primary" />` : ICONS.download}
                                    </button>
                                </td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        `;
    };

    return html`
        <${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} activeLink="Ventas" breadcrumbs=${breadcrumbs} companyInfo=${companyInfo} notifications=${notifications}>
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><h1 class="text-2xl font-semibold text-gray-900">Historial de Ventas</h1></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
                 <${KPI_Card} 
                    title="Total Vendido" 
                    value=${formatCurrency(kpis.totalFiltrado)} 
                    icon=${ICONS.sales} 
                    color="primary"
                    count=${filteredVentas.length}
                    countLabel="Total de ventas"
                />
                 <${KPI_Card} 
                    title="Total Impuestos" 
                    value=${formatCurrency(kpis.totalImpuestos)} 
                    icon=${ICONS.newExpense} 
                    color="green"
                    count=${kpis.ventasConImpuestosCount}
                    countLabel="Ventas con impuesto"
                />
                 <${KPI_Card} 
                    title="Cuentas por Cobrar" 
                    value=${formatCurrency(kpis.cuentasPorCobrar)} 
                    icon=${ICONS.credit_score} 
                    color="amber"
                    count=${kpis.cuentasPorCobrarCount}
                    countLabel="Ventas por cobrar"
                />
                 <${KPI_Card} 
                    title="Ventas a Crédito" 
                    value=${formatCurrency(kpis.totalVentasCredito)}
                    icon=${ICONS.newSale} 
                    color="primary"
                    count=${kpis.ventasCreditoCount}
                    countLabel="Cantidad de ventas a crédito"
                 />
            </div>
            <div class="mt-8">
                 <${FilterBar} datePreset=${datePreset} onDatePresetChange=${handleDatePresetChange} filters=${filters} onFilterChange=${handleFilterChange} onClear=${handleClearFilters} onToggleAdvanced=${() => setIsAdvancedSearchOpen(prev => !prev)} isAdvancedOpen=${isAdvancedSearchOpen} />
                 <${AdvancedFilterPanel} isOpen=${isAdvancedSearchOpen} filters=${filters} onFilterChange=${handleFilterChange} filterOptions=${filterOptions} user=${user} />
                 <div class="mt-6 md:mt-0">
                    <${VentasList} ventas=${filteredVentas} />
                 </div>
            </div>
             ${receiptData && html`
                <div style="position: fixed; left: -9999px; top: 0;">
                    <${NotaVentaTemplate} ref=${receiptRef} saleDetails=${receiptData} companyInfo=${companyInfo} />
                </div>
             `}
        <//>
    `;
}