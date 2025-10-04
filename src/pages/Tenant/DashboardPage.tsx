/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useLoading } from '../../hooks/useLoading.js';
import { useToast } from '../../hooks/useToast.js';
import { useRealtimeListener } from '../../hooks/useRealtime.js';
import { BarChart } from '../../components/charts/BarChart.js';
import { ComparativeBarChart } from '../../components/charts/ComparativeBarChart.js';
import { FormInput } from '../../components/FormComponents.js';
import { Avatar } from '../../components/Avatar.js';

const KPICard = ({ title, value, change, icon, iconBgColor, count, countLabel }) => {
    const isUp = change >= 0;
    const changeColor = isUp ? 'text-green-600' : 'text-red-600';

    return html`
        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200/80 relative">
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
    <div class=${`bg-white p-6 rounded-lg shadow-md border ${className}`}>
        <div class="flex items-center mb-4">
            <div class="p-2 bg-primary-light rounded-full mr-4 text-primary">${icon}</div>
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
    };
    return html`<div class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500">${icons[type] || ICONS.bolt}</div>`;
};

const DashboardSkeleton = () => {
    const SkeletonBox = ({ className }) => html`<div class="bg-gray-200 rounded-md animate-pulse-opacity ${className}"></div>`;
    return html`
        <div>
            <div class="flex justify-between items-center mb-6">
                <${SkeletonBox} className="h-8 w-64" />
                <div class="flex gap-2">
                    <${SkeletonBox} className="h-10 w-48" />
                    <${SkeletonBox} className="h-10 w-48" />
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
    const [datePreset, setDatePreset] = useState('7d');

    const getDatesFromPreset = (preset) => {
        const end = new Date();
        const start = new Date();
        switch (preset) {
            case 'today':
                break;
            case '7d':
                start.setDate(end.getDate() - 6);
                break;
            case '30d':
                start.setDate(end.getDate() - 29);
                break;
            default:
                return { startDate: null, endDate: null };
        }
        return {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0]
        };
    };

    const [filters, setFilters] = useState(() => {
        const { startDate, endDate } = getDatesFromPreset('7d');
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
        if (!filters.startDate || !filters.endDate) return;
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_dashboard_data', {
                p_start_date: filters.startDate,
                p_end_date: filters.endDate,
                p_sucursal_id: filters.sucursalId
            });

            if (error) throw error;
            setData(data);
        } catch (err) {
            console.error("Error fetching dashboard data:", err);
            addToast({ message: `Error al cargar el dashboard: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    }, [filters.startDate, filters.endDate, filters.sucursalId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useRealtimeListener(fetchData);

    const formatCurrency = (value) => `Bs ${Number(value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

    const { kpis, low_stock_products, recent_activity, chart_data, comparative_chart_data, all_branches, top_selling_products, top_customers } = data;
    const showComparativeChart = user.role === 'Propietario' && !filters.sucursalId;

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
                        <button onClick=${() => handleDatePresetChange('7d')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === '7d' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>7d</button>
                        <button onClick=${() => handleDatePresetChange('30d')} class=${`px-3 py-1 text-sm font-medium rounded transition-colors ${datePreset === '30d' ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}>30d</button>
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
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <${KPICard} title="Ventas" value=${formatCurrency(kpis.total_sales)} change=${kpis.sales_change_percentage} icon=${ICONS.sales} iconBgColor="bg-blue-100 text-blue-600" count=${kpis.total_sales_count} countLabel="Cantidad de Ventas" />
                <${KPICard} title="Ganancia Bruta" value=${formatCurrency(kpis.gross_profit)} change=${kpis.profit_change_percentage} icon=${ICONS.dollar} iconBgColor="bg-emerald-100 text-emerald-600" />
                <${KPICard} title="Compras" value=${formatCurrency(kpis.total_purchases)} change=${null} icon=${ICONS.purchases} iconBgColor="bg-amber-100 text-amber-600" count=${kpis.total_purchases_count} countLabel="Cantidad de Compras" />
                <${KPICard} title="Total Impuestos" value=${formatCurrency(kpis.total_impuestos)} change=${null} icon=${ICONS.newExpense} iconBgColor="bg-cyan-100 text-cyan-600" count=${kpis.tax_sales_count} countLabel="Ventas con Impuesto" />
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <div class="lg:col-span-2 space-y-6">
                    ${showComparativeChart ? html`
                        <${DashboardWidget} title="Ventas y Ganancias por Sucursal" icon=${ICONS.storefront}>
                            <${ComparativeBarChart} 
                                data=${comparative_chart_data}
                                keys=${[
                                    { key: 'sales', label: 'Ventas' },
                                    { key: 'profit', label: 'Ganancia' }
                                ]}
                            />
                        <//>
                    ` : html`
                         <${DashboardWidget} title="Tendencia de Ventas" icon=${ICONS.chart}>
                            <${BarChart} data=${chart_data} />
                        <//>
                    `}
                    
                    <${DashboardWidget} title="Productos Más Vendidos" icon=${ICONS.local_offer}>
                        ${top_selling_products && top_selling_products.length > 0 ? html`
                            <ul class="space-y-3">
                                ${top_selling_products.map(p => html`
                                    <li class="flex justify-between items-center text-sm">
                                        <a href=${`#/productos/${p.id}`} onClick=${(e) => { e.preventDefault(); navigate(`/productos/${p.id}`);}} class="text-gray-700 hover:text-primary hover:underline truncate" title=${p.nombre}>${p.nombre}</a>
                                        <span class="font-semibold text-gray-800">${formatCurrency(p.total_vendido)}</span>
                                    </li>
                                `)}
                            </ul>
                        ` : html`<p class="text-sm text-gray-500 text-center py-4">No hay datos de ventas de productos en este período.</p>`}
                    <//>
                </div>
                <div class="space-y-6">
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
                                    <div class="flex-1">
                                        <p class="text-sm text-gray-800">${act.description}</p>
                                        <p class="text-xs text-gray-500">${new Date(act.timestamp).toLocaleString()}</p>
                                    </div>
                                    ${act.amount && html`<p class="text-sm font-semibold text-gray-800">${formatCurrency(act.amount)}</p>`}
                                </li>
                             `) : html`<p class="text-sm text-gray-500 text-center py-4">No hay actividad reciente.</p>`}
                        </ul>
                    <//>
                    <${DashboardWidget} title="Productos con Bajo Stock" icon=${ICONS.inventory}>
                         ${low_stock_products && low_stock_products.length > 0 ? html`
                            <ul class="space-y-3">
                                ${low_stock_products.map(p => html`
                                    <li class="flex justify-between items-center text-sm">
                                        <a href=${`#/productos/${p.id}`} onClick=${(e) => { e.preventDefault(); navigate(`/productos/${p.id}`);}} class="text-gray-700 hover:text-primary hover:underline truncate" title=${p.nombre}>${p.nombre}</a>
                                        <span class="font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full text-xs">${p.cantidad}</span>
                                    </li>
                                `)}
                            </ul>
                        ` : html`<p class="text-sm text-gray-500 text-center py-4">No hay productos con bajo stock.</p>`}
                    <//>
                </div>
            </div>
        <//>
    `;
}