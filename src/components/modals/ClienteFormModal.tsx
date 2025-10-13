/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
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
        nombre: '', nit_ci: '', telefono: '', correo: '', direccion: ''
    });

    const [formData, setFormData] = useState(getInitialState());
    const [isLoading, setIsLoading] = useState(false);
    const [avatarFile, setAvatarFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);

    const [emailError, setEmailError] = useState('');
    const [emailValidationStatus, setEmailValidationStatus] = useState('idle'); // idle, checking, valid, invalid
    
    const debounceTimeoutRef = useRef(null);

    useEffect(() => {
        if(isOpen) {
            if (isEditMode) {
                setFormData({
                    nombre: clienteToEdit.nombre || '',
                    nit_ci: clienteToEdit.nit_ci || '',
                    telefono: clienteToEdit.telefono || '',
                    correo: clienteToEdit.correo || '',
                    direccion: clienteToEdit.direccion || '',
                });
                setPreviewUrl(clienteToEdit.avatar_url);
            } else {
                setFormData(getInitialState());
                setPreviewUrl(null);
            }
            setAvatarFile(null);
            setEmailError('');
            setEmailValidationStatus('idle');
        }
    }, [isOpen, clienteToEdit]);

    const validateEmail = useCallback(async (email) => {
        if (!email.trim()) {
            setEmailValidationStatus('idle');
            setEmailError('');
            return;
        }

        setEmailValidationStatus('checking');
        setEmailError('');

        try {
            const { data, error } = await supabase.rpc('validate_client_email', {
                p_correo: email,
                p_cliente_id_to_exclude: isEditMode ? clienteToEdit.id : null
            });

            if (error) throw error;

            if (data.valid) {
                setEmailValidationStatus('valid');
                setEmailError('');
            } else {
                setEmailValidationStatus('invalid');
                if (data.reason === 'format') {
                    setEmailError('Formato o proveedor de correo no válido (ej: gmail, hotmail).');
                } else if (data.reason === 'exists') {
                    setEmailError('Este correo electrónico ya está en uso.');
                }
            }
        } catch (err) {
            setEmailValidationStatus('error');
            setEmailError('No se pudo verificar el correo.');
            addToast({ message: 'Error al validar el correo.', type: 'error' });
        }
    }, [isEditMode, clienteToEdit?.id, addToast]);


    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
        
        if (name === 'correo') {
            setEmailValidationStatus('idle');
            setEmailError('');
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
            debounceTimeoutRef.current = setTimeout(() => {
                validateEmail(value);
            }, 500); // 500ms debounce
        }
    };
    
    const handleEmailBlur = (e) => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        validateEmail(e.target.value);
    };
    
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
        if (emailValidationStatus === 'invalid') {
            addToast({ message: emailError, type: 'error' });
            return;
        }
        if (emailValidationStatus === 'checking') {
            addToast({ message: 'Por favor, espera a que termine la validación del correo.', type: 'warning' });
            return;
        }
        
        setIsLoading(true);
        try {
            let avatarUrl = isEditMode ? clienteToEdit.avatar_url : null;
            let clienteId = isEditMode ? clienteToEdit.id : null;

            const { data: upsertedData, error: upsertError } = await supabase.rpc('upsert_client', {
                p_id: clienteId,
                p_nombre: formData.nombre,
                p_nit_ci: formData.nit_ci || null,
                p_telefono: formData.telefono,
                p_correo: formData.correo || null,
                p_direccion: formData.direccion || null,
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
                    p_telefono: formData.telefono, p_correo: formData.correo, p_direccion: formData.direccion,
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
    
    let emailIndicator = null;
    if (emailValidationStatus === 'checking') {
        emailIndicator = html`<${Spinner} size="h-5 w-5" color="text-gray-400" />`;
    } else if (emailValidationStatus === 'valid') {
        emailIndicator = html`<div class="text-green-500">${ICONS.success}</div>`;
    } else if (emailValidationStatus === 'invalid') {
        emailIndicator = html`<div class="text-red-500">${ICONS.error}</div>`;
    }

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
                    <${FormInput} 
                        label="Correo Electrónico (Opcional)" 
                        name="correo" 
                        type="email" 
                        value=${formData.correo} 
                        onInput=${handleInput} 
                        onBlur=${handleEmailBlur}
                        required=${false}
                        error=${emailError}
                        rightElement=${emailIndicator}
                    />
                    <${FormInput} label="Dirección (Opcional)" name="direccion" type="text" value=${formData.direccion} onInput=${handleInput} required=${false} />
                </div>
            </div>
        <//>
    `;
}