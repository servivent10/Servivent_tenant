

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { FloatingActionButton } from '../../components/FloatingActionButton.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { supabase } from '../../lib/supabaseClient.js';


export function ComprasPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const [compras, setCompras] = useState([]);
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    
    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_company_purchases');
            if (error) throw error;
            setCompras(data);
        } catch (err) {
            addToast({ message: `Error al cargar compras: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const kpis = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        let totalMes = 0;
        let cuentasPorPagar = 0;
        let comprasCredito = 0;

        compras.forEach(c => {
            const fechaCompra = new Date(c.fecha);
            if (fechaCompra >= startOfMonth) {
                totalMes += Number(c.total_bob || 0);
            }
            if (c.estado_pago !== 'Pagada') {
                cuentasPorPagar += Number(c.saldo_pendiente || 0);
            }
            if (c.tipo_pago === 'Crédito') {
                comprasCredito++;
            }
        });
        
        return { totalMes, cuentasPorPagar, comprasCredito };
    }, [compras]);

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
        
        return html`
            <div class="space-y-4 md:hidden">
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
                                <p class="text-gray-500">${new Date(c.fecha).toLocaleDateString()}</p>
                                <p class="text-lg font-bold text-gray-900">${Number(c.total).toFixed(2)} <span class="text-xs font-normal">${c.moneda}</span></p>
                            </div>
                            <span class="text-xs text-primary font-semibold">Ver Detalles ${ICONS.chevron_right}</span>
                        </div>
                    </div>
                `)}
            </div>

            <div class="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                <table class="min-w-full divide-y divide-gray-300">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Folio</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Proveedor</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Total</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white">
                        ${compras.map(c => html`
                            <tr key=${c.id} onClick=${() => handleRowClick(c)} class="hover:bg-gray-50 cursor-pointer">
                                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">${c.folio}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${c.proveedor_nombre}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${new Date(c.fecha).toLocaleDateString()}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-800">${Number(c.total).toFixed(2)} <span class="text-xs font-normal text-gray-500">${c.moneda}</span></td>
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
                 <${KPI_Card} title="Total Comprado (Mes)" value=${`Bs ${kpis.totalMes.toFixed(2)}`} icon=${ICONS.shopping_cart} color="primary" />
                 <${KPI_Card} title="Cuentas por Pagar" value=${`Bs ${kpis.cuentasPorPagar.toFixed(2)}`} icon=${ICONS.credit_score} color="amber" />
                 <${KPI_Card} title="Compras a Crédito" value=${kpis.comprasCredito} icon=${ICONS.newExpense} color="green" />
            </div>

            <div class="mt-8">
                <${ComprasList} compras=${compras} />
            </div>

            <div class="sm:hidden">
                <${FloatingActionButton} onClick=${() => navigate('/compras/nueva')} label="Registrar Nueva Compra" />
            </div>
        <//>
    `;
}