/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';

// --- MOCK DATA ---
const salesData = {
    today: 'Bs 1,250.00',
    week: 'Bs 8,640.50',
    month: 'Bs 32,780.00',
};
const lowStockProducts = [
    { name: 'Teclado Gamer RGB', stock: 5 },
    { name: 'Mouse Inalámbrico', stock: 8 },
    { name: 'Monitor 24" Full HD', stock: 3 },
];
const recentActivity = [
    { text: "Venta #1023 creada por Ana", time: "hace 5 minutos" },
    { text: "Producto 'Laptop Pro' añadido", time: "hace 1 hora" },
    { text: "Gasto 'Servicio de Limpieza' registrado", time: "hace 3 horas" },
    { text: "Cliente 'Juan Perez' registrado", time: "hace 5 horas" },
];
// --- END MOCK DATA ---

const DashboardWidget = ({ title, icon, children, className = '' }) => html`
    <div class=${`bg-white p-6 rounded-lg shadow-md ${className}`}>
        <div class="flex items-center mb-4">
            <div class="p-2 bg-primary-light rounded-full mr-4">
                ${icon}
            </div>
            <h3 class="text-lg font-semibold text-gray-800">${title}</h3>
        </div>
        <div>
            ${children}
        </div>
    </div>
`;


export function DashboardPage({ user, onLogout, onProfileUpdate, companyInfo, notifications }) {
    const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

    const breadcrumbs = [
        { name: 'Dashboard', href: '#/dashboard' }
    ];

    const handleDemoConfirm = () => {
        alert('Acción de demostración confirmada.');
        setIsDemoModalOpen(false);
    };

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
            <div class="flex justify-between items-center">
                <h1 class="text-2xl font-semibold text-gray-900">Dashboard de Empresa</h1>
                <button 
                    onClick=${() => setIsDemoModalOpen(true)}
                    class="rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-secondary-dark transition-colors"
                >
                    Probar Modal
                </button>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                
                <div class="lg:col-span-2 space-y-6">
                    <${DashboardWidget} title="Resumen de Ventas" icon=${ICONS.dollar}>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                            <div>
                                <p class="text-sm text-gray-500">Hoy</p>
                                <p class="text-2xl font-bold text-gray-900">${salesData.today}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Esta Semana</p>
                                <p class="text-2xl font-bold text-gray-900">${salesData.week}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Este Mes</p>
                                <p class="text-2xl font-bold text-gray-900">${salesData.month}</p>
                            </div>
                        </div>
                    <//>

                    <${DashboardWidget} title="Accesos Rápidos" icon=${ICONS.bolt}>
                         <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <button class="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-primary-light rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary">
                                ${ICONS.newSale}
                                <span class="mt-2 text-sm font-semibold text-gray-700">Nueva Venta</span>
                            </button>
                             <button class="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-primary-light rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary">
                                ${ICONS.newProduct}
                                <span class="mt-2 text-sm font-semibold text-gray-700">Añadir Producto</span>
                            </button>
                             <button class="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-primary-light rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary">
                                ${ICONS.newExpense}
                                <span class="mt-2 text-sm font-semibold text-gray-700">Registrar Gasto</span>
                            </button>
                        </div>
                    <//>
                </div>

                <div class="space-y-6">
                    <${DashboardWidget} title="Productos con Bajo Stock" icon=${ICONS.inventory}>
                        <ul class="space-y-3">
                            ${lowStockProducts.map(p => html`
                                <li class="flex justify-between items-center text-sm">
                                    <span class="text-gray-700">${p.name}</span>
                                    <span class="font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full text-xs">${p.stock}</span>
                                </li>
                            `)}
                        </ul>
                    <//>

                    <${DashboardWidget} title="Actividad Reciente" icon=${ICONS.activity}>
                        <ul class="space-y-4">
                             ${recentActivity.map(act => html`
                                <li class="flex items-start">
                                    <div class="w-1.5 h-1.5 bg-gray-300 rounded-full mt-1.5 shrink-0"></div>
                                    <div class="ml-3">
                                        <p class="text-sm text-gray-800">${act.text}</p>
                                        <p class="text-xs text-gray-500">${act.time}</p>
                                    </div>
                                </li>
                             `)}
                        </ul>
                    <//>
                </div>

            </div>

            <${ConfirmationModal}
                isOpen=${isDemoModalOpen}
                onClose=${() => setIsDemoModalOpen(false)}
                onConfirm=${handleDemoConfirm}
                title="Modal de Demostración"
                confirmText="Aceptar"
                icon=${ICONS.warning_amber}
            >
                <p class="text-sm text-gray-300">Este es un ejemplo del modal de confirmación reutilizable. Puedes personalizar el título, contenido y acciones.</p>
            <//>
        <//>
    `;
}