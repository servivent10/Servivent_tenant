/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
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
import { Spinner } from '../../components/Spinner.js';
import { WhatsAppIcon } from '../../components/WhatsAppIcon.js';

// FIX: Define a type for module data to ensure type safety.
interface ModuleInfo {
    id: string;
    nombre_visible: string;
    descripcion: string;
    precio_mensual: number | string;
    codigo_interno?: string;
    is_active?: boolean;
}

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
        <div class="hidden lg:block mt-4 overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
            <table class="min-w-full divide-y divide-gray-300">
                <thead class="bg-gray-50">
                    <tr>
                        <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Nombre Completo</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Correo</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Rol</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha de Registro</th>
                        <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Acciones</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                    ${users.map(user => html`
                        <tr key=${user.id}>
                            <td class="max-w-sm truncate py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6" title=${user.nombre_completo}>${user.nombre_completo}</td>
                            <td class="max-w-xs truncate whitespace-nowrap px-3 py-4 text-sm text-gray-500" title=${user.correo}>${user.correo}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${user.rol}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${new Date(user.created_at).toLocaleDateString()}</td>
                            <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                              ${user.rol === 'Propietario' && html`
                                    <button onClick=${() => onResetPassword(user)} title="Resetear contraseña" class="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-100">${ICONS.key}</button>
                              `}
                            </td>
                        </tr>
                    `)}
                </tbody>
            </table>
        </div>
    `;
};

const BranchList = ({ branches = [] }) => {
    if (branches.length === 0) return html`<p class="text-gray-500 mt-4">No hay sucursales registradas para esta empresa.</p>`;
    
    const GOOGLE_MAPS_API_KEY = 'AIzaSyDcOzOJnV2qJWsXeCGqBfWiORfUa4ZIBtw';

    return html`
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            ${branches.map(branch => {
                const staticMapUrl = (branch.latitud && branch.longitud)
                    ? `https://maps.googleapis.com/maps/api/staticmap?center=${branch.latitud},${branch.longitud}&zoom=15&size=400x300&markers=color:red%7C${branch.latitud},${branch.longitud}&key=${GOOGLE_MAPS_API_KEY}`
                    : null;
                const googleMapsUrl = (branch.latitud && branch.longitud)
                    ? `https://maps.google.com/?q=${branch.latitud},${branch.longitud}`
                    : null;
                
                return html`
                <div key=${branch.id} class="bg-white rounded-lg shadow-sm border overflow-hidden transition-shadow hover:shadow-md flex flex-col">
                    <div class="p-4 border-b flex items-center gap-3 bg-gray-50">
                        <div class="text-primary text-2xl">${ICONS.storefront}</div>
                        <h3 class="text-lg font-bold text-gray-800 truncate" title=${branch.nombre}>${branch.nombre}</h3>
                    </div>
                    <div class="p-4 space-y-4 flex-grow">
                        <div>
                            ${staticMapUrl ? html`
                                <a href=${googleMapsUrl} target="_blank" rel="noopener noreferrer" class="block rounded-md overflow-hidden border transition-shadow hover:shadow-lg">
                                    <img src=${staticMapUrl} alt="Mapa de ${branch.nombre}" class="w-full h-40 object-cover" />
                                </a>
                            ` : html`
                                <div class="w-full h-40 flex items-center justify-center bg-slate-100 text-slate-400 rounded-md border">
                                    <p>Ubicación no establecida</p>
                                </div>
                            `}
                        </div>
                        <div class="text-sm space-y-2">
                             <p class="flex items-start gap-2 text-gray-600">
                                <span class="text-gray-400 mt-0.5">${ICONS.storefront}</span>
                                <span class="flex-1">${branch.direccion || 'Dirección no especificada'}</span>
                             </p>
                             <p class="flex items-center gap-2 text-gray-500">
                                <span class="text-gray-400">${ICONS.phone}</span>
                                <span>${branch.telefono || 'Teléfono no especificado'}</span>
                                ${branch.telefono && html`
                                    <a href=${`https://wa.me/${branch.telefono.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" class="text-green-500 hover:text-green-600">
                                        <${WhatsAppIcon} />
                                    </a>
                                `}
                            </p>
                        </div>
                    </div>
                    <div class="bg-gray-50 px-5 py-3 border-t">
                        <div class="flex items-center justify-between text-sm">
                            <div class="flex items-center gap-2 text-gray-600">
                                ${ICONS.users}
                                <span>${branch.user_count} ${branch.user_count === 1 ? 'Usuario' : 'Usuarios'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                `
            })}
        </div>
    `;
};

// Componente para renderizar la lista de pagos
const PaymentList = ({ payments = [], formatCurrency, onEdit }) => {
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
                    <div class="mt-3 pt-3 border-t text-right">
                        <button onClick=${() => onEdit(payment)} class="text-sm font-medium text-primary hover:underline">Editar</button>
                    </div>
                </div>
            `)}
        </div>

        <!-- Vista de tabla para escritorio -->
        <div class="hidden lg:block mt-4 overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
            <table class="min-w-full divide-y divide-gray-300">
                <thead class="bg-gray-50">
                    <tr>
                        <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Fecha de Pago</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Monto</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Método de Pago</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Notas</th>
                        <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Acciones</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                    ${payments.map(payment => html`
                        <tr key=${payment.id}>
                            <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">${new Date(payment.fecha_pago).toLocaleString()}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">${formatCurrency(payment.monto)}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${payment.metodo_pago}</td>
                            <td class="max-w-sm truncate px-3 py-4 text-sm text-gray-500" title=${payment.notas}>${payment.notas}</td>
                            <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                <button onClick=${() => onEdit(payment)} title="Editar Pago" class="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                            </td>
                        </tr>
                    `)}
                </tbody>
            </table>
        </div>
    `;
};

// Componente para la nueva pestaña de Módulos
const ModulesTab = ({ companyId }) => {
    // FIX: Add type to useState for modules
    const [modules, setModules] = useState<ModuleInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    const fetchModules = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_company_modules_status', { p_empresa_id: companyId });
            if (error) throw error;
            // FIX: Cast the RPC result to ensure type safety.
            setModules((data as ModuleInfo[]) || []);
        } catch (err) {
            addToast({ message: `Error al cargar módulos: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchModules();
    }, [companyId]);

    const handleToggle = async (moduleId, isActive) => {
        try {
            const { error } = await supabase.rpc('toggle_company_module', {
                p_empresa_id: companyId,
                p_modulo_id: moduleId,
                p_is_active: isActive
            });
            if (error) throw error;
            addToast({ message: `Módulo ${isActive ? 'activado' : 'desactivado'}.`, type: 'success' });
            fetchModules(); // Refresh state
        } catch (err) {
            addToast({ message: `Error al cambiar estado del módulo: ${err.message}`, type: 'error' });
        }
    };

    if (isLoading) {
        return html`<div class="flex justify-center items-center h-48"><${Spinner} color="text-primary"/></div>`;
    }

    return html`
        <div class="mx-auto max-w-7xl">
            <h2 class="text-lg font-semibold text-gray-800">Módulos Adicionales</h2>
            <p class="mt-1 text-sm text-gray-600">Activa o desactiva funcionalidades premium para esta empresa.</p>

            <div class="mt-4 space-y-4">
                ${modules.map(mod => html`
                    <div key=${mod.id} class="bg-white p-4 rounded-lg shadow border flex justify-between items-center">
                        <div>
                            <p class="font-bold text-gray-800">${mod.nombre_visible}</p>
                            <p class="text-sm text-gray-600">${mod.descripcion}</p>
                            <p class="text-sm font-semibold text-emerald-600 mt-1">$${Number(mod.precio_mensual).toFixed(2)} / mes</p>
                        </div>
                        <div class="flex items-center">
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked=${mod.is_active} onChange=${(e) => handleToggle(mod.id, e.target.checked)} class="sr-only peer" />
                                <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                    </div>
                `)}
            </div>
        </div>
    `;
};


export function CompanyDetailsPage({ companyId, user, onLogout, navigate }) {
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('usuarios');
    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    const [availablePlans, setAvailablePlans] = useState<any[]>([]);
    // FIX: Strongly type state to avoid 'unknown' type errors.
    const [availableModules, setAvailableModules] = useState<ModuleInfo[]>([]);
    const [paymentToEdit, setPaymentToEdit] = useState(null);
    const [isLicenseModalOpen, setLicenseModalOpen] = useState(false);
    const [newEndDate, setNewEndDate] = useState('');
    // FIX: Strongly type state to avoid 'unknown' type errors.
    const [initialModuleStatus, setInitialModuleStatus] = useState<ModuleInfo[]>([]); // **FIX: New state**
    
    const today = new Date().toISOString().split('T')[0];
    
    const [paymentData, setPaymentData] = useState({
        planId: '',
        cycle: 'monthly',
        precio_plan: '',
        monto: '',
        descuento: '',
        metodo_pago: 'Transferencia Bancaria',
        notas: '',
        fecha_vencimiento: today,
        fecha_pago: new Date(new Date().toString().split('GMT')[0]+' UTC').toISOString().slice(0, 16)
    });
    // FIX: Typed the selectedModules state to resolve property access errors on 'unknown'.
    const [selectedModules, setSelectedModules] = useState<Map<string, ModuleInfo>>(new Map());


    const [isResetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();

    const sidebarLinks = [
        { name: 'Gestionar Empresas', href: '#/superadmin', icon: ICONS.building },
        { name: 'Gestión de Planes', href: '#/superadmin/planes', icon: ICONS.credit_score },
        { name: 'Gestión de Módulos', href: '#/superadmin/modulos', icon: ICONS.bolt },
        { name: 'Licencias y Pagos', href: '#', icon: ICONS.chart },
    ];
    
    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_company_details', { p_empresa_id: companyId });

            if (error) {
                console.error('Error fetching company details:', error);
                addToast({ message: `Error al cargar detalles: ${error.message}`, type: 'error' });
                setData({ details: null });
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
    
    useEffect(() => {
        const fetchPlansAndModules = async () => {
            try {
                const [plansRes, modulesRes] = await Promise.all([
                    supabase.rpc('get_public_plans'),
                    supabase.rpc('get_all_modulos_management')
                ]);
                if (plansRes.error) throw plansRes.error;
                if (modulesRes.error) throw modulesRes.error;
                
                const selectablePlans = (plansRes.data || []).filter(p => p.prices.custom === undefined || p.prices.custom === null);
                setAvailablePlans(selectablePlans);
                // FIX: Cast the RPC result to ensure type safety.
                setAvailableModules((modulesRes.data as ModuleInfo[]) || []);
            } catch (err) {
                addToast({ message: `Error al cargar configuración: ${err.message}`, type: 'error' });
            }
        };
        fetchPlansAndModules();
    }, []);

    const handleModuleToggle = (moduleId, isActive) => {
        setSelectedModules(prev => {
            const newMap = new Map(prev);
            if (isActive) {
                const moduleInfo = availableModules.find(m => m.id === moduleId);
                if (moduleInfo) newMap.set(moduleId, moduleInfo);
            } else {
                newMap.delete(moduleId);
            }
            return newMap;
        });
    };

    useEffect(() => {
        if (isPaymentModalOpen && !paymentToEdit) {
            const selectedPlan = availablePlans.find(p => p.id === paymentData.planId);
            if (!selectedPlan) return;
    
// FIX: Use map before reduce to ensure correct type inference for summed values.
            const modulesPrice = Array.from(selectedModules.values(), (mod: ModuleInfo) => Number(mod.precio_mensual)).reduce((sum, price) => sum + price, 0);
            const planPrice = Number(selectedPlan.prices[paymentData.cycle] || 0);
            const totalBeforeDiscount = planPrice + modulesPrice;
    
            let newDate = new Date();
            if (paymentData.cycle === 'monthly') newDate.setMonth(newDate.getMonth() + 1);
            else if (paymentData.cycle === 'yearly') newDate.setFullYear(newDate.getFullYear() + 1);
            else if (paymentData.cycle === 'lifetime') newDate.setFullYear(newDate.getFullYear() + 99);
    
            setPaymentData(prev => ({
                ...prev,
                precio_plan: planPrice.toString(),
                monto: (totalBeforeDiscount - Number(prev.descuento || 0)).toFixed(2),
                fecha_vencimiento: newDate.toISOString().split('T')[0]
            }));
        }
    }, [paymentData.planId, paymentData.cycle, selectedModules, availablePlans, isPaymentModalOpen, paymentToEdit]);


    const handlePaymentInput = (e) => {
        const { name, value } = e.target;
        setPaymentData(prev => {
            const newPaymentData = { ...prev, [name]: value };
            if (name === 'monto' || name === 'descuento') {
                const selectedPlan = availablePlans.find(p => p.id === newPaymentData.planId);
                const planPrice = Number(selectedPlan?.prices[newPaymentData.cycle] || 0);
// FIX: Use map before reduce to ensure correct type inference for summed values.
                const modulesPrice = Array.from(selectedModules.values(), (mod: ModuleInfo) => Number(mod.precio_mensual)).reduce((sum, price) => sum + price, 0);
                const subtotal = planPrice + modulesPrice;

                if (name === 'descuento') {
                    newPaymentData.monto = (subtotal - Number(value || 0)).toFixed(2);
                } else if (name === 'monto') {
                    newPaymentData.descuento = (subtotal - Number(value || 0)).toFixed(2);
                }
            }
            return newPaymentData;
        });
    };

    const handleAddPaymentClick = async () => {
        setPaymentToEdit(null);
        startLoading();
        try {
            const { data: moduleStatus, error } = await supabase.rpc('get_company_modules_status', { p_empresa_id: companyId });
            if (error) throw error;
            
            // FIX: Explicitly cast RPC result to ensure type safety for module status.
            const typedModuleStatus = (moduleStatus as ModuleInfo[]) || [];
            setInitialModuleStatus(typedModuleStatus); // **FIX: Store initial state**
            
            const activeModulesMap = new Map<string, ModuleInfo>();
            typedModuleStatus.forEach(mod => {
                if (mod.is_active) {
                    activeModulesMap.set(mod.id, mod);
                }
            });
            setSelectedModules(activeModulesMap);

            const firstPlan = availablePlans.length > 0 ? availablePlans[0] : null;
            setPaymentData({
                planId: firstPlan ? firstPlan.id : '',
                cycle: 'monthly',
                precio_plan: '',
                monto: '',
                descuento: '',
                metodo_pago: 'Transferencia Bancaria',
                notas: '',
                fecha_vencimiento: today,
                fecha_pago: new Date(new Date().toString().split('GMT')[0]+' UTC').toISOString().slice(0, 16)
            });
            setPaymentModalOpen(true);
        } catch (err) {
            addToast({ message: `Error al cargar módulos: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    const handleEditPaymentClick = (payment) => {
        setPaymentToEdit(payment);
        const currentEndDate = data.kpis.license_end_date ? new Date(data.kpis.license_end_date).toISOString().split('T')[0] : today;
        setPaymentData({
            monto: payment.monto,
            metodo_pago: payment.metodo_pago,
            notas: payment.notas || '',
            fecha_pago: payment.fecha_pago,
            planId: '', 
            cycle: '', 
            fecha_vencimiento: currentEndDate,
            precio_plan: '',
            descuento: '',
        });
        setSelectedModules(new Map());
        setPaymentModalOpen(true);
    };

    const handleSavePayment = async () => {
        startLoading();
        try {
            if (paymentToEdit) {
                 if (!paymentData.monto || Number(paymentData.monto) < 0) throw new Error('El monto debe ser un número válido.');
                 if (!paymentData.fecha_vencimiento) throw new Error('La fecha de vencimiento es obligatoria.');
    
                 const { error } = await supabase.rpc('update_payment_and_license_as_superadmin', {
                     p_pago_id: paymentToEdit.id,
                     p_empresa_id: companyId,
                     p_monto: Number(paymentData.monto),
                     p_metodo_pago: paymentData.metodo_pago,
                     p_notas: paymentData.notas,
                     p_fecha_pago: new Date(paymentData.fecha_pago).toISOString(),
                     p_nueva_fecha_fin: paymentData.fecha_vencimiento
                 });
                
                 if (error) throw error;
                 addToast({ message: 'Pago y licencia actualizados correctamente.', type: 'success' });
            } else {
                const selectedPlan = availablePlans.find(p => p.id === paymentData.planId);
                if (!selectedPlan) throw new Error("Plan no válido seleccionado.");

                const cycleTextMap = { monthly: 'Mensual', yearly: 'Anual', lifetime: 'Pago Único' };
                const cycleText = cycleTextMap[paymentData.cycle];
                const planTipo = cycleText ? `${selectedPlan.title} (${cycleText})` : selectedPlan.title;
                
// FIX: Add type to map parameter to prevent it being inferred as 'unknown'
                const activeModulesPayload = Array.from(selectedModules.values()).map((m: ModuleInfo) => ({ nombre: m.nombre_visible, precio: m.precio_mensual }));

                const params = {
                    p_empresa_id: companyId,
                    p_monto: Number(paymentData.monto),
                    p_metodo_pago: paymentData.metodo_pago,
                    p_notas: paymentData.notas,
                    p_plan_tipo: planTipo,
                    p_nueva_fecha_fin: paymentData.fecha_vencimiento,
                    p_precio_plan: Number(paymentData.precio_plan),
                    p_descuento: Number(paymentData.descuento),
                    p_modulos_activados: activeModulesPayload
                };
                if (params.p_monto < 0) throw new Error('El monto a pagar no puede ser negativo.');
                if (!params.p_nueva_fecha_fin) throw new Error('Debe seleccionar una fecha de vencimiento.');
                
                const { error: rpcError } = await supabase.rpc('add_license_payment', params);
                if (rpcError) throw rpcError;
                addToast({ message: 'Pago añadido y licencia actualizada correctamente.', type: 'success' });
                
                // Now, update the actual module status for the company
                for (const module of availableModules) {
                    // **FIX: Use the pre-fetched initialModuleStatus instead of a potentially stale `data` object**
                    const originalStatus = initialModuleStatus.find(m => m.id === module.id)?.is_active || false;
                    const newStatus = selectedModules.has(module.id);
                    if (originalStatus !== newStatus) {
                        await supabase.rpc('toggle_company_module', {
                            p_empresa_id: companyId,
                            p_modulo_id: module.id,
                            p_is_active: newStatus
                        });
                    }
                }
            }
            setPaymentModalOpen(false);
            fetchData();
        } catch (err) {
            console.error('Error saving payment:', err);
            addToast({ message: `Error al guardar pago: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };
    
    const handleUpdateLicense = async () => {
        startLoading();
        try {
            const { error } = await supabase.rpc('update_license_end_date_as_superadmin', {
                p_empresa_id: companyId,
                p_new_end_date: newEndDate
            });
            if (error) throw error;
            addToast({ message: 'Fecha de vencimiento actualizada.', type: 'success' });
            setLicenseModalOpen(false);
            fetchData();
        } catch (err) {
            addToast({ message: `Error al actualizar: ${err.message}`, type: 'error' });
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
             return html`<div class="py-20"></div>`;
        }
        
        if (!data.details) {
            return html`
                <div class="text-center py-10">
                    <h2 class="text-2xl font-bold text-red-600">Error al Cargar la Empresa</h2>
                    <p class="mt-2 text-gray-600">No se pudieron encontrar los detalles para la empresa solicitada.</p>
                    <button onClick=${() => navigate('/superadmin')} class="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                        Volver a la lista
                    </button>
                </div>`;
        }

        const { details, kpis, users, branches, payments } = data;
        
        const formatCurrencyUSD = (value) => {
            const number = Number(value || 0);
            return `$ ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };

        const tabs = [
            { id: 'usuarios', label: 'Usuarios' },
            { id: 'sucursales', label: 'Sucursales' },
            { id: 'pagos', label: 'Pagos de Licencia' },
            { id: 'modulos', label: 'Módulos' }
        ];

        const getKpiColor = () => {
            if (kpis.license_status !== 'Activa') return 'red';
            if (kpis.days_remaining < 15) return 'amber';
            return 'green';
        }
        
        const basePlanName = kpis.license_type?.split('(')[0].trim() || '';
        const currentPlan = [...availablePlans].find(p => p.title === basePlanName);
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

            <div class="bg-white p-6 rounded-lg shadow-sm border mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">Información de la Empresa y Sucursal Principal</h3>
                <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
                    <div class="sm:col-span-1"><dt class="text-sm font-medium text-gray-500">Dirección</dt><dd class="mt-1 text-sm text-gray-900">${details.direccion || 'No especificada'}</dd></div>
                    <div class="sm:col-span-1">
                        <dt class="text-sm font-medium text-gray-500">Teléfono</dt>
                        <dd class="mt-1 text-sm text-gray-900 flex items-center gap-2">
                            <span>${details.telefono || 'No especificado'}</span>
                            ${details.telefono && html`
                                <a href=${`https://wa.me/${details.telefono.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" class="text-green-500 hover:text-green-600">
                                    <${WhatsAppIcon} />
                                </a>
                            `}
                        </dd>
                    </div>
                    <div class="sm:col-span-1"><dt class="text-sm font-medium text-gray-500">Propietario</dt><dd class="mt-1 text-sm text-gray-900">${details.propietario_nombre || 'No asignado'}</dd><dd class="text-xs text-gray-500">${details.propietario_email || ''}</dd></div>
                    <div class="sm:col-span-1"><dt class="text-sm font-medium text-gray-500">Moneda Principal</dt><dd class="mt-1 text-sm text-gray-900">${details.moneda || 'No especificada'}</dd></div>
                    <div class="sm:col-span-1"><dt class="text-sm font-medium text-gray-500">País / Zona Horaria</dt><dd class="mt-1 text-sm text-gray-900">${details.timezone?.split('/')[1]?.replace('_', ' ') || 'No especificado'}</dd></div>
                    <div class="sm:col-span-1"><dt class="text-sm font-medium text-gray-500">Fecha de Registro</dt><dd class="mt-1 text-sm text-gray-900">${new Date(details.created_at).toLocaleDateString()}</dd></div>
                </dl>
            </div>

            <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <${KPI_Card} title="Usuarios Activos" value=${`${kpis.total_users} / ${maxUsersDisplay}`} icon=${ICONS.users} />
                <${KPI_Card} title="Sucursales" value=${`${kpis.total_branches} / ${maxBranchesDisplay}`} icon=${ICONS.building} />
                <${KPI_Card} title="Licencia" value=${kpis.license_status} subtext=${kpis.license_type} icon=${ICONS.credit_card} color=${kpis.license_status === 'Activa' ? 'green' : 'red'} />
                <${KPI_Card} title="Días Restantes" value=${kpis.days_remaining} 
                    subtext=${html`
                        <div class="flex items-center justify-center gap-2">
                            <span>${formattedEndDate ? `Vence el ${formattedEndDate}`: ''}</span>
                            <button
                                onClick=${(e) => {
                                    e.stopPropagation();
                                    setNewEndDate(kpis.license_end_date ? new Date(kpis.license_end_date).toISOString().split('T')[0] : today);
                                    setLicenseModalOpen(true);
                                }}
                                class="text-gray-400 hover:text-primary p-1 rounded-full -m-1"
                                title="Editar fecha de vencimiento"
                            >
                                ${ICONS.edit}
                            </button>
                        </div>
                    `} 
                    icon=${ICONS.chart} color=${getKpiColor()} />
            </div>

            <div class="mt-8">
                <${Tabs} tabs=${tabs} activeTab=${activeTab} onTabClick=${setActiveTab} />
            </div>

            <div class="mt-6">
                ${activeTab === 'usuarios' && html`<div class="mx-auto max-w-7xl"><${UserList} users=${users} onResetPassword=${openResetPasswordModal} /></div>`}
                ${activeTab === 'sucursales' && html`<div class="mx-auto max-w-7xl"><${BranchList} branches=${branches} /></div>`}
                ${activeTab === 'pagos' && html`
                    <div class="mx-auto max-w-7xl">
                        <div class="lg:flex lg:items-center lg:justify-between mb-4">
                            <div>
                                <h3 class="text-lg font-semibold text-gray-800">Historial de Pagos</h3>
                                <p class="mt-1 text-sm text-gray-600">Monto total registrado: <span class="font-bold text-emerald-600">${formatCurrencyUSD(totalPaid)}</span></p>
                            </div>
                            <div class="mt-3 lg:ml-4 lg:mt-0">
                                <button onClick=${handleAddPaymentClick} class="hidden lg:flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                                    ${ICONS.add} <span>Añadir Pago</span>
                                </button>
                            </div>
                        </div>
                        <${PaymentList} payments=${payments} formatCurrency=${formatCurrencyUSD} onEdit=${handleEditPaymentClick} />
                    </div>
                `}
                ${activeTab === 'modulos' && html`<${ModulesTab} companyId=${companyId} />`}
            </div>
            
            ${activeTab === 'pagos' && html`
                <div class="lg:hidden">
                    <${FloatingActionButton} onClick=${handleAddPaymentClick} label="Añadir Pago" />
                </div>
            `}
        `;
    };

    const isEditMode = paymentToEdit !== null;
    const selectedPlanForModal = availablePlans.find(p => p.id === paymentData.planId);
    const availableCyclesForSelectedPlan = selectedPlanForModal?.prices ?
        Object.keys(selectedPlanForModal.prices).filter(c => c !== 'custom' && selectedPlanForModal.prices[c] !== null) : [];

    const formatCurrencyUSD = (value) => {
        const number = Number(value || 0);
        return `$ ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return html`
        <${DashboardLayout} user=${user} onLogout=${onLogout} sidebarLinks=${sidebarLinks} activeLink="Gestionar Empresas" breadcrumbs=${breadcrumbs}>
            ${renderContent()}

            <${ConfirmationModal}
                isOpen=${isPaymentModalOpen}
                onClose=${() => setPaymentModalOpen(false)}
                onConfirm=${handleSavePayment}
                title=${isEditMode ? 'Editar Pago' : 'Añadir Nuevo Pago y Actualizar Licencia'}
                confirmText="Guardar"
                icon=${ICONS.dollar}
                maxWidthClass="max-w-3xl"
            >
                ${isEditMode ? html`
                    <div class="space-y-4 text-sm text-gray-600">
                        <${FormInput} label="Fecha de Pago" name="fecha_pago" type="datetime-local" value=${paymentData.fecha_pago} onInput=${handlePaymentInput} />
                        <${FormInput} label="Monto (USD)" name="monto" type="number" value=${paymentData.monto} onInput=${handlePaymentInput} />
                        <${FormInput} label="Nueva Fecha de Vencimiento de Licencia" name="fecha_vencimiento" type="date" value=${paymentData.fecha_vencimiento} onInput=${handlePaymentInput} />
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
                ` : html`
                    <div class="space-y-4 text-sm text-gray-600">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="planId" class="block font-medium leading-6 text-gray-900">Plan</label>
                                <select id="planId" name="planId" value=${paymentData.planId} onInput=${handlePaymentInput} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                                    ${availablePlans.map(plan => html`<option value=${plan.id}>${plan.title}</option>`)}
                                </select>
                            </div>
                            <div>
                                <label for="cycle" class="block font-medium leading-6 text-gray-900">Ciclo</label>
                                <select id="cycle" name="cycle" value=${paymentData.cycle} onInput=${handlePaymentInput} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                                    ${availableCyclesForSelectedPlan.map(cycle => html`<option value=${cycle}>${{monthly: 'Mensual', yearly: 'Anual', lifetime: 'Pago Único'}[cycle]}</option>`)}
                                </select>
                            </div>
                        </div>
                        <div class="p-4 border rounded-lg bg-slate-50">
                            <h4 class="font-semibold text-gray-800 mb-2">Módulos Adicionales</h4>
                            <div class="space-y-2">
                                ${availableModules.map(mod => html`
                                    <div class="flex items-center justify-between">
                                        <label for=${`mod-${mod.id}`} class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" id=${`mod-${mod.id}`} checked=${selectedModules.has(mod.id)} onChange=${e => handleModuleToggle(mod.id, e.target.checked)} class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span>${mod.nombre_visible}</span>
                                        </label>
                                        <span class="font-medium text-gray-700">${formatCurrencyUSD(mod.precio_mensual)}</span>
                                    </div>
                                `)}
                            </div>
                        </div>
                         <div class="grid grid-cols-3 gap-4">
                            <${FormInput} label="Precio del Plan (USD)" name="precio_plan" type="number" value=${paymentData.precio_plan} disabled=${true} />
                            <${FormInput} label="Descuento (USD)" name="descuento" type="number" value=${paymentData.descuento} onInput=${handlePaymentInput} />
                            <${FormInput} label="Monto a Pagar (USD)" name="monto" type="number" value=${paymentData.monto} onInput=${handlePaymentInput} />
                         </div>
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
                `}
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

            <${ConfirmationModal}
                isOpen=${isLicenseModalOpen}
                onClose=${() => setLicenseModalOpen(false)}
                onConfirm=${handleUpdateLicense}
                title="Editar Fecha de Vencimiento"
                confirmText="Guardar Fecha"
                icon=${ICONS.calendar_month}
            >
                <p class="text-sm text-gray-600 mb-4">
                    Selecciona la nueva fecha de vencimiento para la licencia de <span class="font-bold">${data?.details?.nombre}</span>.
                </p>
                <${FormInput}
                    label="Nueva Fecha de Vencimiento"
                    name="new_end_date"
                    type="date"
                    value=${newEndDate}
                    onInput=${(e) => setNewEndDate(e.target.value)}
                />
            <//>
        <//>
    `;
}