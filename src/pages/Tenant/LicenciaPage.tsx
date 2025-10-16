/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { Tabs } from '../../components/Tabs.js';
import { PlanCard } from '../../components/PlanCard.js';
import { supabase } from '../../lib/supabaseClient.js';
import { Spinner } from '../../components/Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';

const ReciboModal = ({ pago, companyInfo, onClose }) => {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!pago) return;
            setIsLoading(true);
            try {
                const { data: result, error: rpcError } = await supabase.rpc('get_my_payment_receipt_details', { p_pago_id: pago.id });
                if (rpcError) throw rpcError;
                setData(result);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [pago]);

    const handlePrint = () => {
        const printableContent = document.getElementById('printable-receipt');
        if (!printableContent) return;

        const printContainer = document.createElement('div');
        printContainer.id = 'print-container-servivent';
        
        const contentClone = printableContent.cloneNode(true);
        printContainer.appendChild(contentClone);
        
        document.body.appendChild(printContainer);

        const style = document.createElement('style');
        style.id = 'print-style-servivent';
        style.innerHTML = `
            @media print {
                body > *:not(#print-container-servivent) {
                    display: none !important;
                }
                #print-container-servivent {
                    display: block !important;
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);

        window.print();

        document.body.removeChild(printContainer);
        document.head.removeChild(style);
    };
    
    const formatCurrency = (value, symbol) => {
        const number = Number(value || 0);
        return `${symbol} ${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const renderContent = () => {
        if (isLoading) {
            return html`<div class="flex items-center justify-center h-96"><${Spinner} color="text-primary" size="h-10 w-10" /></div>`;
        }
        if (error) {
            return html`<div class="text-center p-10"><h2 class="text-xl font-bold text-red-600">Error al Cargar Recibo</h2><p>${error}</p></div>`;
        }
        if (!data) {
            return html`<div class="text-center p-10"><h2 class="text-xl font-bold text-gray-600">Recibo no encontrado.</h2></div>`;
        }
        
        const { receipt, company } = data;
        const serviventInfo = {
            logoUrl: "https://raw.githubusercontent.com/servivent10/iconos/refs/heads/main/Usuario_150x.png",
            nit: "7797109010",
            address: "Villa 1ro de mayo, barrio sucre calle 10",
            phone: "+591 75647812"
        };
        const symbol = '$'; // All license payments are in USD

        const concepto = receipt.concepto || 'Suscripción de Licencia';
        const precioPlan = Number(receipt.precio_plan || 0);
        const modulos = receipt.modulos_incluidos || [];
        const subtotal = precioPlan + modulos.reduce((sum, mod) => sum + Number(mod.precio || 0), 0);

        return html`
            <div id="printable-receipt">
                <header class="p-8 border-b">
                    <div class="flex justify-between items-start">
                        <div>
                            <img src=${serviventInfo.logoUrl} alt="ServiVENT Logo" class="h-10 w-auto" />
                            <div class="mt-2 text-xs text-gray-500">
                                <p>NIT: ${serviventInfo.nit}</p>
                                <p>${serviventInfo.address}</p>
                                <p>Teléfono: ${serviventInfo.phone}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <h1 class="text-2xl font-bold text-gray-800 uppercase tracking-wide">Recibo de Pago</h1>
                            <p class="text-sm text-gray-500">N°: <span class="font-mono">${receipt.id.substring(0, 8).toUpperCase()}</span></p>
                            <p class="text-sm text-gray-500">Fecha: <span class="font-medium">${new Date(receipt.fecha_pago).toLocaleDateString()}</span></p>
                        </div>
                    </div>
                    <div class="mt-8">
                        <h2 class="text-sm font-semibold text-gray-500">CLIENTE</h2>
                        <div class="mt-1 text-gray-800">
                            <p class="font-bold">${company.nombre}</p>
                            <p>NIT: ${company.nit}</p>
                            <p>${company.propietario_nombre}</p>
                        </div>
                    </div>
                </header>
                <main class="p-8">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b-2 border-gray-300 text-sm text-gray-600">
                                <th class="py-2 font-semibold">Concepto</th>
                                <th class="py-2 text-right font-semibold">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="border-b">
                                <td class="py-2 font-medium text-black">${concepto}</td>
                                <td class="py-2 text-right text-black">${formatCurrency(precioPlan, symbol)}</td>
                            </tr>
                            ${modulos.map(mod => html`
                                <tr class="border-b">
                                    <td class="py-2 font-medium text-black">Módulo: ${mod.nombre}</td>
                                    <td class="py-2 text-right text-black">${formatCurrency(mod.precio, symbol)}</td>
                                </tr>
                            `)}
                        </tbody>
                    </table>
                    <div class="mt-6 flex justify-end">
                        <div class="w-full max-w-sm space-y-2">
                            <div class="flex justify-between text-sm">
                                <span>Subtotal</span>
                                <span>${formatCurrency(subtotal, symbol)}</span>
                            </div>
                            <div class="flex justify-between text-sm text-red-600">
                                <span>Descuento</span>
                                <span>-${formatCurrency(receipt.descuento, symbol)}</span>
                            </div>
                            <div class="flex justify-between text-lg font-bold text-gray-900 border-t-2 border-gray-300 pt-2">
                                <span>TOTAL PAGADO</span>
                                <span>${formatCurrency(receipt.monto, symbol)}</span>
                            </div>
                        </div>
                    </div>
                    ${receipt.notas && html`
                        <div class="mt-8 border-t pt-4">
                            <h3 class="text-sm font-semibold text-gray-600">Notas Adicionales</h3>
                            <p class="text-sm text-gray-500 mt-1">${receipt.notas}</p>
                        </div>
                    `}
                </main>
            </div>
        `;
    };

    return html`
        <${ConfirmationModal}
            isOpen=${!!pago}
            onClose=${onClose}
            title="Recibo de Pago"
            icon=${ICONS.download}
            maxWidthClass="max-w-3xl"
            customFooter=${html`
                <div class="no-print flex-shrink-0 flex justify-end items-center p-4 bg-gray-50 rounded-b-xl space-x-3 border-t border-gray-200">
                    <button onClick=${onClose} class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Cerrar</button>
                    <button onClick=${handlePrint} disabled=${isLoading || !!error} class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                        ${ICONS.download} Imprimir / Guardar
                    </button>
                </div>
            `}
        >
            ${renderContent()}
        <//>
    `;
};


// Componente para renderizar la lista de pagos de forma responsiva
const PaymentHistory = ({ payments = [], formatCurrency, onShowReceipt }) => {
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
                Monto total registrado: <span class="font-bold text-emerald-600">${formatCurrency(totalPaid)}</span>
            </p>
            <div class="space-y-4 sm:hidden">
                ${payments.map(payment => html`
                    <div class="bg-white p-4 rounded-lg shadow border">
                        <div class="flex justify-between items-center">
                            <div class="font-bold text-lg text-gray-800">${formatCurrency(payment.monto)}</div>
                            <div class="text-xs text-gray-500">${new Date(payment.fecha_pago).toLocaleString()}</div>
                        </div>
                        <div class="text-sm text-gray-600 mt-1">Método: ${payment.metodo_pago}</div>
                        ${payment.notas && html`<p class="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">Nota: ${payment.notas}</p>`}
                        <div class="mt-3 pt-3 border-t text-right">
                             <button onClick=${() => onShowReceipt(payment)} class="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                                ${ICONS.download} Recibo
                            </button>
                        </div>
                    </div>
                `)}
            </div>

            <div class="hidden sm:block flow-root">
                <table class="min-w-full divide-y divide-gray-300">
                    <thead>
                        <tr>
                            <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Fecha de Pago</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Monto</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Método de Pago</th>
                            <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Notas</th>
                            <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0"><span class="sr-only">Descargar</span></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white">
                        ${payments.map(payment => html`
                            <tr key=${payment.id}>
                                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-0">${new Date(payment.fecha_pago).toLocaleString()}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">${formatCurrency(payment.monto)}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${payment.metodo_pago}</td>
                                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${payment.notas}</td>
                                <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                                    <button onClick=${() => onShowReceipt(payment)} class="text-primary hover:text-primary-dark p-1" title="Ver Recibo">
                                        ${ICONS.download}
                                    </button>
                                </td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

const ModulosTab = ({ companyInfo }) => {
    const [modules, setModules] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        const fetchModules = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase.rpc('get_my_company_modules_status');
                if (error) throw error;
                setModules(data || []);
            } catch (err) {
                addToast({ message: `Error al cargar módulos: ${err.message}`, type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchModules();
    }, []);

    const formatCurrencyUSD = (value) => {
        const number = Number(value || 0);
        return `$${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    if (isLoading) {
        return html`<div class="flex justify-center items-center h-64"><${Spinner} color="text-primary" /></div>`;
    }

    return html`
        <div>
            <h2 class="text-xl font-semibold text-gray-800">Módulos Adicionales Disponibles</h2>
            <p class="mt-1 text-sm text-gray-600">Potencia tu negocio activando funcionalidades premium. Contacta a soporte para habilitar los módulos que necesites.</p>

            <div class="mt-6 space-y-4">
                ${modules.map(mod => html`
                    <div key=${mod.id} class="bg-white p-4 rounded-lg shadow-sm border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-3">
                                <p class="font-bold text-gray-800">${mod.nombre_visible}</p>
                                ${mod.is_active && html`
                                    <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                                        <span class="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                                        Activo
                                    </span>
                                `}
                            </div>
                            <p class="text-sm text-gray-600 mt-1">${mod.descripcion}</p>
                        </div>
                        <div class="flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                             <p class="text-sm font-semibold text-emerald-600 text-left sm:text-right">${formatCurrencyUSD(mod.precio_mensual)} / mes</p>
                             ${!mod.is_active && html`
                                <a href="mailto:servivent10@gmail.com?subject=Solicitud para activar módulo: ${mod.nombre_visible}" class="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                                    Contactar para Activar
                                </a>
                             `}
                        </div>
                    </div>
                `)}
            </div>
        </div>
    `;
};


export function LicenciaPage({ user, onLogout, onProfileUpdate, companyInfo, notifications, navigate }) {
    const [activeTab, setActiveTab] = useState('plan');
    const [upgradePlans, setUpgradePlans] = useState([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(true);
    const [selectedPago, setSelectedPago] = useState(null);
    const { addToast } = useToast();

    useEffect(() => {
        const fetchPlans = async () => {
            setIsLoadingPlans(true);
            try {
                const { data, error } = await supabase.rpc('get_public_plans');
                if (error) throw error;
                setUpgradePlans(data || []);
            } catch (err) {
                addToast({ message: 'No se pudieron cargar los planes de mejora.', type: 'error' });
            } finally {
                setIsLoadingPlans(false);
            }
        };
        fetchPlans();
    }, []);

    const formatCurrencyUSD = (value) => {
        const number = Number(value || 0);
        const formattedNumber = number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `$ ${formattedNumber}`;
    };

    const breadcrumbs = [ { name: 'Licencia y Facturación', href: '#/licencia' } ];
    const tabs = [
        { id: 'plan', label: 'Mi Plan' },
        { id: 'pagos', label: 'Historial de Pagos' },
        { id: 'modulos', label: 'Módulos Adicionales' }
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
        addToast({ message: `Funcionalidad de pago para ${plan.title} no implementada.`, type: 'info' });
    };

    const maxUsers = planDetails?.limits?.max_users;
    const maxBranches = planDetails?.limits?.max_branches;

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

            <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mt-6">
                <${KPI_Card} title="Estado de la Licencia" value=${licenseStatus} subtext=${`Plan: ${currentPlanName}`} icon=${ICONS.credit_card} color=${licenseStatus === 'Activa' ? 'green' : 'red'} />
                <${KPI_Card} title="Días Restantes" value=${daysRemaining} subtext=${licenseEndDate ? `Vence el ${new Date(licenseEndDate).toLocaleDateString()}` : ''} icon=${ICONS.chart} color=${getKpiColor()} />
                <${KPI_Card} title="Límite de Usuarios" value=${maxUsers >= 99999 ? 'Ilimitados' : maxUsers} icon=${ICONS.users} />
                <${KPI_Card} title="Límite de Sucursales" value=${maxBranches >= 99999 ? 'Ilimitados' : maxBranches} icon=${ICONS.building} />
            </div>

            <div class="mt-8">
                <${Tabs} tabs=${tabs} activeTab=${activeTab} onTabClick=${setActiveTab} />
            </div>
            
            <div class="mt-6">
                ${activeTab === 'plan' && html`
                    <div>
                        <h2 class="text-xl font-semibold text-gray-800">Cambiar de Plan</h2>
                        <p class="mt-1 text-sm text-gray-600">Elige el plan que mejor se adapte a las necesidades de tu negocio.</p>
                         ${isLoadingPlans ? html`
                            <div class="flex justify-center items-center h-64"><${Spinner} color="text-primary" size="h-10 w-10" /></div>
                         ` : html`
                             <div class="isolate mx-auto mt-4 grid max-w-md grid-cols-1 gap-8 md:max-w-2xl lg:max-w-none lg:grid-cols-3">
                                ${upgradePlans.map(plan => html`
                                    <${PlanCard} 
                                        plan=${plan}
                                        isCurrentPlan=${plan.title === currentPlanName}
                                        onSelect=${handleSelectPlan}
                                        currencySymbol="$"
                                    />
                                `)}
                            </div>
                         `}
                    </div>
                `}
                ${activeTab === 'pagos' && html`
                    <${PaymentHistory} payments=${paymentHistory} formatCurrency=${formatCurrencyUSD} onShowReceipt=${setSelectedPago} />
                `}
                ${activeTab === 'modulos' && html`
                    <${ModulosTab} companyInfo=${companyInfo} />
                `}
            </div>

            <${ReciboModal} pago=${selectedPago} companyInfo=${companyInfo} onClose=${() => setSelectedPago(null)} />
        <//>
    `;
}