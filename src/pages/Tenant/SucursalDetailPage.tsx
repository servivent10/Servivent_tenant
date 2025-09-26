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
import { Tabs } from '../../components/Tabs.js';
import { Avatar } from '../../components/Avatar.js';
import { FloatingActionButton } from '../../components/FloatingActionButton.js';
import { UserFormModal } from '../../components/modals/UserFormModal.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { FormInput } from '../../components/FormComponents.js';
import { ProfileModal } from '../../components/modals/ProfileModal.js';
import { Spinner } from '../../components/Spinner.js';

const RolePill = ({ role, count }) => {
  if (!count || count === 0) return null;

  const styles = {
    Propietario: 'bg-amber-100 text-amber-800 border-amber-200',
    Administrador: 'bg-blue-100 text-blue-800 border-blue-200',
    Empleado: 'bg-slate-100 text-slate-800 border-slate-200',
  };
  const style = styles[role] || styles.Empleado;
  const text = `${count} ${role}${count > 1 ? 's' : ''}`;

  return html`
    <span class="${style} text-xs font-medium inline-flex items-center px-2.5 py-0.5 rounded-full border">
      ${text}
    </span>
  `;
};

// --- User List Component (for this page only) ---
const UserList = ({ users, onEdit, onDelete, currentUser }) => {

    const handleActionClick = (e, actionFn, user) => {
        e?.stopPropagation();
        if (user.rol !== 'Propietario') {
            actionFn(user);
        }
    };

    if (currentUser.role === 'Empleado') {
        const self = users.find(u => u.id === currentUser.id);
        if (!self) return html`<p class="text-gray-500 mt-4">No se pudo cargar tu perfil.</p>`;

        return html`
            <div class="mt-6 max-w-sm mx-auto">
                 <div class="bg-white p-4 rounded-lg shadow border text-center">
                    <${Avatar} name=${self.nombre_completo} avatarUrl=${self.avatar} size="h-24 w-24" className="mx-auto" />
                    <p class="font-bold text-gray-800 text-lg mt-3">${self.nombre_completo}</p>
                    <p class="text-sm text-gray-600">${self.correo}</p>
                    <p class="text-sm text-gray-500 mt-1">${self.rol}</p>
                    <button onClick=${() => onEdit(self)} class="mt-4 w-full flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                        ${ICONS.edit} Editar mi Perfil
                    </button>
                </div>
            </div>
        `;
    }

    if (users.length === 0) {
        return html`
            <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white mt-6">
                <div class="text-6xl text-gray-300">${ICONS.users}</div>
                <h3 class="mt-2 text-lg font-medium text-gray-900">No hay usuarios en esta sucursal</h3>
                <p class="mt-1 text-sm text-gray-500">Añade el primer miembro del equipo para esta ubicación.</p>
            </div>
        `;
    }

    return html`
        <!-- Mobile/Tablet Card View -->
        <div class="space-y-4 sm:hidden mt-6">
            ${users.map(u => html`
                <div key=${u.id} class="bg-white p-4 rounded-lg shadow border">
                    <div class="flex items-center space-x-4">
                        <${Avatar} name=${u.nombre_completo} avatarUrl=${u.avatar} />
                        <div class="flex-1 min-w-0">
                            <p class="font-bold text-gray-800 truncate">${u.nombre_completo}</p>
                            <p class="text-sm text-gray-600 truncate">${u.correo}</p>
                        </div>
                    </div>
                    <div class="mt-3 pt-3 border-t border-gray-200">
                        <span class="text-gray-500 text-sm">Rol: <span class="font-medium text-gray-700">${u.rol}</span></span>
                    </div>
                     <div class="mt-3 flex justify-end space-x-2">
                        <button 
                            onClick=${(e) => handleActionClick(e, onEdit, u)} 
                            title=${u.rol === 'Propietario' ? 'El propietario no se puede editar aquí' : 'Editar'}
                            class="text-gray-500 p-2 rounded-full ${u.rol !== 'Propietario' ? 'hover:text-primary hover:bg-gray-100' : 'opacity-50 cursor-not-allowed'}"
                            disabled=${u.rol === 'Propietario'}>
                            ${ICONS.edit}
                        </button>
                        <button 
                            onClick=${(e) => handleActionClick(e, onDelete, u)}
                            title=${u.rol === 'Propietario' ? 'El propietario no se puede eliminar' : 'Eliminar'}
                            class="text-gray-500 p-2 rounded-full ${u.rol !== 'Propietario' ? 'hover:text-red-600 hover:bg-gray-100' : 'opacity-50 cursor-not-allowed'}"
                            disabled=${u.rol === 'Propietario'}>
                            ${ICONS.delete}
                        </button>
                    </div>
                </div>
            `)}
        </div>

        <!-- Desktop Table View -->
        <div class="hidden sm:block mt-8 flow-root">
             <table class="min-w-full divide-y divide-gray-300">
                <thead>
                    <tr>
                        <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Nombre</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Rol</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha de Ingreso</th>
                        <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0"><span class="sr-only">Acciones</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                    ${users.map(u => html`
                        <tr key=${u.id}>
                            <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-0">
                                <div class="flex items-center">
                                    <${Avatar} name=${u.nombre_completo} avatarUrl=${u.avatar} />
                                    <div class="ml-4">
                                        <div class="font-medium text-gray-900">${u.nombre_completo}</div>
                                        <div class="text-gray-500">${u.correo}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${u.rol}</td>
                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${new Date(u.created_at).toLocaleDateString()}</td>
                            <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                                <div class="flex items-center justify-end space-x-2">
                                    <button 
                                        onClick=${(e) => handleActionClick(e, onEdit, u)} 
                                        title=${u.rol === 'Propietario' ? 'El propietario no se puede editar aquí' : 'Editar'}
                                        class="text-gray-400 p-1 rounded-full ${u.rol !== 'Propietario' ? 'hover:text-primary hover:bg-gray-100' : 'opacity-50 cursor-not-allowed'}"
                                        disabled=${u.rol === 'Propietario'}
                                    >${ICONS.edit}</button>
                                    <button 
                                        onClick=${(e) => handleActionClick(e, onDelete, u)}
                                        title=${u.rol === 'Propietario' ? 'El propietario no se puede eliminar' : 'Eliminar'}
                                        class="text-gray-400 p-1 rounded-full ${u.rol !== 'Propietario' ? 'hover:text-red-600 hover:bg-gray-100' : 'opacity-50 cursor-not-allowed'}"
                                        disabled=${u.rol === 'Propietario'}
                                    >${ICONS.delete}</button>
                                </div>
                            </td>
                        </tr>
                    `)}
                </tbody>
            </table>
        </div>
    `;
};


