/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { Tabs } from '../../components/Tabs.js';
import { FloatingActionButton } from '../../components/FloatingActionButton.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { FormInput } from '../../components/FormComponents.js';
import { UPGRADE_PLANS } from '../../lib/plansConfig.js';

const getCurrencySymbol = (monedaCode) => {
    const symbolMap = {
        'BOB': 'Bs', 'ARS': '$', 'BRL': 'R$', 'CLP': '$',
        'COP': '$', 'USD': '$', 'GTQ': 'Q', 'HNL': 'L',
        'MXN': '$', 'PAB': 'B/.', 'PYG': '₲', 'PEN': 'S/',
        'DOP': 'RD$', 'UYU': '$U', 'EUR': '€'
    };
    return symbolMap[monedaCode] || monedaCode;
};

// Componente para renderizar la lista de usuarios (tabla en desktop, tarjetas en móvil)
const UserList = ({ users = [], onResetPassword }) => {
    if (users.length === 0) return html`<p class="text-gray-500 mt-4">No hay usuarios registrados para esta empresa.</p>`;
    
    return html`
        <!-- Vista de tarjetas para móvil y tablet -->
        <div class="space-y-4 lg:hidden">
            ${users.map(user => html`
                <div class="bg-white p-4 rounded-lg shadow border">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-bold text-gray-800">${user.nombre_completo}</div>
                            <div class="text-sm text-gray-600">${user.correo}</div>
                        </div>
                        ${user.rol === 'Propietario' && html`
                            <button onClick=${() => onResetPassword(user)} title="Resetear contraseña" class="text-gray-400 hover:text-primary p-2 -m-2 rounded-full hover:bg-gray-100">${ICONS.key}</button>
                        `}
                    </div>
                    <div class="text-sm text-gray-500 mt-1">Rol: <span class="font-medium text-gray-700">${user.rol}</span></div>
                    <div class="text-xs text-gray-400 mt-2">Registrado: ${new Date(user.created_at).toLocaleDateString()}</div>
                </div>
            `)}
        </div>

        <!-- Vista de tabla para escritorio -->
        <div class="hidden lg:block mt-4 flow-root">
            <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:-mx-8">
                    <table class="min-w-full divide-y divide-gray-300">
                        <thead>
                            <tr>
                                <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Nombre Completo</th>
                                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Correo</th>
                                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Rol</th>
                                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha de Registro</th>
                                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0"><span class="sr-only">Acciones</span></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            ${users.map(user => html`
                                <tr key=${user.id}>
                                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">${user.nombre_completo}</td>
                                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${user.correo}</td>
                                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${user.rol}</td>
                                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${new Date(user.created_at).toLocaleDateString()}</td>
                                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                                      ${user.rol === 'Propietario' && html`
                                            <button onClick=${() => onResetPassword(user)} title="Resetear contraseña" class="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-100">${ICONS.key}</button>
                                      `}
                                    </td>
                                </tr>
                            `)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
};

// Componente para renderizar la lista de sucursales
const BranchList = ({ branches = [] }) => {
     if (branches.length === 0) return html`<p class="text-gray-500 mt-4">No hay sucursales registradas para esta empresa.</p>`;
    
    return html`
        <!-- Vista de tarjetas para móvil y tablet -->
        <div class="space-y-4 lg:hidden">
            ${branches.map(branch => html`
                <div class="bg-white p-4 rounded-lg shadow border">
                    <div class="font-bold text-gray-800">${branch.nombre}</div>
                    <div class="text-sm text-gray-600">${branch.direccion}</div>
                    <div class="text-sm text-gray-500 mt-1">Teléfono: <span class="font-medium text-gray-700">${branch.telefono || 'N/A'}</span></div>
                </div>
            `)}
        </div>

        <!-- Vista de tabla para escritorio -->
        <div class="hidden lg:block mt-4 flow-root">
             <table class="min-w-full divide-y divide-gray-300">
                <thead>
                    <tr>
                        <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Nombre</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Dirección</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Teléfono</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${branches.map(branch => html`
                        <tr key=${branch.id}>
                            <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">${branch.nombre}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${branch.direccion}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${branch.telefono}</td>
                        </tr>
                    `)}
                </tbody>
            </table>
        </div>
    `;
};

// Componente para renderizar la lista de pagos
const PaymentList = ({ payments = [], formatCurrency }) => {
    if (payments.length === 0) return html`<p class="text-gray-500 mt-4">No se han registrado pagos para esta licencia.</p>`;
    
    return html`
        <!-- Vista de tarjetas para móvil y tablet -->
        <div class="space-y-4 lg:hidden">
            ${payments.map(payment => html`
                <div class="bg-white p-4 rounded-lg shadow border">
                    <div class="flex justify-between items-center">
                        <div class="font-bold text-lg text-gray-800">${formatCurrency(payment.monto)}</div>
                        <div class="text-xs text-gray-500">${new Date(payment.fecha_pago).toLocaleString()}</div>
                    </div>
                    <div class="text-sm text-gray-600 mt-1">Método: ${payment.metodo_pago}</div>
                    ${payment.notas && html`<p class="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">Nota: ${payment.notas}</p>`}
                </div>
            `)}
        </div>

        <!-- Vista de tabla para escritorio -->
        <div class="hidden lg:block mt-4 flow-root">
            <table class="min-w-full divide-y divide-gray-300">
                <thead>
                    <tr>
                        <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Fecha de Pago</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Monto</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Método de Pago</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Notas</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${payments.map(payment => html`
                        <tr key=${payment.id}>
                            <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-0">${new Date(payment.fecha_pago).toLocaleString()}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">${formatCurrency(payment.monto)}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${payment.metodo_pago}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${payment.notas}</td>
                        </tr>
                    `)}
                </tbody>
            </table>
        </div>
    `;
};


export function CompanyDetailsPage({ companyId, user, onLogout, navigate }) {
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('usuarios');
    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    
    const today = new Date().toISOString().split('T')[0];
    const [paymentData, setPaymentData] = useState({
        planId: UPGRADE_PLANS[0].id,
        cycle: 'monthly',
        monto: UPGRADE_PLANS[0].prices.monthly.toString(),
        metodo_pago: 'Transferencia Bancaria',
        notas: '',
        fecha_vencimiento: today
    });

    const [isResetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();

    const sidebarLinks = [ { name: 'Gestionar Empresas', href: '#/superadmin', icon: ICONS.building } ];
    
    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_company_details', { p_empresa_id: companyId });

            if (error) {
                console.error('Error fetching company details:', error);
                addToast({ message: `Error al cargar detalles: ${error.message}`, type: 'error' });
                setData({ details: null }); // Set data to a state that indicates error
            } else {
                setData(data);
            }
        } catch (err) {
            console.error('Unexpected error fetching company details:', err);
            addToast({ message: `Error inesperado: ${err.message}`, type: 'error' });
            setData({ details: null });
        }
        finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, [companyId]);

    // Actualiza el monto y la fecha de vencimiento sugerida cuando cambia el plan o el ciclo
    useEffect(() => {
        const selectedPlan = UPGRADE_PLANS.find(p => p.id === paymentData.planId);
        if (!selectedPlan) return;

        const newMonto = selectedPlan.prices[paymentData.cycle] || 0;
        
        let newDate = new Date();
        if (paymentData.cycle === 'monthly') {
            newDate.setMonth(newDate.getMonth() + 1);
        } else if (paymentData.cycle === 'yearly') {
            newDate.setFullYear(newDate.getFullYear() + 1);
        } else if (paymentData.cycle === 'lifetime') {
            newDate.setFullYear(newDate.getFullYear() + 99);
        }

        setPaymentData(prev => ({
            ...prev,
            monto: newMonto.toString(),
            fecha_vencimiento: newDate.toISOString().split('T')[0]
        }));
    }, [paymentData.planId, paymentData.cycle]);

    const handlePaymentInput = (e) => {
        const { name, value } = e.target;
        setPaymentData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddPayment = async () => {
        startLoading();
        try {
            const selectedPlan = UPGRADE_PLANS.find(p => p.id === paymentData.planId);
            if (!selectedPlan) throw new Error("Plan no válido seleccionado.");

            const cycleTextMap = { monthly: 'Mensual', yearly: 'Anual', lifetime: 'Pago Único' };
            const cycleText = cycleTextMap[paymentData.cycle];
            const planTipo = cycleText ? `${selectedPlan.title} (${cycleText})` : selectedPlan.title;

            const params = {
                p_empresa_id: companyId,
                p_monto: Number(paymentData.monto),
                p_metodo_pago: paymentData.metodo_pago,
                p_notas: paymentData.notas,
                p_plan_tipo: planTipo,
                p_nueva_fecha_fin: paymentData.fecha_vencimiento
            };
            
            if (!params.p_monto || params.p_monto < 0) {
                addToast({ message: 'El monto debe ser un número válido.', type: 'error' });
                return;
            }
            if (!params.p_nueva_fecha_fin) {
                 addToast({ message: 'Debe seleccionar una fecha de vencimiento.', type: 'error' });
                return;
            }

            const { error } = await supabase.rpc('add_license_payment', params);
            if (error) throw error;

            addToast({ message: 'Pago añadido y licencia actualizada correctamente.', type: 'success' });
            setPaymentModalOpen(false);
            fetchData(); // Recargar datos
        } catch (err) {
            console.error('Error adding payment:', err);
            addToast({ message: `Error al añadir pago: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    const openResetPasswordModal = (userToReset) => {
        setSelectedUser(userToReset);
        setNewPassword('');
        setConfirmPassword('');
        setResetPasswordModalOpen(true);
    };
    
    const handleResetPassword = async () => {
        if (newPassword.length < 6) {
            addToast({ message: 'La nueva contraseña debe tener al menos 6 caracteres.', type: 'error' });
            return;
        }
        if (newPassword !== confirmPassword) {
            addToast({ message: 'Las contraseñas no coinciden.', type: 'error' });
            return;
        }
        
        startLoading();
        try {
            const { error } = await supabase.rpc('reset_owner_password_as_superadmin', {
                p_user_id: selectedUser.id,
                p_new_password: newPassword
            });
            if (error) throw error;
            
            addToast({ message: `Contraseña para ${selectedUser.correo} actualizada.`, type: 'success' });
            setResetPasswordModalOpen(false);

        } catch (err) {
            console.error('Error resetting password:', err);
            addToast({ message: `Error al resetear contraseña: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };
    
    const breadcrumbs = [
        { name: 'Empresas', href: '#/superadmin' },
        { name: data?.details?.nombre || 'Cargando...', href: `#/superadmin/empresa/${companyId}` }
    ];

    const renderContent = () => {
        if (!data) {
             // The progress bar is running. Return an empty div to prevent content jump.
             return html`<div class="py-20"></div>`;
        }
        
        if (!data.details) {
            return html`
                <div class="text-center py-10">
                    <h2 class="text-2xl font-bold text-red-600">Error al Cargar la Empresa</h2>
                    <p class="mt-2 text-gray-600">No se pudieron encontrar los detalles para la empresa solicitada. Es posible que la función <code class="bg-gray-200 p-1 rounded">get_company_details</code> no exista en la base de datos.</p>
                    <button onClick=${() => navigate('/superadmin')} class="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                        Volver a la lista
                    </button>
                </div>`;
        }

        const { details, kpis, users, branches, payments } = data;
        
        const currencySymbol = getCurrencySymbol(details.moneda);
        const formatCurrency = (value) => {
            const number = Number(value || 0);
            return `${currencySymbol} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };

        const tabs = [
            { id: 'usuarios', label: 'Usuarios' },
            { id: 'sucursales', label: 'Sucursales' },
            { id: 'pagos', label: 'Pagos de Licencia' }
        ];

        const getKpiColor = () => {
            if (kpis.license_status !== 'Activa') return 'red';
            if (kpis.days_remaining < 15) return 'amber';
            return 'green';
        }
        
        const basePlanName = kpis.license_type?.split('(')[0].trim() || '';
        const currentPlan = [...UPGRADE_PLANS, ...UPGRADE_PLANS.flatMap(p => p.id === 'trial' ? [] : [])].find(p => p.title === basePlanName);
        const planLimits = currentPlan?.limits ?? { maxUsers: '?', maxBranches: '?' };
        const maxUsersDisplay = planLimits.maxUsers === Infinity ? '∞' : planLimits.maxUsers;
        const maxBranchesDisplay = planLimits.maxBranches === Infinity ? '∞' : planLimits.maxBranches;
        
        const formattedEndDate = kpis.license_end_date 
            ? new Date(kpis.license_end_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '';

        const totalPaid = payments.reduce((acc, p) => acc + Number(p.monto), 0);
        
        return html`
            <div class="flex items-center gap-4 mb-4">
                <button onClick=${() => navigate('/superadmin')} class="p-2 rounded-full hover:bg-gray-200" aria-label="Volver a la lista de empresas">
                    ${ICONS.arrow_back}
                </button>
                 ${details.logo && html`<img src=${details.logo} alt="Logo" class="h-12 w-12 rounded-md object-contain bg-slate-100 p-1 border" />`}
                <div>
                    <h1 class="text-2xl font-bold text-gray-900">${details.nombre}</h1>
                    <p class="text-sm text-gray-500">NIT: ${details.nit}</p>
                </div>
            </div>

            <!-- Company Info Card -->
            <div class="bg-white p-6 rounded-lg shadow-sm border mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">Información de la Empresa y Sucursal Principal</h3>
                <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
                    <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500">Dirección</dt>
                        <dd class="mt-1 text-sm text-gray-900">${details.direccion || 'No especificada'}</dd>
                    </div>
                    <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500">Teléfono</dt>
                        <dd class="mt-1 text-sm text-gray-900">${details.telefono || 'No especificado'}</dd>
                    </div>
                    <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500">Propietario</dt>
                        <dd class="mt-1 text-sm text-gray-900">${details.propietario_nombre || 'No asignado'}</dd>
                        <dd class="text-xs text-gray-500">${details.propietario_email || ''}</dd>
                    </div>
                    <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500">Moneda Principal</dt>
                        <dd class="mt-1 text-sm text-gray-900">${details.moneda || 'No especificada'}</dd>
                    </div>
                    <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500">País / Zona Horaria</dt>
                        <dd class="mt-1 text-sm text-gray-900">${details.timezone?.split('/')[1]?.replace('_', ' ') || 'No especificado'}</dd>
                    </div>
                    <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500">Fecha de Registro</dt>
                        <dd class="mt-1 text-sm text-gray-900">${new Date(details.created_at).toLocaleDateString()}</dd>
                    </div>
                </dl>
            </div>

            <!-- KPIs -->
            <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <${KPI_Card} title="Usuarios Activos" value=${`${kpis.total_users} / ${maxUsersDisplay}`} icon=${ICONS.users} />
                <${KPI_Card} title="Sucursales" value=${`${kpis.total_branches} / ${maxBranchesDisplay}`} icon=${ICONS.building} />
                <${KPI_Card} title="Licencia" value=${kpis.license_status} subtext=${kpis.license_type} icon=${ICONS.credit_card} color=${kpis.license_status === 'Activa' ? 'green' : 'red'} />
                <${KPI_Card} title="Días Restantes" value=${kpis.days_remaining} subtext=${formattedEndDate ? `Vence el ${formattedEndDate}`: ''} icon=${ICONS.chart} color=${getKpiColor()} />
            </div>

            <!-- Tabs -->
            <div class="mt-8">
                <${Tabs} tabs=${tabs} activeTab=${activeTab} onTabClick=${setActiveTab} />
            </div>

            <!-- Content -->
            <div class="mt-6">
                ${activeTab === 'usuarios' && html`<${UserList} users=${users} onResetPassword=${openResetPasswordModal} />`}
                ${activeTab === 'sucursales' && html`<${BranchList} branches=${branches} />`}
                ${activeTab === 'pagos' && html`
                    <div>
                        <div class="lg:flex lg:items-center lg:justify-between mb-4">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-800">Historial de Pagos</h3>
                                <p class="mt-1 text-sm text-gray-600">
                                    Monto total registrado: <span class="font-bold text-emerald-600">${formatCurrency(totalPaid)}</span>
                                </p>
                            </div>
                            <div class="mt-3 lg:ml-4 lg:mt-0">
                                <button onClick=${() => setPaymentModalOpen(true)} class="hidden lg:flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                                    ${ICONS.add} <span>Añadir Pago</span>
                                </button>
                            </div>
                        </div>
                        <${PaymentList} payments=${payments} formatCurrency=${formatCurrency} />
                    </div>
                `}
            </div>
            
            ${activeTab === 'pagos' && html`
                <div class="lg:hidden">
                    <${FloatingActionButton} onClick=${() => setPaymentModalOpen(true)} label="Añadir Pago" />
                </div>
            `}
        `;
    };

    // Fix: Define availableCyclesForSelectedPlan in the component's scope so it's accessible by the modal.
    const selectedPlanForModal = UPGRADE_PLANS.find(p => p.id === paymentData.planId);
    const availableCyclesForSelectedPlan = selectedPlanForModal?.prices ?
        Object.keys(selectedPlanForModal.prices).filter(c => c !== 'custom') : [];

    return html`
        <${DashboardLayout} user=${user} onLogout=${onLogout} sidebarLinks=${sidebarLinks} activeLink="Gestionar Empresas" breadcrumbs=${breadcrumbs}>
            ${renderContent()}

            <${ConfirmationModal}
                isOpen=${isPaymentModalOpen}
                onClose=${() => setPaymentModalOpen(false)}
                onConfirm=${handleAddPayment}
                title="Añadir Nuevo Pago y Actualizar Licencia"
                confirmText="Guardar Pago"
                icon=${ICONS.dollar}
            >
                <div class="space-y-4 text-sm text-gray-600">
                    <div>
                        <label for="planId" class="block font-medium leading-6 text-gray-900">Plan</label>
                        <select id="planId" name="planId" value=${paymentData.planId} onInput=${handlePaymentInput} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                            ${UPGRADE_PLANS.filter(p => p.prices.custom === undefined).map(plan => html`<option value=${plan.id}>${plan.title}</option>`)}
                        </select>
                    </div>
                     <div>
                        <label for="cycle" class="block font-medium leading-6 text-gray-900">Ciclo de Facturación</label>
                        <select id="cycle" name="cycle" value=${paymentData.cycle} onInput=${handlePaymentInput} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                            ${availableCyclesForSelectedPlan.map(cycle => html`<option value=${cycle}>${{monthly: 'Mensual', yearly: 'Anual', lifetime: 'Pago Único'}[cycle]}</option>`)}
                        </select>
                    </div>
                    <${FormInput} label="Monto a Pagar (${getCurrencySymbol(data?.details?.moneda)})" name="monto" type="number" value=${paymentData.monto} onInput=${handlePaymentInput} />
                     <div>
                        <label for="fecha_vencimiento" class="block font-medium leading-6 text-gray-900">Nueva Fecha de Vencimiento</label>
                         <input id="fecha_vencimiento" name="fecha_vencimiento" type="date" value=${paymentData.fecha_vencimiento} onInput=${handlePaymentInput} class="mt-1 block w-full rounded-md border border-gray-300 p-2 bg-white text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm transition-colors duration-200" />
                    </div>
                    <div>
                        <label for="metodo_pago" class="block font-medium leading-6 text-gray-900">Método de Pago</label>
                        <select id="metodo_pago" name="metodo_pago" value=${paymentData.metodo_pago} onInput=${handlePaymentInput} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                            <option>Transferencia Bancaria</option>
                            <option>Efectivo</option>
                            <option>QR</option>
                            <option>Tarjeta de Crédito/Débito</option>
                        </select>
                    </div>
                    <${FormInput} label="Notas (Opcional)" name="notas" type="text" value=${paymentData.notas} onInput=${handlePaymentInput} required=${false} />
                </div>
            <//>
            
            <${ConfirmationModal}
                isOpen=${isResetPasswordModalOpen}
                onClose=${() => setResetPasswordModalOpen(false)}
                onConfirm=${handleResetPassword}
                title="Resetear Contraseña"
                confirmText="Establecer Nueva Contraseña"
                icon=${ICONS.key}
            >
                <div class="space-y-4">
                   <p class="text-sm text-gray-600">Estableciendo nueva contraseña para <span class="font-bold text-gray-800">${selectedUser?.correo}</span>.</p>
                   <${FormInput} label="Nueva Contraseña" name="new_password" type="password" value=${newPassword} onInput=${(e) => setNewPassword(e.target.value)} />
                   <${FormInput} label="Confirmar Nueva Contraseña" name="confirm_password" type="password" value=${confirmPassword} onInput=${(e) => setConfirmPassword(e.target.value)} />
                </div>
            <//>
        <//>
    `;
}