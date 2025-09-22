/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { ConfirmationModal } from '../ConfirmationModal.js';
import { FormInput } from '../FormComponents.js';
import { ICONS } from '../Icons.js';
import { Spinner } from '../Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { Avatar } from '../Avatar.js';

export function UserFormModal({ isOpen, onClose, onSave, userToEdit, branches, currentUser }) {
    const isEditMode = Boolean(userToEdit);
    const { addToast } = useToast();
    const [formData, setFormData] = useState({
        nombre_completo: '',
        correo: '',
        password: '',
        rol: 'Empleado',
        sucursal_id: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ nombre_completo?: string; correo?: string; password?: string; new_password?: string; confirm_password?: string; }>({});
    
    const [avatarFile, setAvatarFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const getInitialFormData = () => {
        if (isEditMode) {
            return {
                nombre_completo: userToEdit.nombre_completo || '',
                correo: userToEdit.correo || '',
                password: '',
                rol: userToEdit.rol || 'Empleado',
                sucursal_id: userToEdit.sucursal_id || (branches.length > 0 ? branches[0].id : ''),
            };
        }
        return {
            nombre_completo: '',
            correo: '',
            password: '',
            rol: 'Empleado',
            sucursal_id: branches.length > 0 ? branches[0].id : '',
        };
    };

    useEffect(() => {
        if (isOpen) {
            const initialData = getInitialFormData();
            setFormData(initialData);
            setPreviewUrl(isEditMode ? userToEdit.avatar : null);
            setAvatarFile(null);
            setNewPassword('');
            setConfirmPassword('');
            setErrors({});
        }
    }, [isOpen, userToEdit, isEditMode, branches]);

    // --- Real-time Validation ---
    const validateField = (name, value) => {
        let error = '';
        switch (name) {
            case 'nombre_completo':
                if (!value.trim()) error = 'El nombre es obligatorio.';
                break;
            case 'correo':
                if (!isEditMode) {
                    if (!value.trim()) error = 'El correo es obligatorio.';
                    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Correo inválido.';
                }
                break;
            case 'password':
                if (!isEditMode) {
                    if (!value) error = 'La contraseña es obligatoria.';
                    else if (value.length < 6) error = 'Debe tener al menos 6 caracteres.';
                }
                break;
        }
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    useEffect(() => {
        if (!isEditMode) return;
    
        const newErrors: { new_password?: string; confirm_password?: string } = {
            new_password: '',
            confirm_password: ''
        };
    
        if (newPassword || confirmPassword) {
            // 1. Validate length of newPassword
            if (newPassword && newPassword.length < 6) {
                newErrors.new_password = 'Debe tener al menos 6 caracteres.';
            }
            
            // 2. Validate match
            if (newPassword !== confirmPassword) {
                // Show mismatch error only if the new password is valid or the user started typing in confirm field.
                if (confirmPassword || (newPassword && !newErrors.new_password)) {
                     newErrors.confirm_password = 'Las contraseñas no coinciden.';
                }
            }
        }
        
        setErrors(prev => ({ ...prev, ...newErrors }));
    
    }, [newPassword, confirmPassword, isEditMode]);


    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        validateField(name, value);
    };

    const validateFormOnSubmit = () => {
        let isValid = true;
        const fieldsToValidate = ['nombre_completo', 'correo', 'password'];
        fieldsToValidate.forEach(field => {
             validateField(field, formData[field]);
             if (errors[field]) isValid = false;
        });

        if (isEditMode && newPassword && (newPassword.length < 6 || newPassword !== confirmPassword)) {
            isValid = false;
        }
        
        // Final check based on state after validations
        const currentErrors = { ...errors };
        if (!isEditMode) {
            if (!formData.nombre_completo.trim()) { currentErrors.nombre_completo = 'El nombre es obligatorio.'; isValid = false; }
            if (!formData.correo.trim()) { currentErrors.correo = 'El correo es obligatorio.'; isValid = false; }
            if (!formData.password) { currentErrors.password = 'La contraseña es obligatoria.'; isValid = false; }
        }
        
        setErrors(currentErrors);
        return !Object.values(currentErrors).some(e => e);
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
        if (!validateFormOnSubmit()) {
            addToast({ message: 'Por favor, corrige los errores del formulario.', type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            let avatarUrl = isEditMode ? userToEdit.avatar : null;
            let userId = isEditMode ? userToEdit.id : null;

            if (isEditMode) {
                // --- UPDATE LOGIC ---
                if (avatarFile) {
                    const fileExt = avatarFile.name.split('.').pop();
                    const filePath = `${currentUser.empresa_id}/${userId}.${fileExt}`;
                    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
                    if (uploadError) throw uploadError;
                    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                    avatarUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
                }

                const { error } = await supabase.rpc('update_company_user', {
                    p_user_id_to_update: userId,
                    p_nombre_completo: formData.nombre_completo,
                    p_rol: formData.rol,
                    p_sucursal_id: formData.sucursal_id,
                    p_avatar: avatarUrl,
                    p_password: newPassword || null
                });
                if (error) throw error;
                onSave('edit');

            } else {
                // --- CREATE LOGIC (using Edge Function) ---
                const { data, error } = await supabase.functions.invoke('create-company-user', {
                    body: {
                        nombre_completo: formData.nombre_completo,
                        correo: formData.correo,
                        password: formData.password,
                        rol: formData.rol,
                        sucursal_id: formData.sucursal_id,
                    },
                });

                if (error) throw error; // This will throw to the catch block on non-2xx responses
                
                userId = data.userId;

                if (avatarFile && userId) {
                    const fileExt = avatarFile.name.split('.').pop();
                    const filePath = `${currentUser.empresa_id}/${userId}.${fileExt}`;
                    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
                    if (uploadError) throw uploadError;

                    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                    avatarUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;

                    // Update the user with the new avatar URL
                    const { error: updateError } = await supabase.rpc('update_company_user', {
                        p_user_id_to_update: userId,
                        p_nombre_completo: formData.nombre_completo,
                        p_rol: formData.rol,
                        p_sucursal_id: formData.sucursal_id,
                        p_avatar: avatarUrl,
                        p_password: null
                    });
                    if (updateError) throw updateError;
                }
                onSave('create');
            }
        } catch (err) {
            console.error('Error saving user:', err);
            let errorMessage = "Ocurrió un error inesperado al guardar el usuario.";

            // Extract the specific error message from the Edge Function's response
            if (err.context && typeof err.context.json === 'function') {
                try {
                    const errorData = await err.context.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    } else {
                        errorMessage = err.message;
                    }
                } catch (jsonError) {
                    console.error('Could not parse error JSON from Edge Function', jsonError);
                    errorMessage = err.message; // Fallback to generic message
                }
            } else {
                 errorMessage = err.message;
            }
            
            // Remap known error strings for consistency, though the backend should already be friendly.
            if (errorMessage.includes('User already registered') || errorMessage.includes('duplicate key value violates unique constraint "users_email_key"')) {
                errorMessage = 'Este correo electrónico ya está en uso.';
            }

            addToast({ message: `Error: ${errorMessage}`, type: 'error', duration: 8000 });
        } finally {
            setIsLoading(false);
        }
    };

    const title = isEditMode ? 'Editar Usuario' : 'Añadir Nuevo Usuario';

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : (isEditMode ? 'Guardar Cambios' : 'Crear Usuario')}
            icon=${ICONS.users}
        >
            <div class="space-y-4 text-sm">
                <div class="flex items-center space-x-4">
                    <${Avatar} name=${formData.nombre_completo} avatarUrl=${previewUrl} size="h-20 w-20" />
                     <div class="flex-1">
                        <input ref=${fileInputRef} type="file" class="hidden" accept="image/png, image/jpeg" onChange=${handleFileChange} />
                        <button onClick=${() => fileInputRef.current.click()} class="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-gray-400 hover:bg-white/20">
                            ${ICONS.upload_file} Cambiar Foto
                        </button>
                        <p class="text-xs text-gray-400 mt-2">JPG o PNG. Máx 2MB.</p>
                    </div>
                </div>

                <${FormInput} label="Nombre Completo" name="nombre_completo" type="text" value=${formData.nombre_completo} onInput=${handleInput} theme="dark" error=${errors.nombre_completo} />
                
                ${!isEditMode && html`
                    <${FormInput} label="Correo Electrónico" name="correo" type="email" value=${formData.correo} onInput=${handleInput} theme="dark" error=${errors.correo} />
                `}
                
                ${!isEditMode && html`
                    <${FormInput} label="Contraseña Temporal" name="password" type="password" value=${formData.password} onInput=${handleInput} theme="dark" error=${errors.password} />
                `}

                <div>
                    <label for="rol" class="block font-medium leading-6 text-gray-200">Rol</label>
                    <select id="rol" name="rol" value=${formData.rol} onInput=${handleInput} class="mt-1 block w-full rounded-md border-0 p-2 bg-white/10 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm">
                        ${currentUser.role === 'Propietario' && html`<option class="bg-secondary-dark text-white" value="Administrador">Administrador</option>`}
                        <option class="bg-secondary-dark text-white" value="Empleado">Empleado</option>
                    </select>
                </div>
                 <div>
                    <label for="sucursal_id" class="block font-medium leading-6 text-gray-200">Sucursal</label>
                    <select id="sucursal_id" name="sucursal_id" value=${formData.sucursal_id} onInput=${handleInput} class="mt-1 block w-full rounded-md border-0 p-2 bg-white/10 text-white shadow-sm ring-1 ring-inset ring-gray-600 focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm">
                        ${branches.map(branch => html`<option class="bg-secondary-dark text-white" value=${branch.id}>${branch.nombre}</option>`)}
                    </select>
                </div>
                
                ${isEditMode && html`
                    <div class="pt-4 border-t border-white/10">
                        <p class="text-sm font-medium text-gray-300">Cambiar Contraseña (opcional)</p>
                        <div class="space-y-4 mt-2">
                            <${FormInput} label="Nueva Contraseña" name="new_password" type="password" value=${newPassword} onInput=${(e) => setNewPassword(e.target.value)} theme="dark" error=${errors.new_password} required=${false} />
                            <${FormInput} label="Confirmar Nueva Contraseña" name="confirm_password" type="password" value=${confirmPassword} onInput=${(e) => setConfirmPassword(e.target.value)} theme="dark" error=${errors.confirm_password} required=${false} />
                        </div>
                    </div>
                `}
            </div>
        <//>
    `;
}