export function SucursalDetailPage({ sucursalId, user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('usuarios');
    const [isSaving, setIsSaving] = useState(false);
    
    const [isUserFormModalOpen, setUserFormModalOpen] = useState(false);
    const [isUserDeleteModalOpen, setUserDeleteModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null);
    const [userToDelete, setUserToDelete] = useState(null);
    const [isProfileModalOpen, setProfileModalOpen] = useState(false);

    const [branchDetails, setBranchDetails] = useState({ nombre: '', direccion: '', telefono: '' });
    
    const planLimits = companyInfo?.planDetails?.limits;
    const maxUsers = planLimits?.maxUsers ?? 1;
    const totalCompanyUsers = data?.kpis?.total_company_users ?? 0;
    const atUserLimit = totalCompanyUsers >= maxUsers;

    const activeLinkName = user.role === 'Propietario' ? 'Sucursales' : 'Mi Sucursal';

    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_sucursal_details', { p_sucursal_id: sucursalId });
            if (error) throw error;
            setData(data);
            setBranchDetails(data.details);
        } catch (err) {
            console.error("Error fetching sucursal details:", err);
            addToast({ message: `Error al cargar detalles: ${err.message}`, type: 'error' });
            navigate('/sucursales');
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, [sucursalId]);

    const handleDetailsInput = (e) => {
        const { name, value } = e.target;
        setBranchDetails(prev => ({...prev, [name]: value}));
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase.rpc('update_sucursal', {
                p_sucursal_id: sucursalId,
                p_nombre: branchDetails.nombre,
                p_direccion: branchDetails.direccion,
                p_telefono: branchDetails.telefono
            });
            if (error) throw error;
            addToast({ message: 'Detalles de la sucursal actualizados.', type: 'success' });
            fetchData();
        } catch (err) {
            addToast({ message: `Error al guardar: ${err.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddUser = () => {
        if (atUserLimit) {
            addToast({ message: 'Has alcanzado el límite de usuarios de tu plan.', type: 'warning' });
        } else {
            setUserToEdit(null);
            setUserFormModalOpen(true);
        }
    };

    const handleEditUser = (userToEdit) => {
        if (userToEdit.id === user.id && user.role === 'Empleado') {
            setProfileModalOpen(true);
        } else {
            setUserToEdit(userToEdit);
            setUserFormModalOpen(true);
        }
    };

    const handleDeleteUser = (userToDelete) => {
        setUserToDelete(userToDelete);
        setUserDeleteModalOpen(true);
    };

    const handleConfirmDeleteUser = async () => {
        if (!userToDelete) return;
        startLoading();
        setUserDeleteModalOpen(false);
        try {
            const { error: functionError } = await supabase.functions.invoke('delete-company-user', {
                body: { p_user_id_to_delete: userToDelete.id },
            });

            if (functionError) {
                let friendlyError = functionError.message;
                if (functionError.context && typeof functionError.context.json === 'function') {
                    try {
                        const errorData = await functionError.context.json();
                        if (errorData.error) { friendlyError = errorData.error; }
                    } catch (e) { /* ignore json parsing error */ }
                }
                throw new Error(friendlyError);
            }

            addToast({ message: `Usuario eliminado.`, type: 'success' });
            await fetchData();

        } catch (err) {
            console.error('Error deleting user:', err);
            addToast({ message: `Error al eliminar: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
            setUserToDelete(null);
        }
    };

    const handleSaveUser = (action) => {
        setUserFormModalOpen(false);
        addToast({ message: `Usuario ${action === 'edit' ? 'actualizado' : 'creado'} con éxito.`, type: 'success' });
        fetchData();
    };


    if (!data) {
        return html`<${DashboardLayout} user=${user} onLogout=${onLogout} onProfileUpdate=${onProfileUpdate} activeLink=${activeLinkName} />`;
    }

    const breadcrumbs = user.role === 'Propietario'
        ? [ { name: 'Sucursales', href: '#/sucursales' }, { name: data.details.nombre, href: `#/sucursales/${sucursalId}` } ]
        : [ { name: 'Mi Sucursal', href: `#/sucursales/${sucursalId}` } ];
    
    const tabs = [
        { id: 'usuarios', label: 'Gestión de Usuarios' },
        { id: 'detalles', label: 'Detalles' },
    ];
    
    if(user.role === 'Empleado') {
        tabs.pop(); 
    }
    
    const kpis = data.kpis || {};
    const userCountInBranch = data?.users?.length || 0;


    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink=${activeLinkName}
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="flex items-center gap-4 mb-4">
                ${user.role === 'Propietario' && html`
                    <button onClick=${() => navigate('/sucursales')} class="p-2 rounded-full hover:bg-gray-200" aria-label="Volver">
                        ${ICONS.arrow_back}
                    </button>
                `}
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">${data.details.nombre}</h1>
                    <p class="text-sm text-gray-600">${data.details.direccion}</p>
                </div>
            </div>

            <${Tabs} tabs=${tabs} activeTab=${activeTab} onTabClick=${setActiveTab} />

            <div class="mt-6">
                ${activeTab === 'usuarios' && html`
                    <div>
                        ${user.role !== 'Empleado' && html`
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                                <${KPI_Card} 
                                    title="Equipo en esta Sucursal"
                                    value=${`${userCountInBranch} ${userCountInBranch === 1 ? 'Miembro' : 'Miembros'}`}
                                    icon=${ICONS.users}
                                    color='primary'
                                    subtext=${html`
                                        <div class="flex flex-wrap gap-2 mt-2">
                                            <${RolePill} role="Propietario" count=${kpis.propietarios_count} />
                                            <${RolePill} role="Administrador" count=${kpis.administradores_count} />
                                            <${RolePill} role="Empleado" count=${kpis.empleados_count} />
                                        </div>
                                    `}
                                />
                                <${KPI_Card} 
                                    title="Uso Total de Usuarios"
                                    value=${`${totalCompanyUsers} de ${maxUsers === Infinity ? '∞' : maxUsers}`}
                                    icon=${ICONS.building}
                                    color=${atUserLimit ? 'amber' : 'green'}
                                    subtext="Límite total del plan de la empresa."
                                />
                            </div>
                        `}
                         <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h2 class="text-xl font-semibold text-gray-800">Equipo de la Sucursal</h2>
                                ${user.role !== 'Empleado' && html`
                                <p class="mt-1 text-sm text-gray-600">
                                    Gestiona los miembros del equipo asignados a esta ubicación.
                                </p>`}
                            </div>
                            ${user.role !== 'Empleado' && html`
                            <button 
                                onClick=${handleAddUser}
                                disabled=${atUserLimit}
                                class="hidden sm:inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:bg-slate-400"
                            >
                                ${ICONS.add} Añadir Usuario
                            </button>
                            `}
                        </div>
                        <${UserList} users=${data.users} onEdit=${handleEditUser} onDelete=${handleDeleteUser} currentUser=${user} />
                    </div>
                `}
                ${activeTab === 'detalles' && html`
                    <div class="max-w-xl">
                        <h2 class="text-xl font-semibold text-gray-800">Información de la Sucursal</h2>
                        <div class="mt-4 p-6 bg-white rounded-lg shadow border space-y-4">
                            <${FormInput} label="Nombre" name="nombre" type="text" value=${branchDetails.nombre} onInput=${handleDetailsInput} />
                            <${FormInput} label="Dirección" name="direccion" type="text" value=${branchDetails.direccion} onInput=${handleDetailsInput} required=${false} />
                            <${FormInput} label="Teléfono" name="telefono" type="tel" value=${branchDetails.telefono} onInput=${handleDetailsInput} required=${false} />
                        </div>
                        <div class="mt-4 flex justify-end">
                            <button onClick=${handleSaveChanges} disabled=${isSaving} class="flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50 min-w-[120px]">
                                ${isSaving ? html`<${Spinner}/>` : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                `}
            </div>

            ${activeTab === 'usuarios' && user.role !== 'Empleado' && html`
                <div class="sm:hidden">
                    <${FloatingActionButton} onClick=${handleAddUser} disabled=${atUserLimit} label="Añadir Usuario" />
                </div>
            `}
            
            <${UserFormModal}
                isOpen=${isUserFormModalOpen}
                onClose=${() => setUserFormModalOpen(false)}
                onSave=${handleSaveUser}
                userToEdit=${userToEdit}
                branches=${[{id: sucursalId, nombre: data.details.nombre}]}
                currentUser=${user}
            />

            <${ConfirmationModal}
                isOpen=${isUserDeleteModalOpen}
                onClose=${() => setUserDeleteModalOpen(false)}
                onConfirm=${handleConfirmDeleteUser}
                title="Confirmar Eliminación"
                confirmText="Sí, eliminar"
                confirmVariant="danger"
                icon=${ICONS.warning_amber}
            >
                <p class="text-sm text-gray-600">¿Estás seguro de que quieres eliminar a <span class="font-bold text-gray-800">${userToDelete?.nombre_completo}</span>?</p>
            <//>
            
            <${ProfileModal} 
                isOpen=${isProfileModalOpen}
                onClose=${() => setProfileModalOpen(false)}
                user=${user}
                onProfileUpdate=${(updatedData) => {
                    onProfileUpdate(updatedData);
                    fetchData();
                }}
            />
        <//>
    `;
}