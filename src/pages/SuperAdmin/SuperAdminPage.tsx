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
        <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
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
    };

    const handleConfirmAction = async () => {
        const { action, company } = modalState;
        if (!action || !company) return;

        let rpcName = '';
        let params = {};
        let successMessage = '';
        
        startLoading();
        try {
            switch(action) {
                case 'delete':
                    rpcName = 'delete_company_as_superadmin';
                    params = { p_empresa_id: company.id };
                    successMessage = `Empresa "${company.nombre}" eliminada correctamente.`;
                    break;
                case 'suspend':
                    rpcName = 'update_company_status_as_superadmin';
                    params = { p_empresa_id: company.id, p_new_status: 'Suspendida' };
                    successMessage = `Empresa "${company.nombre}" suspendida.`;
                    break;
                case 'activate':
                    rpcName = 'update_company_status_as_superadmin';
                    params = { p_empresa_id: company.id, p_new_status: 'Activa' };
                    successMessage = `Empresa "${company.nombre}" activada.`;
                    break;
                default:
                    throw new Error("Acción desconocida");
            }

            const { error } = await supabase.rpc(rpcName, params);
            
            if (error) throw error;
            
            addToast({ message: successMessage, type: 'success' });
            fetchCompanies(); // Refresh data

        } catch (err) {
            console.error(`Error during action '${action}':`, err);
            let friendlyError = err.message;
            if (err.message.includes('does not exist')) {
                 friendlyError = `La función RPC '${rpcName}' no existe en la base de datos.`;
            }
            addToast({ message: `Error: ${friendlyError}`, type: 'error' });
        } finally {
            stopLoading();
            handleCloseModal();
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
                    body: html`<p class="text-sm text-gray-600">¿Estás seguro de que quieres eliminar la empresa <span class="font-bold text-gray-800">${company.nombre}</span>? Esta acción es irreversible y eliminará todos sus datos.</p>`
                };
            case 'suspend':
                return {
                    title: `Suspender Empresa`,
                    confirmText: 'Sí, suspender',
                    variant: 'primary',
                    icon: ICONS.suspend,
                    body: html`<p class="text-sm text-gray-600">Esto bloqueará el acceso a todos los usuarios de <span class="font-bold text-gray-800">${company.nombre}</span>. ¿Estás seguro?</p>`
                };
            case 'activate':
                 return {
                    title: `Reactivar Empresa`,
                    confirmText: 'Sí, reactivar',
                    variant: 'primary',
                    icon: ICONS.activate,
                    body: html`<p class="text-sm text-gray-600">Esto restaurará el acceso a todos los usuarios de <span class="font-bold text-gray-800">${company.nombre}</span>. ¿Estás seguro?</p>`
                };
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
                <button onClick=${() => addToast({ message: 'Funcionalidad no implementada aún.', type: 'info' })} class="flex-shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                    Crear Nueva Empresa
                </button>
            </div>
            
            <div class="mt-8">
                <${CompanyTable} companies=${companies} onAction=${handleAction} onRowClick=${handleRowClick} />
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
    `;
}