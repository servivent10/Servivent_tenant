/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { supabase } from '../../lib/supabaseClient.js';
import { useToast } from '../../hooks/useToast.js';
import { useLoading } from '../../hooks/useLoading.js';
import { Spinner } from '../../components/Spinner.js';
import { PlanFormModal } from '../../components/modals/PlanFormModal.js';
import { FloatingActionButton } from '../../components/FloatingActionButton.js';

export function PlanesPage({ user, onLogout, navigate, onProfileUpdate }) {
    const { startLoading, stopLoading, isLoading } = useLoading();
    const { addToast } = useToast();
    const [plans, setPlans] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState(null);

    // State for drag-and-drop reordering
    const [originalOrder, setOriginalOrder] = useState([]);
    const [draggedItemIndex, setDraggedItemIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [isSavingOrder, setIsSavingOrder] = useState(false);

    const sidebarLinks = [
        { name: 'Gestionar Empresas', href: '#/superadmin', icon: ICONS.building },
        { name: 'Gestión de Planes', href: '#/superadmin/planes', icon: ICONS.credit_score },
        { name: 'Gestión de Módulos', href: '#/superadmin/modulos', icon: ICONS.bolt },
        { name: 'Licencias y Pagos', href: '#', icon: ICONS.chart },
    ];
    const breadcrumbs = [ { name: 'SuperAdmin', href: '#/superadmin' }, { name: 'Planes', href: '#/superadmin/planes' }];

    const fetchData = useCallback(async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_all_plans_management');
            if (error) throw error;
            const sortedPlans = data || [];
            setPlans(sortedPlans);
            setOriginalOrder(sortedPlans.map(p => p.id));
        } catch (err) {
            addToast({ message: `Error al cargar planes: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const isOrderChanged = useMemo(() => 
        JSON.stringify(plans.map(p => p.id)) !== JSON.stringify(originalOrder),
        [plans, originalOrder]
    );

    const handleDragStart = (e, index) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (index !== dragOverIndex) {
            setDragOverIndex(index);
        }
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        const draggedItem = plans[draggedItemIndex];
        const newPlans = [...plans];
        newPlans.splice(draggedItemIndex, 1);
        newPlans.splice(dropIndex, 0, draggedItem);
        setPlans(newPlans);
        setDraggedItemIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
        setDragOverIndex(null);
    };

    const handleSaveOrder = async () => {
        setIsSavingOrder(true);
        try {
            const planIdsInOrder = plans.map(p => p.id);
            const { error } = await supabase.rpc('update_plan_order', { p_plan_ids: planIdsInOrder });
            if (error) throw error;
            addToast({ message: 'Orden de planes guardado con éxito.', type: 'success' });
            setOriginalOrder(planIdsInOrder);
        } catch (err) {
            addToast({ message: `Error al guardar el orden: ${err.message}`, type: 'error' });
            // Revert UI on error
            setPlans(prevPlans => {
                const originalPlansMap = new Map(prevPlans.map(p => [p.id, p]));
                return originalOrder.map(id => originalPlansMap.get(id));
            });
        } finally {
            setIsSavingOrder(false);
        }
    };


    const handleEdit = (planId) => {
        setSelectedPlanId(planId);
        setIsModalOpen(true);
    };
    
    const handleAdd = () => {
        setSelectedPlanId(null);
        setIsModalOpen(true);
    };

    const handleSave = () => {
        setIsModalOpen(false);
        fetchData();
    };

    return html`
        <${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} sidebarLinks=${sidebarLinks} activeLink="Gestión de Planes" breadcrumbs=${breadcrumbs}>
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Gestión de Planes y Características</h1>
                    <p class="mt-1 text-sm text-gray-600">Define los planes de suscripción, precios y las funcionalidades de cada uno.</p>
                </div>
                <div class="flex items-center gap-2">
                    ${isOrderChanged && html`
                        <button onClick=${handleSaveOrder} disabled=${isSavingOrder} class="hidden sm:flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:bg-slate-400">
                            ${isSavingOrder ? html`<${Spinner} />` : 'Guardar Orden'}
                        </button>
                    `}
                    <button onClick=${handleAdd} class="hidden sm:flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                        ${ICONS.add} Crear Nuevo Plan
                    </button>
                </div>
            </div>

            <div class="mt-8">
                ${isLoading && !plans.length ? html`<div class="flex justify-center"><${Spinner}/></div>` : 
                    html`
                    <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                        <table class="min-w-full divide-y divide-gray-300">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 w-12"><span class="sr-only">Ordenar</span></th>
                                    <th class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Nombre del Plan</th>
                                    <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Precio Mensual (USD)</th>
                                    <th class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                                    <th class="relative py-3.5 pl-3 pr-4 sm:pr-6"><span class="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                             <tbody class="divide-y divide-gray-200 bg-white">
                                ${plans.map((plan, index) => html`
                                    <tr 
                                        key=${plan.id}
                                        draggable="true"
                                        onDragStart=${(e) => handleDragStart(e, index)}
                                        onDragOver=${(e) => handleDragOver(e, index)}
                                        onDrop=${(e) => handleDrop(e, index)}
                                        onDragEnd=${handleDragEnd}
                                        onDragLeave=${() => setDragOverIndex(null)}
                                        class=${`transition-all duration-150 ${draggedItemIndex === index ? 'opacity-50 bg-slate-100' : ''} ${dragOverIndex === index ? 'border-t-2 border-primary' : ''}`}
                                    >
                                        <td class="py-4 pl-4 pr-3 text-sm text-gray-400 sm:pl-6 cursor-move">${ICONS.drag_handle}</td>
                                        <td class="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">${plan.nombre}</td>
                                        <td class="px-3 py-4 text-sm text-gray-500">$ ${Number(plan.precio_mensual || 0).toFixed(2)}</td>
                                        <td class="px-3 py-4 text-sm text-gray-500">
                                            ${plan.es_publico && html`<span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Público</span>`}
                                            ${plan.es_recomendado && html`<span class="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">Recomendado</span>`}
                                        </td>
                                        <td class="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                            <button onClick=${() => handleEdit(plan.id)} class="text-primary hover:text-primary-dark">Editar</button>
                                        </td>
                                    </tr>
                                `)}
                             </tbody>
                        </table>
                    </div>
                    `
                }
            </div>
            
            <${PlanFormModal} isOpen=${isModalOpen} onClose=${() => setIsModalOpen(false)} onSave=${handleSave} planId=${selectedPlanId} />

            <div class="lg:hidden mt-4 space-y-2">
                 ${isOrderChanged && html`
                    <button onClick=${handleSaveOrder} disabled=${isSavingOrder} class="w-full flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:bg-slate-400">
                        ${isSavingOrder ? html`<${Spinner} />` : 'Guardar Orden'}
                    </button>
                `}
                <${FloatingActionButton} onClick=${handleAdd} label="Crear Plan" />
            </div>
        <//>
    `;
}
