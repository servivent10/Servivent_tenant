/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { KPI_Card } from '../../components/KPI_Card.js';
import { FloatingActionButton } from '../../components/FloatingActionButton.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { supabase } from '../../lib/supabaseClient.js';
import { ProveedorFormModal } from '../../components/modals/ProveedorFormModal.js';

export function ProveedoresPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const [proveedores, setProveedores] = useState([]);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [proveedorToEdit, setProveedorToEdit] = useState(null);
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();

    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_company_providers');
            if (error) throw error;
            setProveedores(data);
        } catch (err) {
            addToast({ message: `Error al cargar proveedores: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const kpis = {
        totalProveedores: proveedores.length,
        deudaTotal: proveedores.reduce((sum, p) => sum + Number(p.saldo_pendiente || 0), 0),
    };

    const handleAdd = () => {
        setProveedorToEdit(null);
        setFormModalOpen(true);
    };

    const handleEdit = (proveedor) => {
        setProveedorToEdit(proveedor);
        setFormModalOpen(true);
    };

    const handleSave = (action, newId) => {
        setFormModalOpen(false);
        addToast({ message: `Proveedor ${action === 'edit' ? 'actualizado' : 'creado'} con éxito.`, type: 'success' });
        fetchData();
    };
    
    const ProveedoresList = () => html`
        <div class="space-y-4 md:hidden">
            ${proveedores.map(p => html`
                <div key=${p.id} class="bg-white p-4 rounded-lg shadow border">
                    <div class="flex justify-between items-start">
                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-gray-800 truncate">${p.nombre}</div>
                            <div class="text-sm text-gray-500 truncate">${p.nombre_contacto || 'Sin contacto'}</div>
                            <div class="text-sm text-gray-600 mt-1">NIT: ${p.nit}</div>
                        </div>
                        <button onClick=${() => handleEdit(p)} class="text-gray-400 hover:text-primary p-1 rounded-full">${ICONS.edit}</button>
                    </div>
                    <div class="mt-2 pt-2 border-t text-sm">
                        <span class="text-gray-600">Saldo Pendiente:</span>
                        <span class="font-bold ml-2 ${p.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}">
                            Bs ${Number(p.saldo_pendiente || 0).toFixed(2)}
                        </span>
                    </div>
                </div>
            `)}
        </div>

        <div class="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
            <table class="min-w-full divide-y divide-gray-300">
                <thead class="bg-gray-50">
                    <tr>
                        <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Proveedor</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Contacto</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Saldo Pendiente</th>
                        <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Acciones</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                    ${proveedores.map(p => html`
                        <tr key=${p.id} class="hover:bg-gray-50">
                            <td class="py-4 pl-4 pr-3 text-sm sm:pl-6">
                                <div class="font-medium text-gray-900">${p.nombre}</div>
                                <div class="text-gray-500">NIT: ${p.nit}</div>
                            </td>
                            <td class="px-3 py-4 text-sm text-gray-500">
                                <div>${p.nombre_contacto || 'N/A'}</div>
                                <div class="text-gray-400">${p.email}</div>
                            </td>
                            <td class="px-3 py-4 text-sm font-bold ${p.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}">Bs ${Number(p.saldo_pendiente || 0).toFixed(2)}</td>
                            <td class="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                <button onClick=${() => handleEdit(p)} class="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                            </td>
                        </tr>
                    `)}
                </tbody>
            </table>
        </div>
    `;

    const breadcrumbs = [ { name: 'Proveedores', href: '#/proveedores' } ];

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Proveedores"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Proveedores</h1>
                    <p class="mt-1 text-sm text-gray-600">Administra la información de tus proveedores y sus cuentas por pagar.</p>
                </div>
                 <button 
                    onClick=${handleAdd}
                    class="hidden sm:inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
                >
                    ${ICONS.add} Añadir Proveedor
                </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                 <${KPI_Card} title="Proveedores Activos" value=${kpis.totalProveedores} icon=${ICONS.suppliers} color="primary" />
                 <${KPI_Card} title="Deuda Total a Proveedores" value=${`Bs ${kpis.deudaTotal.toFixed(2)}`} icon=${ICONS.credit_score} color="amber" />
            </div>

            <div class="mt-8">
                <${ProveedoresList} />
            </div>

            <div class="sm:hidden">
                <${FloatingActionButton} onClick=${handleAdd} label="Añadir Proveedor" />
            </div>

            <${ProveedorFormModal} 
                isOpen=${isFormModalOpen}
                onClose=${() => setFormModalOpen(false)}
                onSave=${handleSave}
                proveedorToEdit=${proveedorToEdit}
            />
        <//>
    `;
}