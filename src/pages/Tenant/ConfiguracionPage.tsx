/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef, useMemo, useCallback } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { FormInput } from '../../components/FormComponents.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { Spinner } from '../../components/Spinner.js';
import { useLoading } from '../../hooks/useLoading.js';
import { Tabs } from '../../components/Tabs.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { FloatingActionButton } from '../../components/FloatingActionButton.js';


function PriceListModal({ isOpen, onClose, onSave, listToEdit }) {
    const isEditMode = Boolean(listToEdit);
    const [formData, setFormData] = useState({ nombre: '', descripcion: '' });
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setFormData({
                nombre: isEditMode ? listToEdit.nombre : '',
                descripcion: isEditMode ? listToEdit.descripcion : '',
            });
        }
    }, [isOpen, listToEdit]);

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleConfirm = async () => {
        if (!formData.nombre.trim()) {
            addToast({ message: 'El nombre de la lista de precios es obligatorio.', type: 'error' });
            return;
        }
        setIsLoading(true);
        try {
            const { error } = await supabase.rpc('upsert_price_list', {
                p_id: isEditMode ? listToEdit.id : null,
                p_nombre: formData.nombre,
                p_descripcion: formData.descripcion
            });
            if (error) throw error;
            onSave();
        } catch (err) {
            addToast({ message: `Error al guardar: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const title = isEditMode ? 'Editar Lista de Precios' : 'Crear Lista de Precios';
    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : 'Guardar'}
            icon=${ICONS.dollar}
        >
            <div class="space-y-4">
                <${FormInput} label="Nombre" name="nombre" type="text" value=${formData.nombre} onInput=${handleInput} />
                <${FormInput} label="Descripción (Opcional)" name="descripcion" type="text" value=${formData.descripcion} onInput=${handleInput} required=${false} />
            </div>
        <//>
    `;
}


function PriceListsTab() {
    const [priceLists, setPriceLists] = useState([]);
    const [originalOrder, setOriginalOrder] = useState([]);
    const [listToEdit, setListToEdit] = useState(null);
    const [listToDelete, setListToDelete] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    
    const [draggedItemIndex, setDraggedItemIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [isSavingOrder, setIsSavingOrder] = useState(false);

    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();

    const fetchPriceLists = async () => {
        startLoading();
        try {
            const { data, error } = await supabase.rpc('get_price_lists');
            if (error) throw error;
            setPriceLists(data);
            setOriginalOrder(data.map(d => d.id));
        } catch (err) {
            addToast({ message: `Error al cargar listas de precios: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
        }
    };

    useEffect(() => {
        fetchPriceLists();
    }, []);

    const isOrderChanged = JSON.stringify(priceLists.map(p => p.id)) !== JSON.stringify(originalOrder);

    const handleDragStart = (e, index) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (index !== draggedItemIndex && index !== dragOverIndex) {
            setDragOverIndex(index);
        }
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        const draggedItem = priceLists[draggedItemIndex];
        const newPriceLists = [...priceLists];
        newPriceLists.splice(draggedItemIndex, 1);
        newPriceLists.splice(dropIndex, 0, draggedItem);
        setPriceLists(newPriceLists);
        handleDragEnd();
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
        setDragOverIndex(null);
    };

    const handleSaveOrder = async () => {
        setIsSavingOrder(true);
        try {
            const draggableListIds = priceLists
                .filter(list => !list.es_predeterminada)
                .map(list => list.id);
                
            const { error } = await supabase.rpc('update_price_list_order', {
                p_list_ids: draggableListIds
            });
            if (error) throw error;
            
            addToast({ message: 'Orden guardado con éxito.', type: 'success' });
            setOriginalOrder(priceLists.map(p => p.id));
        } catch (err) {
             addToast({ message: `Error al guardar el orden: ${err.message}`, type: 'error' });
        } finally {
            setIsSavingOrder(false);
        }
    };


    const handleAdd = () => {
        setListToEdit(null);
        setIsModalOpen(true);
    };

    const handleEdit = (list) => {
        setListToEdit(list);
        setIsModalOpen(true);
    };

    const handleDelete = (list) => {
        if (list.es_predeterminada) {
            addToast({ message: 'La lista de precios general no se puede eliminar.', type: 'warning' });
            return;
        }
        setListToDelete(list);
        setIsDeleteModalOpen(true);
    };
    
    const handleConfirmDelete = async () => {
        if (!listToDelete) return;
        startLoading();
        try {
            const { error } = await supabase.rpc('delete_price_list', { p_id: listToDelete.id });
            if (error) throw error;
            addToast({ message: 'Lista de precios eliminada.', type: 'success' });
            fetchPriceLists();
        } catch (err) {
            addToast({ message: `Error al eliminar: ${err.message}`, type: 'error' });
        } finally {
            stopLoading();
            setIsDeleteModalOpen(false);
        }
    };

    const handleSave = () => {
        setIsModalOpen(false);
        fetchPriceLists();
    };

    return html`
        <div>
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 class="text-xl font-semibold text-gray-800">Listas de Precios</h2>
                    <p class="mt-1 text-sm text-gray-600">Define diferentes políticas de precios para tus productos y arrástralas para ordenarlas.</p>
                </div>
                <div class="flex items-center gap-2">
                    ${isOrderChanged && html`
                        <button onClick=${handleSaveOrder} disabled=${isSavingOrder} class="hidden sm:flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:bg-slate-400 min-w-[120px]">
                            ${isSavingOrder ? html`<${Spinner}/>` : 'Guardar Orden'}
                        </button>
                    `}
                    <button onClick=${handleAdd} class="hidden sm:flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover">
                        ${ICONS.add} Crear Lista
                    </button>
                </div>
            </div>

            <div class="mt-6 flow-root">
                 <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                        <table class="min-w-full divide-y divide-gray-300">
                            <thead>
                                <tr>
                                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 w-12"><span class="sr-only">Ordenar</span></th>
                                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Nombre</th>
                                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Descripción</th>
                                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0"><span class="sr-only">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200 bg-white">
                                ${priceLists.map((list, index) => {
                                    const isDraggable = !list.es_predeterminada;
                                    const isBeingDragged = draggedItemIndex === index;
                                    const isDragOver = dragOverIndex === index;

                                    return html`
                                    <tr 
                                        key=${list.id}
                                        draggable=${isDraggable}
                                        onDragStart=${isDraggable ? (e) => handleDragStart(e, index) : null}
                                        onDragOver=${isDraggable ? (e) => handleDragOver(e, index) : null}
                                        onDrop=${isDraggable ? (e) => handleDrop(e, index) : null}
                                        onDragEnd=${isDraggable ? handleDragEnd : null}
                                        onDragLeave=${() => setDragOverIndex(null)}
                                        class="${isBeingDragged ? 'opacity-50 bg-slate-100' : ''} ${isDragOver ? 'border-t-2 border-primary' : ''} transition-all duration-150"
                                    >
                                        <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-500 sm:pl-0">
                                            ${isDraggable && html`<div class="cursor-move">${ICONS.drag_handle}</div>`}
                                        </td>
                                        <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                                            ${list.nombre}
                                            ${list.es_predeterminada && html`<span class="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">General</span>`}
                                        </td>
                                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">${list.descripcion}</td>
                                        <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                                            <div class="flex justify-end gap-2">
                                                <button onClick=${() => handleEdit(list)} class="text-gray-400 hover:text-primary p-1 rounded-full hover:bg-gray-100">${ICONS.edit}</button>
                                                <button onClick=${() => handleDelete(list)} disabled=${list.es_predeterminada} class="text-gray-400 p-1 rounded-full ${list.es_predeterminada ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-600 hover:bg-gray-100'}">${ICONS.delete}</button>
                                            </div>
                                        </td>
                                    </tr>
                                `})}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <div class="sm:hidden mt-4 space-y-2">
                ${isOrderChanged && html`
                    <button onClick=${handleSaveOrder} disabled=${isSavingOrder} class="w-full flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:bg-slate-400">
                        ${isSavingOrder ? html`<${Spinner}/>` : 'Guardar Orden'}
                    </button>
                `}
                <${FloatingActionButton} onClick=${handleAdd} label="Crear Lista" />
            </div>

            <${PriceListModal} isOpen=${isModalOpen} onClose=${() => setIsModalOpen(false)} onSave=${handleSave} listToEdit=${listToEdit} />
            <${ConfirmationModal}
                isOpen=${isDeleteModalOpen}
                onClose=${() => setIsDeleteModalOpen(false)}
                onConfirm=${handleConfirmDelete}
                title="Eliminar Lista de Precios"
                confirmText="Sí, eliminar"
                confirmVariant="danger"
                icon=${ICONS.warning_amber}
            >
                <p class="text-sm text-gray-300">¿Estás seguro? Se eliminarán todos los precios asociados a esta lista.</p>
            <//>
        </div>
    `;
}

const PremiumModuleMessage = ({ moduleName, featureDescription }) => {
    return html`
        <div class="text-center p-8 rounded-lg border-2 border-dashed border-gray-200 bg-white animate-fade-in-down">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                ${ICONS.bolt}
            </div>
            <h3 class="mt-4 text-lg font-bold text-gray-900">${moduleName} Deshabilitado</h3>
            <p class="mt-2 text-sm text-gray-600">
                ${featureDescription}
            </p>
            <p class="mt-1 text-sm text-gray-500">
                Actualiza tu plan o contacta a Soporte ServiVENT para activar este módulo.
            </p>
        </div>
    `;
};

const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
};

export function ConfiguracionPage({ user, onLogout, onProfileUpdate, companyInfo, notifications, onCompanyInfoUpdate, navigate }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    const fileInputRef = useRef(null);
    const [activeTab, setActiveTab] = useState('empresa');

    const [formData, setFormData] = useState({
        nombre: '',
        nit: '',
        modo_caja: 'por_sucursal',
        slug: '',
    });
    const [logoFile, setLogoFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [dataError, setDataError] = useState(null);
    const [hasOpenSessions, setHasOpenSessions] = useState(false);
    const [isCheckingSessions, setIsCheckingSessions] = useState(true);

    const [slugStatus, setSlugStatus] = useState('idle'); // idle, checking, available, unavailable
    const [slugMessage, setSlugMessage] = useState('');

    const canUseCashRegister = !!companyInfo?.planDetails?.features?.aperturar_cajas;
    const planSupportsCatalog = !!companyInfo?.planDetails?.features?.catalogo_web;
    const planSupportsPriceLists = !!companyInfo?.planDetails?.features?.listas_precios;

    const checkSessions = async () => {
        setIsCheckingSessions(true);
        try {
            const { data, error } = await supabase.rpc('check_any_open_sessions');
            if (error) throw error;
            setHasOpenSessions(data);
        } catch (err) {
            addToast({ message: `Error al verificar cajas abiertas: ${err.message}`, type: 'error' });
            setHasOpenSessions(false);
        } finally {
            setIsCheckingSessions(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'terminal' && canUseCashRegister) {
            checkSessions();
        }
    }, [activeTab, canUseCashRegister]);

    useEffect(() => {
        if (companyInfo) {
            setFormData({
                nombre: companyInfo.name || '',
                nit: companyInfo.nit || '',
                modo_caja: companyInfo.modo_caja || 'por_sucursal',
                slug: companyInfo.slug || '',
            });
            setPreviewUrl(companyInfo.logo);
            setSlugStatus('idle');
            setSlugMessage('');
        }
        
        if (user && !user.empresa_id) {
            setDataError("No se pudo identificar la empresa de tu cuenta. Esto es un error de consistencia de datos que impide guardar cambios. Por favor, ejecuta el script de reparación de datos del archivo DATA_INTEGRITY_FIX.md y vuelve a iniciar sesión.");
        } else {
            setDataError(null);
        }

    }, [companyInfo, user]);

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                addToast({ message: 'El archivo es demasiado grande (máx 2MB).', type: 'error' });
                return;
            }
            setLogoFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };
    
    const checkSlug = useCallback(
        debounce(async (slugToCheck) => {
            if (!slugToCheck || slugToCheck.length < 3) {
                setSlugStatus('idle');
                setSlugMessage('');
                return;
            }
            if (slugToCheck === companyInfo.slug) {
                setSlugStatus('available');
                setSlugMessage('Esta es tu URL actual.');
                return;
            }

            setSlugStatus('checking');
            try {
                const { data, error } = await supabase.rpc('check_slug_availability', { p_slug: slugToCheck });
                if (error) throw error;

                if (data) {
                    setSlugStatus('available');
                    setSlugMessage('Esta URL está disponible.');
                } else {
                    setSlugStatus('unavailable');
                    setSlugMessage('Esta URL ya está en uso.');
                }
            } catch (err) {
                setSlugStatus('error');
                setSlugMessage('Error al verificar.');
                addToast({ message: 'No se pudo verificar la URL.', type: 'error' });
            }
        }, 500),
        [companyInfo.slug, addToast]
    );

    useEffect(() => {
        if (activeTab === 'catalogo') {
            checkSlug(formData.slug);
        }
    }, [formData.slug, activeTab, checkSlug]);

    const handleSave = async () => {
        if (dataError) {
            addToast({ message: 'No se puede guardar debido a un error de datos. Sigue las instrucciones en el mensaje de error.', type: 'error', duration: 8000 });
            return;
        }

        if (!formData.nombre.trim() || !formData.nit.trim()) {
            addToast({ message: 'El nombre de la empresa y el NIT son obligatorios.', type: 'error' });
            return;
        }

        if (activeTab === 'catalogo' && slugStatus === 'unavailable') {
            addToast({ message: 'La URL del catálogo no está disponible. Por favor, elige otra.', type: 'error' });
            return;
        }

        setIsSaving(true);
        startLoading();
        try {
            let logoUrl = previewUrl;

            if (logoFile) {
                if (!user.empresa_id) {
                    throw new Error("No se pudo identificar la empresa del usuario para subir el logo.");
                }

                const fileExt = logoFile.name.split('.').pop();
                const filePath = `${user.empresa_id}/logo.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('logos')
                    .upload(filePath, logoFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('logos')
                    .getPublicUrl(filePath);
                
                logoUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
            }

            const { error: rpcError } = await supabase.rpc('update_company_info', {
                p_nombre: formData.nombre,
                p_nit: formData.nit,
                p_logo: logoUrl,
                p_modo_caja: formData.modo_caja,
                p_slug: formData.slug || null,
            });

            if (rpcError) throw rpcError;

            onCompanyInfoUpdate({
                name: formData.nombre,
                logo: logoUrl,
                nit: formData.nit,
                modo_caja: formData.modo_caja,
                slug: formData.slug || null,
            });

            addToast({ message: 'Configuración guardada con éxito.', type: 'success' });

        } catch (error) {
            console.error("Error saving configuration:", error);
            addToast({ message: `Error al guardar: ${error.message}`, type: 'error', duration: 10000 });
        } finally {
            setIsSaving(false);
            stopLoading();
        }
    };

    const breadcrumbs = [
        { name: 'Configuración', href: '#/configuracion' }
    ];
    
    const tabs = useMemo(() => {
        const baseTabs = [
            { id: 'empresa', label: 'Datos de la Empresa' },
            { id: 'precios', label: 'Listas de Precios' },
            { id: 'terminal', label: 'Terminal de Venta' },
            { id: 'catalogo', label: 'Catálogo Web' },
        ];
        return baseTabs;
    }, []);

    const canEdit = user.role === 'Propietario';

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Configuración"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <h1 class="text-2xl font-semibold text-gray-900">Configuración</h1>
            <p class="mt-1 text-sm text-gray-600">Gestiona los datos de tu empresa, políticas de precios y más.</p>

            <div class="mt-8">
                <${Tabs} tabs=${tabs} activeTab=${activeTab} onTabClick=${setActiveTab} />
            </div>

            <div class="mt-6">
                ${activeTab === 'empresa' && html`
                    <div class="animate-fade-in-down">
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div>
                                <h2 class="text-xl font-semibold text-gray-800">Datos de la Empresa</h2>
                                <p class="mt-1 text-sm text-gray-600">Actualiza la información y el logo de tu empresa.</p>
                            </div>
                            ${canEdit && html`
                                <button 
                                    onClick=${handleSave}
                                    disabled=${isSaving || !!dataError}
                                    class="flex-shrink-0 w-full sm:w-auto flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50 disabled:bg-gray-400 min-w-[120px]"
                                >
                                    ${isSaving ? html`<${Spinner}/>` : 'Guardar Cambios'}
                                </button>
                            `}
                        </div>

                        ${dataError && html`
                            <div class="mt-6 p-4 rounded-md bg-red-50 text-red-800 border border-red-200" role="alert">
                                <h3 class="font-bold flex items-center gap-2">${ICONS.error} Error Crítico de Datos</h3>
                                <p class="mt-2 text-sm">${dataError}</p>
                            </div>
                        `}

                        <div class="mt-4 max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow-sm border">
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div class="md:col-span-1">
                                    <h3 class="text-lg font-medium leading-6 text-gray-900">Logo</h3>
                                    <div class="mt-4 flex flex-col items-center">
                                        ${previewUrl ? html`
                                            <img src=${previewUrl} alt="Logo de la empresa" class="h-32 w-32 rounded-lg object-contain bg-slate-100 p-2 border" />
                                        ` : html`
                                            <div class="h-32 w-32 rounded-lg bg-slate-100 border flex items-center justify-center">
                                                <div class="text-slate-400 text-5xl">${ICONS.business}</div>
                                            </div>
                                        `}
                                        <input
                                            ref=${fileInputRef}
                                            type="file"
                                            class="hidden"
                                            accept="image/png, image/jpeg, image/svg+xml"
                                            onChange=${handleFileChange}
                                            disabled=${!canEdit || !!dataError}
                                        />
                                        ${canEdit && html`
                                            <button
                                                onClick=${() => fileInputRef.current.click()}
                                                type="button"
                                                disabled=${!!dataError}
                                                class="mt-4 w-full flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                ${ICONS.upload_file}
                                                Cambiar Logo
                                            </button>
                                        `}
                                    </div>
                                </div>
                                <div class="md:col-span-2">
                                    <h3 class="text-lg font-medium leading-6 text-gray-900">Información General</h3>
                                    <div class="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-6">
                                        <div class="sm:col-span-2">
                                            <${FormInput} label="Nombre de la Empresa" name="nombre" type="text" value=${formData.nombre} onInput=${handleInput} disabled=${!canEdit || !!dataError} />
                                        </div>
                                        <div class="sm:col-span-2">
                                            <${FormInput} label="NIT" name="nit" type="text" value=${formData.nit} onInput=${handleInput} disabled=${!canEdit || !!dataError} />
                                        </div>
                                    </div>
                                    ${!canEdit && !dataError && html`
                                        <div class="mt-6 p-4 rounded-md bg-blue-50 text-blue-700 text-sm" role="alert">
                                            <p>Solo el rol de <strong>Propietario</strong> puede editar esta información.</p>
                                        </div>
                                    `}
                                </div>
                            </div>
                        </div>
                    </div>
                `}
                
                ${activeTab === 'precios' && html`
                    <div class="animate-fade-in-down">
                        ${planSupportsPriceLists ? html`
                            <${PriceListsTab} />
                        ` : html`
                            <${PremiumModuleMessage}
                                moduleName="Gestión de Listas de Precios"
                                featureDescription="La gestión de múltiples listas de precios es una funcionalidad que no está activada para tu plan actual."
                            />
                        `}
                    </div>
                `}

                ${activeTab === 'terminal' && html`
                    <div class="animate-fade-in-down">
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div>
                                <h2 class="text-xl font-semibold text-gray-800">Configuración del Terminal de Venta</h2>
                                <p class="mt-1 text-sm text-gray-600">Define cómo se gestionan las sesiones de caja en el Punto de Venta.</p>
                            </div>
                            ${canEdit && html`
                                <button onClick=${handleSave} disabled=${isSaving || !!dataError || (canUseCashRegister && (hasOpenSessions || isCheckingSessions))} class="flex-shrink-0 w-full sm:w-auto flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50 disabled:bg-gray-400 min-w-[120px]">
                                    ${isSaving ? html`<${Spinner}/>` : 'Guardar Cambios'}
                                </button>
                            `}
                        </div>
                        <div class="mt-4 max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow-sm border">
                            ${!canUseCashRegister ? html`
                                <${PremiumModuleMessage}
                                    moduleName="Gestión de Cajas"
                                    featureDescription="El historial y la gestión de apertura/cierre de caja es una funcionalidad que no está activada para tu plan actual."
                                />
                            ` : html`
                                <fieldset class="space-y-4" disabled=${!canEdit || !!dataError || hasOpenSessions || isCheckingSessions}>
                                    <legend class="text-base font-semibold leading-6 text-gray-900">Modo de Operación de Caja</legend>
                                    <div class="relative flex items-start p-4 border rounded-lg ${formData.modo_caja === 'por_sucursal' ? 'bg-blue-50 border-blue-200' : 'bg-white'}">
                                        <div class="flex h-6 items-center">
                                            <input id="modo_caja_sucursal" name="modo_caja" type="radio" value="por_sucursal" checked=${formData.modo_caja === 'por_sucursal'} onInput=${handleInput} class="h-4 w-4 border-gray-300 text-primary focus:ring-primary" />
                                        </div>
                                        <div class="ml-3 text-sm leading-6">
                                            <label for="modo_caja_sucursal" class="font-medium text-gray-900">Caja por Sucursal (Recomendado)</label>
                                            <p class="text-gray-500">Solo se puede abrir una sesión de caja a la vez por cada sucursal. Ideal para la mayoría de negocios.</p>
                                        </div>
                                    </div>
                                    <div class="relative flex items-start p-4 border rounded-lg ${formData.modo_caja === 'por_usuario' ? 'bg-blue-50 border-blue-200' : 'bg-white'}">
                                        <div class="flex h-6 items-center">
                                            <input id="modo_caja_usuario" name="modo_caja" type="radio" value="por_usuario" checked=${formData.modo_caja === 'por_usuario'} onInput=${handleInput} class="h-4 w-4 border-gray-300 text-primary focus:ring-primary" />
                                        </div>
                                        <div class="ml-3 text-sm leading-6">
                                            <label for="modo_caja_usuario" class="font-medium text-gray-900">Caja por Usuario</label>
                                            <p class="text-gray-500">Cada usuario (vendedor) debe abrir y cerrar su propia caja individualmente al iniciar y finalizar su turno.</p>
                                        </div>
                                    </div>
                                </fieldset>
                            `}
                             ${(hasOpenSessions || isCheckingSessions) && canUseCashRegister && html`
                                <div class="mt-4 p-3 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-sm flex items-start gap-2">
                                    <div class="text-xl text-amber-600 mt-0.5">${ICONS.warning}</div>
                                    <div>
                                        <p class="font-bold">Modo de operación bloqueado</p>
                                        <p>${isCheckingSessions ? 'Verificando estado de las cajas...' : 'No se puede cambiar el modo de operación mientras haya una o más cajas abiertas en la empresa. Por favor, cierra todas las sesiones de caja para habilitar esta opción.'}</p>
                                    </div>
                                </div>
                             `}
                             ${!canEdit && !dataError && canUseCashRegister && html`
                                <div class="mt-6 p-4 rounded-md bg-blue-50 text-blue-700 text-sm" role="alert">
                                    <p>Solo el rol de <strong>Propietario</strong> puede editar esta información.</p>
                                </div>
                            `}
                        </div>
                    </div>
                `}
                ${activeTab === 'catalogo' && html`
                    <div class="animate-fade-in-down">
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div>
                                <h2 class="text-xl font-semibold text-gray-800">Tu Catálogo Web Público</h2>
                                <p class="mt-1 text-sm text-gray-600">Configura una URL única para que tus clientes puedan ver tus productos en línea.</p>
                            </div>
                            ${canEdit && html`
                                <button 
                                    onClick=${handleSave}
                                    disabled=${isSaving || !!dataError || (planSupportsCatalog && (slugStatus === 'checking' || slugStatus === 'unavailable'))}
                                    class="flex-shrink-0 w-full sm:w-auto flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50 disabled:bg-gray-400 min-w-[120px]"
                                >
                                    ${isSaving ? html`<${Spinner}/>` : 'Guardar Cambios'}
                                </button>
                            `}
                        </div>
    
                        <div class="mt-4 max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow-sm border">
                            ${!planSupportsCatalog ? html`
                                <${PremiumModuleMessage}
                                    moduleName="Catálogo Web"
                                    featureDescription="Publica un catálogo en línea para tus clientes. Esta es una funcionalidad que no está activada para tu plan actual."
                                />
                            ` : html`
                                <div>
                                    <p class="text-sm text-gray-600">Define una dirección web corta y fácil de recordar para tu catálogo. Solo se permiten letras minúsculas, números y guiones.</p>
                                    <div class="mt-4">
                                        <${FormInput}
                                            label="URL Única (slug)"
                                            name="slug"
                                            type="text"
                                            value=${formData.slug}
                                            onInput=${(e) => {
                                                const formattedSlug = e.target.value
                                                    .toLowerCase()
                                                    .replace(/\s+/g, '-')
                                                    .replace(/[^\w\-]+/g, '')
                                                    .replace(/\-\-+/g, '-');
                                                handleInput({ target: { name: 'slug', value: formattedSlug } });
                                            }}
                                            disabled=${!canEdit || !!dataError}
                                        />
        
                                        <div class="mt-2 text-sm text-gray-500 bg-slate-50 p-3 rounded-md flex items-center gap-2">
                                            <span class="font-semibold">URL final:</span>
                                            <code class="text-primary-dark">servivent.app/#/catalogo/<span class="font-bold">${formData.slug || 'tu-url'}</span></code>
                                        </div>
        
                                        ${slugStatus !== 'idle' && html`
                                            <div class="mt-2 flex items-center gap-2 text-sm">
                                                ${slugStatus === 'checking' && html`<${Spinner} size="h-4 w-4" color="text-gray-500" />`}
                                                ${slugStatus === 'available' && html`<div class="text-green-500">${ICONS.success}</div>`}
                                                ${slugStatus === 'unavailable' && html`<div class="text-red-500">${ICONS.error}</div>`}
                                                ${slugStatus === 'error' && html`<div class="text-red-500">${ICONS.error}</div>`}
                                                <span class=${`
                                                    ${slugStatus === 'available' ? 'text-green-600' : ''}
                                                    ${slugStatus === 'unavailable' ? 'text-red-600' : ''}
                                                    ${slugStatus === 'error' ? 'text-red-600' : ''}
                                                `}>${slugMessage}</span>
                                            </div>
                                        `}
                                    </div>
                                </div>
                            `}
                        </div>
                    </div>
                `}
            </div>
        <//>
    `;
}
