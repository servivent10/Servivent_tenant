/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { ConfirmationModal } from '../ConfirmationModal.js';
import { FormInput } from '../FormComponents.js';
import { Spinner } from '../Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { ICONS } from '../Icons.js';
import { Avatar } from '../Avatar.js';

export function ClienteFormModal({ isOpen, onClose, onSave, clienteToEdit, user }) {
    const isEditMode = Boolean(clienteToEdit);
    const { addToast } = useToast();
    
    const getInitialState = () => ({
        nombre: '', nit_ci: '', telefono: '', email: '', direccion: ''
    });

    const [formData, setFormData] = useState(getInitialState());
    const [isLoading, setIsLoading] = useState(false);
    const [avatarFile, setAvatarFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);
    
    useEffect(() => {
        if(isOpen) {
            if (isEditMode) {
                setFormData({
                    nombre: clienteToEdit.nombre || '',
                    nit_ci: clienteToEdit.nit_ci || '',
                    telefono: clienteToEdit.telefono || '',
                    email: clienteToEdit.email || '',
                    direccion: clienteToEdit.direccion || '',
                });
                setPreviewUrl(clienteToEdit.avatar_url);
            } else {
                setFormData(getInitialState());
                setPreviewUrl(null);
            }
            setAvatarFile(null);
        }
    }, [isOpen, clienteToEdit]);

    const handleInput = (e) => setFormData(prev => ({...prev, [e.target.name]: e.target.value}));
    
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                addToast({ message: 'El archivo es demasiado grande (máx 2MB).', type: 'error' });
                return;
            }
            setAvatarFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleConfirm = async () => {
        if (!formData.nombre.trim() || !formData.telefono.trim()) {
            addToast({ message: 'El nombre completo y el teléfono son obligatorios.', type: 'error' });
            return;
        }
        setIsLoading(true);
        try {
            let avatarUrl = isEditMode ? clienteToEdit.avatar_url : null;
            let clienteId = isEditMode ? clienteToEdit.id : null;

            const { data: upsertedData, error: upsertError } = await supabase.rpc('upsert_client', {
                p_id: clienteId,
                p_nombre: formData.nombre,
                p_nit_ci: formData.nit_ci,
                p_telefono: formData.telefono,
                p_email: formData.email,
                p_direccion: formData.direccion,
                p_avatar_url: avatarUrl
            }).single();

            if (upsertError) throw upsertError;
            clienteId = upsertedData.id;

            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const filePath = `${user.empresa_id}/clientes/${clienteId}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, avatarFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                avatarUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;

                const { error: finalUpdateError } = await supabase.rpc('upsert_client', {
                    p_id: clienteId, p_nombre: formData.nombre, p_nit_ci: formData.nit_ci,
                    p_telefono: formData.telefono, p_email: formData.email, p_direccion: formData.direccion,
                    p_avatar_url: avatarUrl
                });
                if (finalUpdateError) throw finalUpdateError;
            }
            
            const savedClient = {
                id: clienteId,
                ...formData,
                avatar_url: avatarUrl,
                saldo_pendiente: isEditMode ? clienteToEdit.saldo_pendiente : 0
            };

            onSave(isEditMode ? 'edit' : 'create', savedClient);
        } catch(err) {
            addToast({ message: `Error al guardar cliente: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const title = isEditMode ? 'Editar Cliente' : 'Añadir Nuevo Cliente';

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : (isEditMode ? 'Guardar Cambios' : 'Crear Cliente')}
            icon=${ICONS.clients}
            maxWidthClass="max-w-2xl"
        >
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-1 flex flex-col items-center space-y-4">
                    <${Avatar} name=${formData.nombre} avatarUrl=${previewUrl} size="h-32 w-32" />
                    <button onClick=${() => fileInputRef.current.click()} class="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                        ${ICONS.upload_file} Cambiar Foto
                    </button>
                    <input ref=${fileInputRef} type="file" class="hidden" accept="image/png, image/jpeg" onChange=${handleFileChange} />
                </div>
                <div class="md:col-span-2 space-y-4">
                    <${FormInput} label="Nombre Completo" name="nombre" type="text" value=${formData.nombre} onInput=${handleInput} required=${true} />
                    <div class="grid grid-cols-2 gap-4">
                        <${FormInput} label="Teléfono" name="telefono" type="tel" value=${formData.telefono} onInput=${handleInput} required=${true} />
                        <${FormInput} label="NIT o CI (Opcional)" name="nit_ci" type="text" value=${formData.nit_ci} onInput=${handleInput} required=${false} />
                    </div>
                    <${FormInput} label="Correo Electrónico (Opcional)" name="email" type="email" value=${formData.email} onInput=${handleInput} required=${false} />
                    <${FormInput} label="Dirección (Opcional)" name="direccion" type="text" value=${formData.direccion} onInput=${handleInput} required=${false} />
                </div>
            </div>
        <//>
    `;
}