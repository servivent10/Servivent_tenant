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
import { FloatingActionButton } from '../../components/FloatingActionButton.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { CategoryFormModal } from '../../components/modals/CategoryFormModal.js';

const CategoryList = ({ categories, onEdit, onDelete }) => {
    if (categories.length === 0) {
        return html`
            <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white mt-6">
                <div class="text-6xl text-gray-300">${ICONS.category}</div>
                <h3 class="mt-2 text-lg font-medium text-gray-900">No hay categorías registradas</h3>
                <p class="mt-1 text-sm text-gray-500">Comienza creando tu primera categoría para organizar tus productos.</p>
            </div>
        `;
    }

    return html`
        <!-- Vista de tarjetas para móvil y tablet -->
        <div class="space-y-4 md:hidden mt-6">
            ${categories.map(cat => html`
                <div class="bg-white p-4 rounded-lg shadow border">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-bold text-gray-800">${cat.nombre}</div>
                            <div class="text-sm text-gray-600">${cat.product_count} ${cat.product_count === 1 ? 'producto' : 'productos'}</div>
                        </div>
                        <div class="flex items-center">
                            <button onClick=${() => onEdit(cat)} title="Editar" class="text-gray-400 hover:text-primary p-2 -m-2 rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                            <button onClick=${() => onDelete(cat)} title="Eliminar" class="text-gray-400 hover:text-red-600 p-2 -m-2 rounded-full hover:bg-gray-100">${ICONS.delete}</button>
                        </div>
                    </div>
                </div>
            `)}
        </div>

        <!-- Vista de tabla para escritorio -->
        <div class="hidden md:block mt-8 flow-root">
             <table class="min-w-full divide-y divide-gray-300">
                <thead>
                    <tr>
                        <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Nombre de la Categoría</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Nº de Productos</th>
                        <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0"><span class="sr-only">Acciones</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                    ${categories.map(cat => html`
                        <tr key=${cat.id}>
                            <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">${cat.nombre}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${cat.product_count}</td>
                            <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                                <div class="flex items-center justify-end space-x-2">
                                    <button onClick=${() => onEdit(cat)} title="Editar" class="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                                    <button onClick=${() => onDelete(cat)} title="Eliminar" class="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-gray-100">${ICONS.delete}</button>
                                </div>
                            </td>
                        </tr>
                    `)}
                </tbody>
            </table>
        </div>
    `;
};

export function CategoriasPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    
    const [categories, setCategories] = useState([]);
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState(null);
    const [categoryToDelete, setCategoryToDelete] = useState(null);

    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_all_categories_with_product_count');
            if (error) throw error;
            setCategories(data);
        } catch (err) {
            console.error("Error fetching categories:", err);
            addToast({ message: `Error al cargar categorías: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAdd = () => {
        setCategoryToEdit(null);
        setFormModalOpen(true);
    };

    const handleEdit = (category) => {
        setCategoryToEdit(category);
        setFormModalOpen(true);
    };

    const handleDelete = (category) => {
        setCategoryToDelete(category);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!categoryToDelete) return;
        
        if (categoryToDelete.product_count > 0) {
            addToast({ message: 'No se puede eliminar una categoría que tiene productos asignados.', type: 'error' });
            setDeleteModalOpen(false);
            return;
        }

        startLoading();
        setDeleteModalOpen(false);
        try {
            const { error } = await supabase.rpc('delete_category', { p_id: categoryToDelete.id });
            if (error) throw error;
            addToast({ message: `Categoría "${categoryToDelete.nombre}" eliminada.`, type: 'success' });
            await fetchData();
        } catch(err) {
            addToast({ message: `Error al eliminar: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
            setCategoryToDelete(null);
        }
    };

    const handleSave = (action) => {
        setFormModalOpen(false);
        addToast({ message: `Categoría ${action === 'edit' ? 'actualizada' : 'creada'} con éxito.`, type: 'success' });
        fetchData();
    };

    const breadcrumbs = [ { name: 'Categorías', href: '#/categorias' } ];
    const totalProducts = categories.reduce((sum, cat) => sum + cat.product_count, 0);

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Categorías"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Gestión de Categorías</h1>
                    <p class="mt-1 text-sm text-gray-600">Organiza tus productos en categorías para una mejor gestión y filtrado.</p>
                </div>
                 <button 
                    onClick=${handleAdd}
                    class="hidden sm:inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
                >
                    ${ICONS.add} Crear Categoría
                </button>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                 <${KPI_Card} title="Categorías Totales" value=${categories.length} icon=${ICONS.category} color="primary" />
                 <${KPI_Card} title="Productos Categorizados" value=${totalProducts} icon=${ICONS.products} color="green" />
            </div>

            <${CategoryList} categories=${categories} onEdit=${handleEdit} onDelete=${handleDelete} />

            <div class="sm:hidden">
                <${FloatingActionButton} onClick=${handleAdd} label="Crear Categoría" />
            </div>

            <${CategoryFormModal} 
                isOpen=${isFormModalOpen}
                onClose=${() => setFormModalOpen(false)}
                onSave=${handleSave}
                categoryToEdit=${categoryToEdit}
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
                <p class="text-sm text-gray-600">¿Estás seguro de que quieres eliminar la categoría <span class="font-bold text-gray-800">${categoryToDelete?.nombre}</span>?</p>
                ${categoryToDelete?.product_count > 0 && html`
                    <div class="mt-4 p-3 rounded-md bg-red-50 text-red-800 border border-red-200">
                        <p class="font-bold">Acción bloqueada</p>
                        <p class="text-sm">Esta categoría no puede ser eliminada porque contiene ${categoryToDelete.product_count} productos. Por favor, reasigna esos productos a otra categoría primero.</p>
                    </div>
                `}
            <//>
        <//>
    `;
}