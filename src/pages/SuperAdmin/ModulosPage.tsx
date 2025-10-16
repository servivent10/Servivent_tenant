/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { Spinner } from '../../components/Spinner.js';
import { ModuloFormModal } from '../../components/modals/ModuloFormModal.js';
import { FloatingActionButton } from '../../components/FloatingActionButton.js';

export function ModulosPage({ user, onLogout, navigate, onProfileUpdate }) {
    const { startLoading, stopLoading, isLoading } = useLoading();
    const { addToast } = useToast();
    const [modules, setModules] = useState([]);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [moduleToEdit, setModuleToEdit] = useState(null);

    const sidebarLinks = [
        { name: 'Gestionar Empresas', href: '#/superadmin', icon: ICONS.building },
        { name: 'Gestión de Planes', href: '#/superadmin/planes', icon: ICONS.credit_score },
        { name: 'Gestión de Módulos', href: '#/superadmin/modulos', icon: ICONS.bolt },
        { name: 'Licencias y Pagos', href: '#', icon: ICONS.chart },
    ];
    const breadcrumbs = [ { name: 'SuperAdmin', href: '#/superadmin' }, { name: 'Módulos', href: '#/superadmin/modulos' }];

    const fetchData = useCallback(async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_all_modulos_management');
            if (error) throw error;
            setModules(data || []);
        } catch (err) {
            addToast({ message: `Error al cargar módulos: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (module) => {
        setModuleToEdit(module);
        setIsFormModalOpen(true);
    };
    
    const handleAdd = () => {
        setModuleToEdit(null);
        setIsFormModalOpen(true);
    };

    const handleSave = () => {
        setIsFormModalOpen(false);
        fetchData();
    };

    return html`
        <${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} sidebarLinks=${sidebarLinks} activeLink="Gestión de Módulos" breadcrumbs=${breadcrumbs}>
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Gestión de Módulos (Add-ons)</h1>
                    <p class="mt-1 text-sm text-gray-600">Crea y edita las funcionalidades opcionales que las empresas pueden contratar.</p>
                </div>
                <button onClick=${handleAdd} class="hidden sm:flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                    ${ICONS.add} Crear Nuevo Módulo
                </button>
            </div>

            <div class="mt-8">
                ${isLoading && !modules.length ? html`<div class="flex justify-center"><${Spinner}/></div>` : 
                    modules.length === 0 ? html`
                        <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white">
                            <div class="text-6xl text-gray-300">${ICONS.bolt}</div>
                            <h3 class="mt-2 text-lg font-medium text-gray-900">No hay módulos creados</h3>
                            <p class="mt-1 text-sm text-gray-500">Comienza creando el primer módulo adicional para el sistema.</p>
                        </div>
                    ` : html`
                    <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                        <table class="min-w-full divide-y divide-gray-300">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Nombre del Módulo</th>
                                    <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Código Interno</th>
                                    <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Precio Mensual (USD)</th>
                                    <th class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                             <tbody class="divide-y divide-gray-200 bg-white">
                                ${modules.map(mod => html`
                                    <tr key=${mod.id} class="hover:bg-gray-50">
                                        <td class="py-4 pl-4 pr-3 text-sm sm:pl-6">
                                            <div class="font-medium text-gray-900">${mod.nombre_visible}</div>
                                            <div class="text-gray-500 truncate max-w-xs" title=${mod.descripcion}>${mod.descripcion}</div>
                                        </td>
                                        <td class="px-3 py-4 text-sm text-gray-500 font-mono text-xs">${mod.codigo_interno}</td>
                                        <td class="px-3 py-4 text-sm text-gray-500">$ ${Number(mod.precio_mensual || 0).toFixed(2)}</td>
                                        <td class="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                            <button onClick=${() => handleEdit(mod)} class="text-primary hover:text-primary-dark">Editar</button>
                                        </td>
                                    </tr>
                                `)}
                             </tbody>
                        </table>
                    </div>
                    `
                }
            </div>
            
            <div class="lg:hidden">
                <${FloatingActionButton} onClick=${handleAdd} label="Crear Módulo" />
            </div>

            <${ModuloFormModal} isOpen=${isFormModalOpen} onClose=${() => setIsFormModalOpen(false)} onSave=${handleSave} moduleToEdit=${moduleToEdit} />
        <//>
    `;
}