/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { Tabs } from '../../components/Tabs.js';
import { PlanCard } from '../../components/PlanCard.js';
import { UPGRADE_PLANS } from '../../lib/plansConfig.js';

// Componente para renderizar la lista de pagos de forma responsiva
const PaymentHistory = ({ payments = [] }) => {
    if (payments.length === 0) {
        return html`
            <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white mt-6">
                <div class="text-6xl text-gray-300">${ICONS.credit_card}</div>
                <h3 class="mt-2 text-lg font-medium text-gray-900">Sin historial de pagos</h3>
                <p class="mt-1 text-sm text-gray-500">Aún no se han registrado pagos para esta licencia.</p>
            </div>
        `;
    }

    const totalPaid = payments.reduce((acc, p) => acc + Number(p.monto || 0), 0);

    return html`
        <div class="mt-6">
             <p class="mb-4 text-sm text-gray-600">
                Monto total registrado: <span class="font-bold text-emerald-600">Bs ${totalPaid.toFixed(2)}</span>
            </p>
            <!-- Vista de tarjetas para móvil y tablet -->
            <div class="space-y-4 sm:hidden">
                ${payments.map(payment => html`
                    <div class="bg-white p-4 rounded-lg shadow border">
                        <div class="flex justify-between items-center">
                            <div class="font-bold text-lg text-gray-800">Bs ${Number(payment.monto).toFixed(2)}</div>
                            <div class="text-xs text-gray-500">${new Date(payment.fecha_pago).toLocaleString()}</div>
                        </div>
                        <div class="text-sm text-gray-600 mt-1">Método: ${payment.metodo_pago}</div>
                        ${payment.notas && html`<p class="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">Nota: ${payment.notas}</p>`}
                    </div>
                `)}
            </div>

            <!-- Vista de tabla para escritorio -->
            <div class="hidden sm:block flow-root">
                <table class="min-w-full divide-y divide-gray-300">
                    <thead>
                        <tr>
                            <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Fecha de Pago</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Monto</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Método de Pago</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Notas</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white">
                        ${payments.map(payment => html`
                            <tr key=${payment.id}>
                                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-0">${new Date(payment.fecha_pago).toLocaleString()}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">Bs ${Number(payment.monto).toFixed(2)}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${payment.metodo_pago}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${payment.notas}</td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};


export function LicenciaPage({ user, onLogout, onProfileUpdate, companyInfo, notifications }) {
    const [activeTab, setActiveTab] = useState('plan');

    const breadcrumbs = [ { name: 'Licencia y Facturación', href: '#/licencia' } ];
    const tabs = [
        { id: 'plan', label: 'Mi Plan' },
        { id: 'pagos', label: 'Historial de Pagos' }
    ];

    const { planDetails, licenseStatus, licenseEndDate, paymentHistory } = companyInfo;
    const currentPlanName = planDetails?.title || 'N/A';
    
    const calculateDaysRemaining = () => {
        if (!licenseEndDate) return 0;
        const diff = new Date(licenseEndDate).getTime() - new Date().getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };
    const daysRemaining = calculateDaysRemaining();
    
    const getKpiColor = () => {
        if (licenseStatus !== 'Activa') return 'red';
        if (daysRemaining < 15) return 'amber';
        return 'green';
    };

    const handleSelectPlan = (plan) => {
        alert(`Funcionalidad de pago para ${plan.title} no implementada.`);
    };

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Licencia y Facturación"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <h1 class="text-2xl font-bold text-gray-900">Licencia y Facturación</h1>
            <p class="mt-1 text-sm text-gray-600">Gestiona tu suscripción, visualiza tu plan actual y revisa tu historial de pagos.</p>

            <!-- KPIs -->
            <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mt-6">
                <${KPI_Card} title="Estado de la Licencia" value=${licenseStatus} subtext=${`Plan: ${currentPlanName}`} icon=${ICONS.credit_card} color=${licenseStatus === 'Activa' ? 'green' : 'red'} />
                <${KPI_Card} title="Días Restantes" value=${daysRemaining} subtext=${licenseEndDate ? `Vence el ${new Date(licenseEndDate).toLocaleDateString()}` : ''} icon=${ICONS.chart} color=${getKpiColor()} />
                <${KPI_Card} title="Límite de Usuarios" value=${planDetails?.limits?.maxUsers === Infinity ? 'Ilimitados' : planDetails?.limits?.maxUsers} icon=${ICONS.users} />
                <${KPI_Card} title="Límite de Sucursales" value=${planDetails?.limits?.maxBranches === Infinity ? 'Ilimitados' : planDetails?.limits?.maxBranches} icon=${ICONS.building} />
            </div>

            <div class="mt-8">
                <${Tabs} tabs=${tabs} activeTab=${activeTab} onTabClick=${setActiveTab} />
            </div>
            
            <div class="mt-6">
                ${activeTab === 'plan' && html`
                    <div>
                        <h2 class="text-xl font-semibold text-gray-800">Cambiar de Plan</h2>
                        <p class="mt-1 text-sm text-gray-600">Elige el plan que mejor se adapte a las necesidades de tu negocio.</p>
                         <div class="isolate mx-auto mt-4 grid max-w-md grid-cols-1 gap-8 md:max-w-2xl lg:max-w-none lg:grid-cols-3">
                            ${UPGRADE_PLANS.map(plan => html`
                                <${PlanCard} 
                                    plan=${plan}
                                    isCurrentPlan=${plan.title === currentPlanName}
                                    onSelect=${handleSelectPlan} 
                                />
                            `)}
                        </div>
                    </div>
                `}
                ${activeTab === 'pagos' && html`
                    <${PaymentHistory} payments=${paymentHistory} />
                `}
            </div>

        <//>
    `;
}