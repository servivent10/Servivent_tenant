/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useLoading } from '../../hooks/useLoading.js';
import { useToast } from '../../hooks/useToast.js';
import { useRealtimeListener } from '../../hooks/useRealtime.js';
import { ComparativeBarChart } from '../../components/charts/ComparativeBarChart.js';
import { HorizontalBarChart } from '../../components/charts/HorizontalBarChart.js';
import { FormInput } from '../../components/FormComponents.js';
import { Avatar } from '../../components/Avatar.js';

const KPICard = ({ title, value, change, icon, iconBgColor, count, countLabel }) => {
    const isUp = change >= 0;
    const changeColor = isUp ? 'text-green-600' : 'text-red-600';

    return html`
        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200/80 relative transition-all hover:shadow-md hover:-translate-y-1">
            ${(count !== null && count !== undefined) && html`
                <span title=${countLabel} class="absolute top-3 right-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                  ${count}
                </span>
            `}
            <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-500 truncate">${title}</p>
                    <div class="mt-1">
                        <p class="text-3xl font-bold text-gray-900">${value}</p>
                    </div>
                </div>
                <div class="flex-shrink-0 ml-2">
                    <div class="flex items-center justify-center h-12 w-12 rounded-lg ${iconBgColor}">
                        ${icon}
                    </div>
                </div>
            </div>
            ${change !== null && change !== undefined && html`
                <div class="mt-2 flex items-center text-sm ${changeColor}">
                    ${isUp ? ICONS.chevron_up : ICONS.chevron_down}
                    <span class="font-semibold">${Math.abs(change)}%</span>
                    <span class="ml-1 text-gray-500">vs período anterior</span>
                </div>
            `}
        </div>
    `;
};

const DashboardWidget = ({ title, icon, children, className = '' }) => html`
    <div class=${`bg-white p-6 rounded-xl shadow-sm border border-gray-200/80 ${className}`}>
        <div class="flex items-center mb-4">
            <div class="p-2 bg-primary-light rounded-full mr-3 text-primary">${icon}</div>
            <h3 class="text-lg font-semibold text-gray-800">${title}</h3>
        </div>
        <div>
            ${children}
        </div>
    </div>
`;

const ActivityIcon = ({ type }) => {
    const icons = {
        venta: ICONS.shopping_cart,
        compra: ICONS.purchases,
        producto: ICONS.package_2,
        cliente: ICONS.person_add,
        gasto: ICONS.expenses,
        traspaso: ICONS.transfers,
    };
    return html`<div class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500">${icons[type] || ICONS.bolt}</div>`;
};

const TraspasoStatusPill = ({ status }) => {
    if (!status) return null;
    const baseClasses = 'ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
    let pillClass;
    switch (status) {
        case 'En Camino':
            pillClass = 'bg-amber-100 text-amber-800';
            break;
        case 'Recibido':
            pillClass = 'bg-green-100 text-green-800';
            break;
        default:
            pillClass = 'bg-gray-100 text-gray-800';
            break;
    }
    return html`<span class="${baseClasses} ${pillClass}">${status}</span>`;
};

const DashboardSkeleton = () => {
    const SkeletonBox = ({ className }) => html`<div class="bg-gray-200 rounded-lg animate-pulse-opacity ${className}"></div>`;
    return html`
        <div>
            <div class="flex justify-between items-center mb-6">
                <${SkeletonBox} className="h-8 w-64" />
                <div class="flex gap-2">
                    <${SkeletonBox} className="h-10 w-48" />
                    <${SkeletonBox} className="h-10 w-48" />
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                ${[...Array(6)].map(() => html`<${SkeletonBox} className="h-32" />`)}
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <div class="lg:col-span-2 space-y-6">
                    <${SkeletonBox} className="h-80" />
                    <${SkeletonBox} className="h-64" />
                </div>
                <div class="space-y-6">
                    <${SkeletonBox} className="h-64" />
                    <${SkeletonBox} className="h-64" />
                </div>
            </div>
        </div>
    `;
};


