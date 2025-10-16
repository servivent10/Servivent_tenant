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
import { SucursalFormModal } from '../../components/modals/SucursalFormModal.js';
import { Avatar } from '../../components/Avatar.js';

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

const SucursalCard = ({ sucursal, onClick, onEdit, onDelete }) => {
    const GOOGLE_MAPS_API_KEY = 'AIzaSyDcOzOJnV2qJWsXeCGqBfWiORfUa4ZIBtw';
    const staticMapUrl = (sucursal.latitud && sucursal.longitud)
        ? `https://maps.googleapis.com/maps/api/staticmap?center=${sucursal.latitud},${sucursal.longitud}&zoom=15&size=400x300&markers=color:red%7C${sucursal.latitud},${sucursal.longitud}&key=${GOOGLE_MAPS_API_KEY}`
        : null;

    return html`
        <div class="bg-white rounded-lg shadow-md border overflow-hidden transition-shadow hover:shadow-xl flex flex-col">
            {/* Header */}
            <div class="p-4 border-b flex items-center gap-3 bg-gray-50">
                <div class="text-primary text-2xl">${ICONS.storefront}</div>
                <h3 class="text-lg font-bold text-gray-800 truncate" title=${sucursal.nombre}>${sucursal.nombre}</h3>
            </div>

            {/* Body */}
            <div class="p-4 space-y-4 flex-grow cursor-pointer" onClick=${() => onClick(sucursal)}>
                <div>
                    ${staticMapUrl ? html`
                        <img src=${staticMapUrl} alt="Mapa de ${sucursal.nombre}" class="w-full h-40 object-cover rounded-md border" />
                    ` : html`
                        <div class="w-full h-40 flex items-center justify-center bg-slate-100 text-slate-400 rounded-md border">
                            <p>Ubicación no establecida</p>
                        </div>
                    `}
                </div>
                <div class="text-sm space-y-2">
                     <p class="flex items-start gap-2 text-gray-600">
                        <span class="text-gray-400 mt-0.5">${ICONS.storefront}</span>
                        <span class="flex-1">${sucursal.direccion || 'Dirección no especificada'}</span>
                     </p>
                     <p class="flex items-center gap-2 text-gray-500">
                        <span class="text-gray-400">${ICONS.phone}</span>
                        <span>${sucursal.telefono || 'Teléfono no especificado'}</span>
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div class="bg-gray-50 px-5 py-3 border-t">
                <div class="flex items-center justify-between text-sm">
                    <div class="flex items-center gap-2 text-gray-600">
                        ${ICONS.users}
                        <span>${sucursal.user_count} ${sucursal.user_count === 1 ? 'Usuario' : 'Usuarios'}</span>
                    </div>
                    <div class="flex items-center">
                        <button onClick=${(e) => { e.stopPropagation(); onEdit(sucursal); }} class="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-full">${ICONS.edit}</button>
                        <button onClick=${(e) => { e.stopPropagation(); onDelete(sucursal); }} class="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full">${ICONS.delete}</button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

export function SucursalesListPage({ user, onLogout, onProfileUpdate, companyInfo, navigate, notifications }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    
    const [data, setData] = useState({ sucursales: [], kpis: { total_sucursales: 0, total_empleados: 0, propietarios_count: 0, administradores_count: 0, empleados_count: 0 } });
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [sucursalToEdit, setSucursalToEdit] = useState(null);
    const [sucursalToDelete, setSucursalToDelete] = useState(null);

    const planLimits = companyInfo?.planDetails?.limits;
    const maxBranches = planLimits?.max_branches ?? 1;
    const branchCount = data.sucursales.length;
    const atLimit = branchCount >= maxBranches;

    const activeLinkName = user.role === 'Propietario' ? 'Sucursales' : 'Mi Sucursal';

    const fetchData = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_company_sucursales');
            if (error) throw error;

            if (user.role !== 'Propietario' && data.sucursales.user_sucursal_id) {
                navigate(`/sucursales/${data.sucursales.user_sucursal_id}`);
                return;
            }

            setData(data);
        } catch (err) {
            console.error("Error fetching sucursales:", err);
            addToast({ message: `Error al cargar sucursales: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddSucursal = () => {
         if (atLimit) {
            addToast({
                message: 'Has alcanzado el límite de sucursales para tu plan. Actualiza tu suscripción para añadir más.',
                type: 'warning',
                duration: 8000
            });
        } else {
            setSucursalToEdit(null);
            setFormModalOpen(true);
        }
    };

    const handleEditSucursal = (sucursal) => {
        setSucursalToEdit(sucursal);
        setFormModalOpen(true);
    };

    const handleDeleteSucursal = (sucursal) => {
        setSucursalToDelete(sucursal);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!sucursalToDelete) return;
        startLoading();
        setDeleteModalOpen(false);
        try {
            const { error } = await supabase.rpc('delete_sucursal', { p_sucursal_id: sucursalToDelete.id });
            if (error) throw error;
            addToast({ message: `Sucursal "${sucursalToDelete.nombre}" eliminada.`, type: 'success' });
            await fetchData();
        } catch(err) {
            addToast({ message: `Error al eliminar: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
            setSucursalToDelete(null);
        }
    };

    const handleSaveSucursal = (action) => {
        setFormModalOpen(false);
        addToast({ message: `Sucursal ${action === 'edit' ? 'actualizada' : 'creada'} con éxito.`, type: 'success' });
        fetchData();
    };

    const breadcrumbs = [ { name: activeLinkName, href: '#/sucursales' } ];

    if (user.role !== 'Propietario') {
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
                <div class="text-center py-10">
                    <p class="text-gray-600">Redirigiendo a tu sucursal...</p>
                </div>
            <//>
        `;
    }
    
    const kpis = data?.kpis || { total_sucursales: 0, total_empleados: 0, propietarios_count: 0, administradores_count: 0, empleados_count: 0 };

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
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Gestión de Sucursales</h1>
                    <p class="mt-1 text-sm text-gray-600">
                        Administra todas las ubicaciones de tu negocio. 
                        <span class="font-semibold text-primary">${branchCount} de ${maxBranches >= 99999 ? '∞' : maxBranches}</span> sucursales utilizadas.
                    </p>
                </div>
                 <button 
                    onClick=${handleAddSucursal}
                    disabled=${atLimit}
                    title=${atLimit ? 'Has alcanzado el límite de sucursales de tu plan.' : 'Añadir nueva sucursal'}
                    class="hidden sm:inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                    ${ICONS.add} Añadir Sucursal
                </button>
            </div>

            <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 mt-6">
                 <${KPI_Card} title="Total de Sucursales" value=${kpis.total_sucursales || 0} icon=${ICONS.storefront} />
                 <${KPI_Card} 
                    title="Total de Empleados" 
                    value=${kpis.total_empleados || 0} 
                    icon=${ICONS.users}
                    subtext=${html`
                        <div class="flex flex-wrap gap-2 mt-2">
                            <${RolePill} role="Propietario" count=${kpis.propietarios_count} />
                            <${RolePill} role="Administrador" count=${kpis.administradores_count} />
                            <${RolePill} role="Empleado" count=${kpis.empleados_count} />
                        </div>
                    `}
                 />
            </div>
            
            ${data.sucursales.length === 0 ? html`
                 <div class="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 bg-white mt-6">
                    <div class="text-6xl text-gray-300">${ICONS.storefront}</div>
                    <h3 class="mt-2 text-lg font-medium text-gray-900">No hay sucursales registradas</h3>
                    <p class="mt-1 text-sm text-gray-500">Comienza añadiendo la primera sucursal de tu empresa.</p>
                </div>
            ` : html `
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    ${data.sucursales.map(s => html`
                        <${SucursalCard} 
                            sucursal=${s} 
                            onClick=${(suc) => navigate(`/sucursales/${suc.id}`)}
                            onEdit=${handleEditSucursal}
                            onDelete=${handleDeleteSucursal}
                        />
                    `)}
                </div>
            `}

            <div class="sm:hidden">
                <${FloatingActionButton} onClick=${handleAddSucursal} disabled=${atLimit} label="Añadir Sucursal" />
            </div>

            <${SucursalFormModal} 
                isOpen=${isFormModalOpen}
                onClose=${() => setFormModalOpen(false)}
                onSave=${handleSaveSucursal}
                sucursalToEdit=${sucursalToEdit}
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
                <p class="text-sm text-gray-600">¿Estás seguro de que quieres eliminar la sucursal <span class="font-bold text-gray-800">${sucursalToDelete?.nombre}</span>? Esta acción no se puede deshacer.</p>
            <//>

        <//>
    `;
}