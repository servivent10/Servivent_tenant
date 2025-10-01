/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { FloatingActionButton } from '../../components/FloatingActionButton.js';
import { FormInput } from '../../components/FormComponents.js';
import { Spinner } from '../../components/Spinner.js';
import { LoadingPage } from '../../components/LoadingPage.js';

const CompanyTable = ({ companies, onAction, onRowClick }) => {
    const getStatusPill = (status) => {
        const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
        switch (status) {
            case 'Activa':
                return `${baseClasses} bg-green-100 text-green-800`;
            case 'Suspendida':
                return `${baseClasses} bg-red-100 text-red-800`;
            case 'Expirada':
                return `${baseClasses} bg-yellow-100 text-yellow-800`;
            case 'Pendiente de Aprobación':
                return `${baseClasses} bg-blue-100 text-blue-800`;
            default:
                return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };

    if (companies.length === 0) {
        return html`
            <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white">
                <div class="text-6xl text-gray-300">${ICONS.building}</div>
                <h3 class="mt-2 text-lg font-medium text-gray-900">No se encontraron empresas</h3>
                <p class="mt-1 text-sm text-gray-500">Comienza creando una nueva empresa para gestionarla desde aquí.</p>
            </div>
        `;
    }
    
    const handleActionClick = (e, action, company) => {
        e.stopPropagation(); // Evita que el click en el botón dispare el onRowClick
        onAction(action, company);
    };

    return html`
        {/* Mobile/Tablet Card View */}
        <div class="space-y-4 lg:hidden">
            ${companies.map(company => html`
                <div key=${company.id} class="bg-white p-4 rounded-lg shadow border cursor-pointer" onClick=${() => onRowClick(company)}>
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-bold text-gray-800">${company.nombre}</div>
                            <div class="text-sm text-gray-600">NIT: ${company.nit}</div>
                        </div>
                        <span class=${getStatusPill(company.estado_licencia)}>${company.estado_licencia}</span>
                    </div>
                    <div class="text-sm text-gray-500 mt-2">
                        <p>Propietario: <span class="font-medium text-gray-700">${company.propietario_email}</span></p>
                        <p>Plan: <span class="font-medium text-gray-700">${company.plan_actual}</span></p>
                    </div>
                    <div class="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                        <div class="text-xs text-gray-400">
                            Registrado: ${new Date(company.created_at).toLocaleDateString()}
                        </div>
                        <div class="flex items-center justify-end space-x-2">
                             <button onClick=${(e) => handleActionClick(e, 'edit', company)} title="Editar" class="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                             ${company.estado_licencia === 'Activa' ? html`
                                 <button onClick=${(e) => handleActionClick(e, 'suspend', company)} title="Suspender" class="text-gray-400 hover:text-yellow-600 p-1 rounded-full hover:bg-gray-100">${ICONS.suspend}</button>
                             ` : html`
                                 <button onClick=${(e) => handleActionClick(e, 'activate', company)} title="Activar" class="text-gray-400 hover:text-green-600 p-1 rounded-full hover:bg-gray-100">${ICONS.activate}</button>
                             `}
                             <button onClick=${(e) => handleActionClick(e, 'delete', company)} title="Eliminar" class="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-gray-100">${ICONS.delete}</button>
                        </div>
                    </div>
                </div>
            `)}
        </div>

        {/* Desktop Table View */}
        <div class="hidden lg:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table class="min-w-full divide-y divide-gray-300">
                <thead class="bg-gray-50">
                    <tr>
                        <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Empresa</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Propietario</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Plan Actual</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha de Registro</th>
                        <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Acciones</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                    ${companies.map(company => html`
                        <tr key=${company.id} onClick=${() => onRowClick(company)} class="hover:bg-gray-50 cursor-pointer">
                            <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                <div class="font-medium text-gray-900">${company.nombre}</div>
                                <div class="text-gray-500">NIT: ${company.nit}</div>
                            </td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${company.propietario_email}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${company.plan_actual}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                <span class=${getStatusPill(company.estado_licencia)}>${company.estado_licencia}</span>
                            </td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${new Date(company.created_at).toLocaleDateString()}</td>
                            <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                <div class="flex items-center justify-end space-x-2">
                                    <button onClick=${(e) => handleActionClick(e, 'edit', company)} title="Editar" class="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                                    ${company.estado_licencia === 'Activa' ? html`
                                        <button onClick=${(e) => handleActionClick(e, 'suspend', company)} title="Suspender" class="text-gray-400 hover:text-yellow-600 p-1 rounded-full hover:bg-gray-100">${ICONS.suspend}</button>
                                    ` : html`
                                        <button onClick=${(e) => handleActionClick(e, 'activate', company)} title="Activar" class="text-gray-400 hover:text-green-600 p-1 rounded-full hover:bg-gray-100">${ICONS.activate}</button>
                                    `}
                                    <button onClick=${(e) => handleActionClick(e, 'delete', company)} title="Eliminar" class="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-gray-100">${ICONS.delete}</button>
                                </div>
                            </td>
                        </tr>
                    `)}
                </tbody>
            </table>
        </div>
    `;
};


export function SuperAdminPage({ user, onLogout, navigate, onProfileUpdate }) {
    const sidebarLinks = [
        { name: 'Gestionar Empresas', href: '#/superadmin', icon: ICONS.building },
        { name: 'Licencias y Pagos', href: '#', icon: ICONS.chart },
    ];
    const breadcrumbs = [ { name: 'SuperAdmin', href: '#/superadmin' }, { name: 'Empresas', href: '#/superadmin' }];
    
    const [companies, setCompanies] = useState([]);
    const [modalState, setModalState] = useState({ isOpen: false, action: null, company: null });
    const [password, setPassword] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletionSteps, setDeletionSteps] = useState([]);
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();

    async function fetchCompanies() {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_all_companies');
            
            if (error) {
                console.error('Error fetching companies:', error);
                let friendlyError = error.message;
                if (error.message.includes('function public.get_all_companies() does not exist')) {
                     friendlyError = "La función 'get_all_companies' no existe en la base de datos. Por favor, créala para que el panel de SuperAdmin funcione.";
                }
                addToast({ message: `Error al cargar empresas: ${friendlyError}`, type: 'error', duration: 10000 });
            } else {
                setCompanies(data || []);
            }
        } finally {
            stopLoading();
        }
    }

    useEffect(() => {
        fetchCompanies();
    }, []);

    const handleAction = (action, company) => {
        if (action === 'edit') {
            addToast({ message: 'La funcionalidad de editar aún no está implementada.', type: 'info' });
            return;
        }
        setModalState({ isOpen: true, action, company });
    };

    const handleRowClick = (company) => {
        navigate(`/superadmin/empresa/${company.id}`);
    };

    const handleCloseModal = () => {
        setModalState({ isOpen: false, action: null, company: null });
        setPassword('');
    };

    const handleConfirmAction = async () => {
        const { action, company } = modalState;
        if (!action || !company) return;
        
        // Cierra el modal inmediatamente y activa la pantalla de carga para la eliminación.
        if (action === 'delete') {
            if (!password) {
                addToast({ message: 'La contraseña es obligatoria para eliminar.', type: 'error' });
                return;
            }
            handleCloseModal();
            setIsDeleting(true);

            const initialSteps = [
                { key: 'auth', label: 'Verificando credenciales de SuperAdmin', status: 'pending' },
                { key: 'users', label: 'Eliminando usuarios asociados', status: 'pending' },
                { key: 'company', label: 'Eliminando datos de la empresa (irreversible)', status: 'pending' },
            ];
            const updateStepStatus = (key, status) => {
                setDeletionSteps(prev => prev.map(s => s.key === key ? { ...s, status } : s));
            };
            const delay = ms => new Promise(res => setTimeout(res, ms));

            setDeletionSteps(initialSteps);
            await delay(100);

            try {
                updateStepStatus('auth', 'loading');
                await delay(500); // Simulación para que el usuario vea el paso
                
                // La función de Supabase valida la contraseña, por lo que este paso es representativo
                updateStepStatus('auth', 'success');
                updateStepStatus('users', 'loading');
                await delay(1000); // Simulación, la función hace esto internamente

                updateStepStatus('users', 'success');
                updateStepStatus('company', 'loading');

                const { error: functionError } = await supabase.functions.invoke('delete-company-forcefully', {
                    body: { 
                        p_empresa_id: company.id,
                        p_superadmin_password: password 
                    },
                });

                if (functionError) throw functionError;
                
                updateStepStatus('company', 'success');
                await delay(1000); // Dejar que el usuario vea el último check de éxito

                addToast({ message: `Empresa "${company.nombre}" eliminada correctamente.`, type: 'success' });
                fetchCompanies();

            } catch(err) {
                 updateStepStatus('company', 'error'); // Marcar el paso final como erróneo
                 let friendlyError = 'Ocurrió un error inesperado.';
                 if (err.context && typeof err.context.json === 'function') {
                    try { const errorData = await err.context.json(); friendlyError = errorData.error || err.message; } catch (e) { friendlyError = err.message; }
                 } else { friendlyError = err.message; }
                 addToast({ message: `Error: ${friendlyError}`, type: 'error', duration: 15000 });
            } finally {
                setTimeout(() => { // Esperar un poco antes de ocultar la pantalla de carga
                    setIsDeleting(false);
                    setDeletionSteps([]);
                }, 2000);
            }
        } else {
             // Lógica para suspender/activar (se mantiene igual, es rápida)
            startLoading();
            try {
                const rpcName = 'update_company_status_as_superadmin';
                const params = { 
                    p_empresa_id: company.id, 
                    p_new_status: action === 'suspend' ? 'Suspendida' : 'Activa' 
                };
                const { error: rpcError } = await supabase.rpc(rpcName, params);
                if (rpcError) throw rpcError;
                addToast({ message: `Empresa "${company.nombre}" ${action === 'suspend' ? 'suspendida' : 'activada'}.`, type: 'success' });
                fetchCompanies();
            } catch (err) {
                addToast({ message: `Error: ${err.message}`, type: 'error' });
            } finally {
                stopLoading();
                handleCloseModal();
            }
        }
    };
    
    const getModalContent = () => {
        const { action, company } = modalState;
        if (!action || !company) return { title: '', confirmText: '', variant: 'primary', icon: null, body: '' };

        switch(action) {
            case 'delete':
                return {
                    title: `Eliminar Empresa`,
                    confirmText: 'Sí, eliminar',
                    variant: 'danger',
                    icon: ICONS.warning_amber,
                    body: html`
                        <div class="space-y-4">
                             <p class="text-sm text-gray-600">Esta acción es irreversible y eliminará todos los datos de <span class="font-bold text-gray-800">${company.nombre}</span>, incluyendo usuarios, sucursales y productos.</p>
                             <p class="text-sm text-gray-600">Para confirmar, por favor ingresa tu contraseña de SuperAdmin.</p>
                             <${FormInput}
                                label="Contraseña"
                                name="password"
                                type="password"
                                value=${password}
                                onInput=${(e) => setPassword(e.target.value)}
                            />
                        </div>
                    `
                };
            case 'suspend':
                return {
                    title: `Suspender Empresa`,
                    confirmText: 'Sí, suspender',
                    variant: 'primary',
                    icon: ICONS.suspend,
                    body: html`<p class="text-sm text-gray-600">Esto bloqueará el acceso a todos los usuarios de <span class="font-bold text-gray-800">${company.nombre}</span>. ¿Estás seguro?</p>`
                };
            case 'activate': {
                const isSuspended = company.estado_licencia === 'Suspendida';
                 return {
                    title: isSuspended ? `Reactivar Empresa` : `Activar Empresa`,
                    confirmText: isSuspended ? 'Sí, reactivar' : 'Sí, activar',
                    variant: 'primary',
                    icon: ICONS.activate,
                    body: html`<p class="text-sm text-gray-600">Esto ${isSuspended ? 'restaurará el' : 'dará'} acceso a todos los usuarios de <span class="font-bold text-gray-800">${company.nombre}</span>. ¿Estás seguro?</p>`
                };
            }
            default:
                return {};
        }
    };
    
    const modalContent = getModalContent();

    return html`
        <${DashboardLayout}
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            sidebarLinks=${sidebarLinks} 
            activeLink="Gestionar Empresas"
            breadcrumbs=${breadcrumbs}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Gestión de Empresas</h1>
                    <p class="mt-1 text-sm text-gray-600">Supervisa, activa, suspende o elimina las empresas registradas en el sistema.</p>
                </div>
                <button onClick=${() => addToast({ message: 'Funcionalidad no implementada aún.', type: 'info' })} class="hidden lg:flex flex-shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                    Crear Nueva Empresa
                </button>
            </div>
            
            <div class="mt-8">
                <${CompanyTable} companies=${companies} onAction=${handleAction} onRowClick=${handleRowClick} />
            </div>

            <div class="lg:hidden">
                <${FloatingActionButton} onClick=${() => addToast({ message: 'Funcionalidad no implementada aún.', type: 'info' })} label="Crear Nueva Empresa" />
            </div>
            
            <${ConfirmationModal}
                isOpen=${modalState.isOpen}
                onClose=${handleCloseModal}
                onConfirm=${handleConfirmAction}
                title=${modalContent.title}
                confirmText=${modalContent.confirmText}
                confirmVariant=${modalContent.variant}
                icon=${modalContent.icon}
            >
                ${modalContent.body}
            <//>
        <//>
        ${isDeleting && html`<${LoadingPage} steps=${deletionSteps} />`}
    `;
}