export function DashboardPage({ user, onLogout, onProfileUpdate, companyInfo, notifications, navigate }) {
    const { startLoading, stopLoading } = useLoading();
    const { addToast } = useToast();
    const [data, setData] = useState(null);
    const [datePreset, setDatePreset] = useState('this_week');

    const formatCurrency = (value) => {
        const number = Number(value || 0);
        const formattedNumber = number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${companyInfo.monedaSimbolo} ${formattedNumber}`;
    };

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

        return {
            startDate: toISODateString(start),
            endDate: toISODateString(end)
        };
    };

    const [filters, setFilters] = useState(() => {
        const { startDate, endDate } = getDatesFromPreset('this_week');
        return {
            startDate,
            endDate,
            sucursalId: user.role === 'Propietario' ? null : user.sucursal_id
        };
    });

    const handleDatePresetChange = (preset) => {
        setDatePreset(preset);
        if (preset !== 'custom') {
            const { startDate, endDate } = getDatesFromPreset(preset);
            setFilters(prev => ({ ...prev, startDate, endDate }));
        }
    };

    const handleCustomDateChange = (e) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const fetchData = useCallback(async () => {
        if (!filters.startDate || !filters.endDate || !companyInfo.timezone) return;
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_dashboard_data', {
                p_start_date: filters.startDate,
                p_end_date: filters.endDate,
                p_sucursal_id: filters.sucursalId,
                p_timezone: companyInfo.timezone
            });

            if (error) throw error;
            setData(data);
        } catch (err) {
            console.error("Error fetching dashboard data:", err);
            addToast({ message: `Error al cargar el dashboard: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    }, [filters.startDate, filters.endDate, filters.sucursalId, companyInfo.timezone]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useRealtimeListener(fetchData);

    const breadcrumbs = [{ name: 'Dashboard', href: '#/dashboard' }];
    
    if (!data) {
        return html`
         <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Dashboard"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <${DashboardSkeleton} />
        <//>
        `;
    }

    const { kpis, low_stock_products, recent_activity, chart_data, top_selling_products, top_customers, all_branches } = data;
    const isAllBranchesView = user.role === 'Propietario' && !filters.sucursalId;

    const gananciaNeta = (kpis.gross_profit || 0) - (kpis.total_gastos || 0);

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Dashboard"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 class="text-2xl font-semibold text-gray-900">Dashboard Inteligente</h1>
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <div class="flex items-center bg-white border rounded-md shadow-sm p-1">
                        <button onClick=${() => handleDatePresetChange('today')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'today' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Hoy</button>
                        <button onClick=${() => handleDatePresetChange('this_week')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_week' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Semana</button>
                        <button onClick=${() => handleDatePresetChange('this_month')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_month' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Mes</button>
                        <button onClick=${() => handleDatePresetChange('this_year')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'this_year' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>Año</button>
                        <button onClick=${() => handleDatePresetChange('custom')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === 'custom' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`} title="Rango personalizado">${ICONS.calendar_month}</button>
                    </div>
                    ${user.role === 'Propietario' && html`
                        <select 
                            value=${filters.sucursalId || 'all'}
                            onChange=${(e) => setFilters(prev => ({ ...prev, sucursalId: e.target.value === 'all' ? null : e.target.value }))}
                            class="rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        >
                            <option value="all">Todas las Sucursales</option>
                            ${all_branches.map(branch => html`<option value=${branch.id}>${branch.nombre}</option>`)}
                        </select>
                    `}
                </div>
            </div>
            
            ${datePreset === 'custom' && html`
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border animate-fade-in-down">
                    <${FormInput} label="Fecha Desde" name="startDate" type="date" value=${filters.startDate} onInput=${handleCustomDateChange} required=${false} />
                    <${FormInput} label="Fecha Hasta" name="endDate" type="date" value=${filters.endDate} onInput=${handleCustomDateChange} required=${false} />
                </div>
            `}
            
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <${KPICard} title="Ventas" value=${formatCurrency(kpis.total_sales)} change=${kpis.sales_change_percentage} icon=${ICONS.sales} iconBgColor="bg-blue-100 text-blue-600" count=${kpis.total_sales_count} countLabel="Cantidad de Ventas" />
                <${KPICard} title="Ganancia Bruta" value=${formatCurrency(kpis.gross_profit)} change=${kpis.profit_change_percentage} icon=${ICONS.dollar} iconBgColor="bg-emerald-100 text-emerald-600" />
                <${KPICard} title="Total Descuentos" value=${formatCurrency(kpis.total_discounts)} change=${null} icon=${ICONS.local_offer} iconBgColor="bg-rose-100 text-rose-600" count=${kpis.discount_sales_count} countLabel="Ventas con Descuento" />
                <${KPICard} title="Compras" value=${formatCurrency(kpis.total_purchases)} change=${null} icon=${ICONS.purchases} iconBgColor="bg-amber-100 text-amber-600" count=${kpis.total_purchases_count} countLabel="Cantidad de Compras" />
                <${KPICard} title="Total Gastos" value=${formatCurrency(kpis.total_gastos)} change=${null} icon=${ICONS.expenses} iconBgColor="bg-orange-100 text-orange-600" count=${kpis.total_gastos_count} countLabel="Cantidad de Gastos" />

                <div class="bg-white p-5 rounded-xl shadow-sm border-2 border-primary relative transition-all hover:shadow-md hover:-translate-y-1">
                    <div class="flex items-start justify-between">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-gray-500 truncate">Ganancia NETA</p>
                            <div class="mt-1">
                                <p class="text-3xl font-bold text-primary">${formatCurrency(gananciaNeta)}</p>
                            </div>
                        </div>
                        <div class="flex-shrink-0 ml-2">
                            <div class="flex items-center justify-center h-12 w-12 rounded-lg bg-primary-light text-primary">
                                ${ICONS.emoji_events}
                            </div>
                        </div>
                    </div>
                    <div class="mt-2 text-sm text-gray-500">
                        (Ganancia Bruta - Gastos)
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <div class="lg:col-span-2 space-y-6">
                     <${DashboardWidget} title=${isAllBranchesView ? "Ventas y Ganancias por Sucursal" : "Tendencia de Ventas y Ganancias"} icon=${isAllBranchesView ? ICONS.storefront : ICONS.chart}>
                        <${ComparativeBarChart} 
                            data=${chart_data}
                            keys=${[
                                { key: 'sales', label: 'Ventas' },
                                { key: 'profit', label: 'Ganancia' }
                            ]}
                            currencySymbol=${companyInfo.monedaSimbolo}
                        />
                    <//>
                    
                    <${DashboardWidget} title="Productos Más Vendidos" icon=${ICONS.local_offer}>
                        <${HorizontalBarChart} data=${top_selling_products} currencySymbol=${companyInfo.monedaSimbolo} />
                    <//>
                </div>
                <div class="space-y-6">
                    <${DashboardWidget} title="Productos con Bajo Stock" icon=${ICONS.inventory}>
                         ${low_stock_products && low_stock_products.length > 0 ? html`
                            <ul class="space-y-3 max-h-56 overflow-y-auto">
                                ${low_stock_products.map(p => html`
                                    <li class="flex justify-between items-center text-sm">
                                        <a href=${`#/productos/${p.id}`} onClick=${(e) => { e.preventDefault(); navigate(`/productos/${p.id}`);}} class="text-gray-700 hover:text-primary hover:underline truncate" title=${p.nombre}>${p.nombre}</a>
                                        <span class="font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full text-xs">${p.cantidad}</span>
                                    </li>
                                `)}
                            </ul>
                        ` : html`<p class="text-sm text-gray-500 text-center py-4">No hay productos con bajo stock.</p>`}
                    <//>
                    <${DashboardWidget} title="Ranking de Clientes" icon=${ICONS.emoji_events}>
                         ${top_customers && top_customers.length > 0 ? html`
                            <ul class="space-y-4">
                                ${top_customers.map(c => html`
                                    <li class="flex items-center gap-3">
                                        <${Avatar} name=${c.nombre} avatarUrl=${c.avatar_url} size="h-10 w-10" />
                                        <div class="flex-1 min-w-0">
                                            <p class="font-medium text-gray-800 truncate">${c.nombre}</p>
                                            <p class="text-sm font-semibold text-emerald-600">${formatCurrency(c.total_comprado)}</p>
                                        </div>
                                    </li>
                                `)}
                            </ul>
                        ` : html`<p class="text-sm text-gray-500 text-center py-4">No hay compras de clientes registrados en este período.</p>`}
                    <//>
                    <${DashboardWidget} title="Actividad Reciente" icon=${ICONS.activity}>
                        <ul class="space-y-4">
                             ${recent_activity && recent_activity.length > 0 ? recent_activity.map(act => html`
                                <li class="flex items-start gap-3">
                                    <${ActivityIcon} type=${act.type} />
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center">
                                            <p class="text-sm text-gray-800" dangerouslySetInnerHTML=${{__html: act.description}}></p>
                                            ${act.type === 'traspaso' && html`<${TraspasoStatusPill} status=${act.estado} />`}
                                        </div>
                                        <p class="text-xs text-gray-500">${new Date(act.timestamp).toLocaleString()}</p>
                                    </div>
                                    ${act.amount != null && html`<p class="text-sm font-semibold text-gray-800">${formatCurrency(act.amount)}</p>`}
                                </li>
                             `) : html`<p class="text-sm text-gray-500 text-center py-4">No hay actividad reciente.</p>`}
                        </ul>
                    <//>
                </div>
            </div>
        <//>
    `;
}