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
import { ClienteFormModal } from '../../components/modals/ClienteFormModal.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { Avatar } from '../../components/Avatar.js';

export function ClientesPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const [clientes, setClientes] = useState([]);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [clienteToEdit, setClienteToEdit] = useState(null);
    const [clienteToDelete, setClienteToDelete] = useState(null);
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();

    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_company_clients');
            if (error) throw error;
            setClientes(data);
        } catch (err) {
            addToast({ message: `Error al cargar clientes: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const kpis = useMemo(() => ({
        totalClientes: clientes.length,
        cuentasPorCobrar: clientes.reduce((sum, c) => sum + Number(c.saldo_pendiente || 0), 0),
    }), [clientes]);

    const handleAdd = () => {
        setClienteToEdit(null);
        setFormModalOpen(true);
    };

    const handleEdit = (cliente) => {
        setClienteToEdit(cliente);
        setFormModalOpen(true);
    };
    
    const handleDelete = (cliente) => {
        setClienteToDelete(cliente);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!clienteToDelete) return;
        startLoading();
        try {
            const { error } = await supabase.rpc('delete_client', { p_id: clienteToDelete.id });
            if (error) throw error;
            addToast({ message: `Cliente "${clienteToDelete.nombre}" eliminado.`, type: 'success' });
            fetchData();
        } catch(err) {
             addToast({ message: `Error al eliminar: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
            setDeleteModalOpen(false);
        }
    };

    const handleSave = (action, savedClient) => {
        setFormModalOpen(false);
        addToast({ message: `Cliente ${action === 'edit' ? 'actualizado' : 'creado'} con éxito.`, type: 'success' });
        fetchData(); // Refetch all data for simplicity
    };
    
    const ClientesList = () => {
        if (clientes.length === 0) {
            return html`
                <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white mt-6">
                    <div class="text-6xl text-gray-300">${ICONS.clients}</div>
                    <h3 class="mt-2 text-lg font-medium text-gray-900">No hay clientes registrados</h3>
                    <p class="mt-1 text-sm text-gray-500">Comienza añadiendo tu primer cliente.</p>
                </div>
            `;
        }
        
        return html`
        <div class="space-y-4 md:hidden mt-6">
            ${clientes.map(c => html`
                <div key=${c.id} class="bg-white p-4 rounded-lg shadow border">
                    <div class="flex items-center space-x-4">
                        <${Avatar} name=${c.nombre} avatarUrl=${c.avatar_url} size="h-12 w-12" />
                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-gray-800 truncate">${c.nombre}</div>
                            <div class="text-sm text-gray-500 truncate">${c.telefono || c.email || 'Sin contacto'}</div>
                        </div>
                        <div class="flex-shrink-0">
                             <button onClick=${() => handleEdit(c)} class="text-gray-400 hover:text-primary p-2 -m-2 rounded-full">${ICONS.edit}</button>
                        </div>
                    </div>
                     <div class="mt-3 pt-3 border-t flex justify-between text-sm">
                        <span class="text-gray-600">Saldo Pendiente:</span>
                        <span class="font-bold ml-2 ${c.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}">
                            Bs ${Number(c.saldo_pendiente || 0).toFixed(2)}
                        </span>
                    </div>
                </div>
            `)}
        </div>

        <div class="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg mt-8">
            <table class="min-w-full divide-y divide-gray-300">
                <thead class="bg-gray-50">
                    <tr>
                        <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Cliente</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Contacto</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Saldo Pendiente</th>
                        <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Acciones</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                    ${clientes.map(c => html`
                        <tr key=${c.id} class="hover:bg-gray-50">
                            <td class="py-4 pl-4 pr-3 text-sm sm:pl-6">
                                <div class="flex items-center">
                                    <div class="h-10 w-10 flex-shrink-0">
                                        <${Avatar} name=${c.nombre} avatarUrl=${c.avatar_url} />
                                    </div>
                                    <div class="ml-4">
                                        <div class="font-medium text-gray-900">${c.nombre}</div>
                                        <div class="text-gray-500">NIT/CI: ${c.nit_ci || 'N/A'}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-3 py-4 text-sm text-gray-500">
                                <div>${c.telefono || 'N/A'}</div>
                                <div class="text-gray-400">${c.email}</div>
                            </td>
                            <td class="px-3 py-4 text-sm font-bold ${c.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}">Bs ${Number(c.saldo_pendiente || 0).toFixed(2)}</td>
                            <td class="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                <div class="flex justify-end gap-2">
                                    <button onClick=${() => handleEdit(c)} class="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                                    <button onClick=${() => handleDelete(c)} class="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-gray-100">${ICONS.delete}</button>
                                </div>
                            </td>
                        </tr>
                    `)}
                </tbody>
            </table>
        </div>
    `;
    };

    const breadcrumbs = [ { name: 'Clientes', href: '#/clientes' } ];

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Clientes"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Clientes</h1>
                    <p class="mt-1 text-sm text-gray-600">Gestiona tu base de datos de clientes y sus cuentas por cobrar.</p>
                </div>
                 <button 
                    onClick=${handleAdd}
                    class="hidden sm:inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
                >
                    ${ICONS.add} Añadir Cliente
                </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                 <${KPI_Card} title="Clientes Totales" value=${kpis.totalClientes} icon=${ICONS.clients} color="primary" />
                 <${KPI_Card} title="Cuentas por Cobrar" value=${`Bs ${kpis.cuentasPorCobrar.toFixed(2)}`} icon=${ICONS.credit_score} color="amber" />
            </div>

            <${ClientesList} />

            <div class="sm:hidden">
                <${FloatingActionButton} onClick=${handleAdd} label="Añadir Cliente" />
            </div>

            <${ClienteFormModal} 
                isOpen=${isFormModalOpen}
                onClose=${() => setFormModalOpen(false)}
                onSave=${handleSave}
                clienteToEdit=${clienteToEdit}
                user=${user}
            />
            
            <${ConfirmationModal}
                isOpen=${isDeleteModalOpen}
                onClose=${() => setDeleteModalOpen(false)}
                onConfirm=${handleConfirmDelete}
                title="Confirmar Eliminación"
                confirmText="Sí, eliminar"
                confirmVariant="danger"
                icon=${ICONS.warning_amber}
            >
                 <p class="text-sm text-gray-600">¿Estás seguro de que quieres eliminar a <span class="font-bold text-gray-800">${clienteToDelete?.nombre}</span>?</p>
            <//>
        <//>
    `;
}