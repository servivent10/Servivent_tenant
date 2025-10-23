/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { supabase } from '../../lib/supabaseClient.js';
import { ClienteFormModal } from '../../components/modals/ClienteFormModal.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { Avatar } from '../../components/Avatar.js';
import { ImportClientesModal } from '../../components/modals/ImportClientesModal.js';

export function ClientesPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const [clientes, setClientes] = useState([]);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [clienteToEdit, setClienteToEdit] = useState(null);
    const [clienteToDelete, setClienteToDelete] = useState(null);
    const [isFabOpen, setIsFabOpen] = useState(false);
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();

    const formatCurrency = (value) => {
        const number = Number(value || 0);
        const formattedNumber = number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${companyInfo.monedaSimbolo} ${formattedNumber}`;
    };

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
        setIsFabOpen(false);
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
        setDeleteModalOpen(false);
        try {
            const { error } = await supabase.functions.invoke('delete-client-with-auth', {
                body: { clientId: clienteToDelete.id }
            });

            if (error) {
                if (error.context && typeof error.context.json === 'function') {
                    const errorData = await error.context.json();
                    throw new Error(errorData.error || error.message);
                }
                throw error;
            }
            addToast({ message: `Cliente "${clienteToDelete.nombre}" eliminado.`, type: 'success' });
            fetchData();
        } catch(err) {
             addToast({ message: `Error al eliminar: ${err.message}`, type: 'error', duration: 8000 });
        } finally {
            stopLoading();
            setClienteToDelete(null);
        }
    };

    const handleSave = (action, savedClient) => {
        setFormModalOpen(false);
        addToast({ message: `Cliente ${action === 'edit' ? 'actualizado' : 'creado'} con éxito.`, type: 'success' });
        fetchData();
    };

    const escapeCsvCell = (cell) => {
        const strCell = cell === null || cell === undefined ? '' : String(cell);
        if (strCell.includes(',') || strCell.includes('"') || strCell.includes('\n')) {
            return `"${strCell.replace(/"/g, '""')}"`;
        }
        return strCell;
    };
    
    const handleExportCSV = () => {
        if (clientes.length === 0) {
            addToast({ message: 'No hay clientes para exportar.', type: 'info' });
            return;
        }
        const headers = ['nombre', 'nit_ci', 'telefono', 'correo', 'direccion', 'saldo_pendiente'];
        const csvRows = [
            headers.join(','),
            ...clientes.map(c => headers.map(h => escapeCsvCell(c[h])).join(','))
        ];
        
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "clientes_servivent.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast({ message: 'Exportación iniciada.', type: 'success' });
    };
    
    const ClientesList = () => {
        if (clientes.length === 0) {
            return html`
                <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white mt-6">
                    <div class="text-6xl text-gray-300">${ICONS.clients}</div>
                    <h3 class="mt-2 text-lg font-medium text-gray-900">No hay clientes registrados</h3>
                    <p class="mt-1 text-sm text-gray-500">Comienza añadiendo tu primer cliente o impórtalos desde un archivo CSV.</p>
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
                            <div class="font-bold text-gray-800 truncate flex items-center gap-2">
                                <span>${c.nombre}</span>
                                ${c.auth_user_id && html`<span title="Cliente con cuenta web" class="text-primary">${ICONS.bolt}</span>`}
                            </div>
                            <div class="text-sm text-gray-500 truncate mt-1">${c.telefono || c.correo || 'Sin contacto'}</div>
                        </div>
                        <div class="flex-shrink-0">
                             <button onClick=${() => handleEdit(c)} class="text-gray-400 hover:text-primary p-2 -m-2 rounded-full">${ICONS.edit}</button>
                        </div>
                    </div>
                     <div class="mt-3 pt-3 border-t flex justify-between text-sm">
                        <span class="text-gray-600">Saldo Pendiente:</span>
                        <span class="font-bold ml-2 ${c.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}">
                            ${formatCurrency(c.saldo_pendiente)}
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
                                        <div class="font-medium text-gray-900 flex items-center gap-2">
                                            <span>${c.nombre}</span>
                                            ${c.auth_user_id && html`<span title="Cliente con cuenta web" class="text-primary">${ICONS.bolt}</span>`}
                                        </div>
                                        <div class="text-gray-500">NIT/CI: ${c.nit_ci || 'N/A'}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-3 py-4 text-sm text-gray-500">
                                <div>${c.telefono || 'N/A'}</div>
                                <div class="text-gray-400">${c.correo}</div>
                            </td>
                            <td class="px-3 py-4 text-sm font-bold ${c.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}">${formatCurrency(c.saldo_pendiente)}</td>
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
                 <div class="hidden sm:flex items-center gap-2">
                    <button onClick=${handleExportCSV} class="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">${ICONS.download} Exportar</button>
                    <button onClick=${() => setImportModalOpen(true)} class="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">${ICONS.upload_file} Importar</button>
                    <button onClick=${handleAdd} class="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">${ICONS.add} Añadir Cliente</button>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                 <${KPI_Card} title="Clientes Totales" value=${kpis.totalClientes} icon=${ICONS.clients} color="primary" />
                 <${KPI_Card} title="Cuentas por Cobrar" value=${formatCurrency(kpis.cuentasPorCobrar)} icon=${ICONS.credit_score} color="amber" />
            </div>

            <${ClientesList} />

            <div class="sm:hidden fixed bottom-6 right-6 z-30 flex flex-col-reverse items-end gap-4">
                <button onClick=${() => setIsFabOpen(prev => !prev)} class="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 focus:outline-none z-10" aria-expanded=${isFabOpen} aria-label="Abrir menú de acciones">
                    <div class="transform transition-transform duration-300 ${isFabOpen ? 'rotate-45' : 'rotate-0'}">${ICONS.add}</div>
                </button>
                <div class="flex flex-col items-end gap-3 transition-all duration-300 ease-in-out ${isFabOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}">
                    <button onClick=${handleAdd} class="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold hover:bg-gray-50">Añadir Cliente ${ICONS.add_circle}</button>
                    <button onClick=${() => { setImportModalOpen(true); setIsFabOpen(false); }} class="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold hover:bg-gray-50">Importar ${ICONS.upload_file}</button>
                    <button onClick=${handleExportCSV} class="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg shadow-lg text-sm font-semibold hover:bg-gray-50">Exportar ${ICONS.download}</button>
                </div>
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
                 <p class="text-sm text-gray-600">¿Estás seguro de que quieres eliminar a <span class="font-bold text-gray-800">${clienteToDelete?.nombre}</span>? Si este cliente tiene una cuenta web, también será eliminada. Esta acción no se puede deshacer.</p>
            <//>

            <${ImportClientesModal}
                isOpen=${isImportModalOpen}
                onClose=${() => setImportModalOpen(false)}
                onImportSuccess=${fetchData}
            />
        <//>
    `;
}