/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
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

    // State for real-time email validation
    const [emailError, setEmailError] = useState('');
    const [emailValidationStatus, setEmailValidationStatus] = useState('idle'); // idle, checking, valid, invalid
    const debounceTimeoutRef = useRef(null);


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
            // Reset email validation state
            setEmailError('');
            setEmailValidationStatus('idle');
        }
    }, [isOpen, userToEdit, isEditMode, branches]);

    const validateEmail = useCallback(async (email) => {
        if (isEditMode || !email.trim()) {
            setEmailValidationStatus('idle');
            setEmailError('');
            return;
        }

        setEmailValidationStatus('checking');
        setEmailError('');

        try {
            const { data, error } = await supabase.rpc('validate_user_email', {
                p_correo: email,
                p_user_id_to_exclude: null
            });
            if (error) throw error;
            if (data.valid) {
                setEmailValidationStatus('valid');
                setEmailError('');
            } else {
                setEmailValidationStatus('invalid');
                if (data.reason === 'format') setEmailError('Formato o proveedor de correo no válido (ej: gmail, hotmail).');
                else if (data.reason === 'exists') setEmailError('Este correo electrónico ya está en uso.');
            }
        } catch (err) {
            setEmailValidationStatus('error');
            setEmailError('No se pudo verificar el correo.');
            addToast({ message: 'Error al validar el correo.', type: 'error' });
        }
    }, [isEditMode, addToast]);


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
            if (newPassword && newPassword.length < 6) newErrors.new_password = 'Debe tener al menos 6 caracteres.';
            if (newPassword !== confirmPassword) {
                if (confirmPassword || (newPassword && !newErrors.new_password)) newErrors.confirm_password = 'Las contraseñas no coinciden.';
            }
        }
        
        setErrors(prev => ({ ...prev, ...newErrors }));
    
    }, [newPassword, confirmPassword, isEditMode]);


    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        if (name === 'correo' && !isEditMode) {
            setEmailValidationStatus('idle');
            setEmailError('');
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = setTimeout(() => validateEmail(value), 500);
        } else {
             validateField(name, value);
        }
    };

    const handleEmailBlur = (e) => {
        if (isEditMode) return;
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        validateEmail(e.target.value);
    };

    const validateFormOnSubmit = () => {
        let isValid = true;
        const fieldsToValidate = ['nombre_completo', 'correo', 'password'];
        fieldsToValidate.forEach(field => {
             validateField(field, formData[field]);
             if (errors[field]) isValid = false;
        });

        if (isEditMode && newPassword && (newPassword.length < 6 || newPassword !== confirmPassword)) isValid = false;
        
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
        if (!isEditMode && emailValidationStatus === 'invalid') {
            addToast({ message: emailError, type: 'error' });
            return;
        }
        if (!isEditMode && emailValidationStatus === 'checking') {
            addToast({ message: 'Por favor, espera a que termine la validación del correo.', type: 'warning' });
            return;
        }
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

            if (err.context && typeof err.context.json === 'function') {
                try {
                    const errorData = await err.context.json();
                    if (errorData.error) errorMessage = errorData.error;
                    else errorMessage = err.message;
                } catch (jsonError) {
                    console.error('Could not parse error JSON from Edge Function', jsonError);
                    errorMessage = err.message;
                }
            } else {
                 errorMessage = err.message;
            }
            
            if (errorMessage.includes('User already registered') || errorMessage.includes('duplicate key value violates unique constraint "users_email_key"')) {
                errorMessage = 'Este correo electrónico ya está en uso.';
            }

            addToast({ message: `Error: ${errorMessage}`, type: 'error', duration: 8000 });
        } finally {
            setIsLoading(false);
        }
    };

    const title = isEditMode ? 'Editar Usuario' : 'Añadir Nuevo Usuario';
    
    let emailIndicator = null;
    if (emailValidationStatus === 'checking') emailIndicator = html`<${Spinner} size="h-5 w-5" color="text-gray-400" />`;
    else if (emailValidationStatus === 'valid') emailIndicator = html`<div class="text-green-500">${ICONS.success}</div>`;
    else if (emailValidationStatus === 'invalid') emailIndicator = html`<div class="text-red-500">${ICONS.error}</div>`;

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : (isEditMode ? 'Guardar Cambios' : 'Crear Usuario')}
            icon=${ICONS.users}
            maxWidthClass="max-w-4xl"
        >
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
                <div class="md:col-span-1 flex flex-col items-center space-y-4">
                    <${Avatar} name=${formData.nombre_completo} avatarUrl=${previewUrl} size="h-32 w-32" />
                    <div class="text-center">
                        <input ref=${fileInputRef} type="file" class="hidden" accept="image/png, image/jpeg" onChange=${handleFileChange} />
                        <button onClick=${() => fileInputRef.current.click()} class="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                            ${ICONS.upload_file} Cambiar Foto
                        </button>
                        <p class="text-xs text-gray-500 mt-2">JPG o PNG. Máx 2MB.</p>
                    </div>
                </div>

                <div class="md:col-span-2 space-y-4">
                    <${FormInput} label="Nombre Completo" name="nombre_completo" type="text" value=${formData.nombre_completo} onInput=${handleInput} error=${errors.nombre_completo} />
                    
                    ${!isEditMode && html`
                        <${FormInput}
                            label="Correo Electrónico"
                            name="correo"
                            type="email"
                            value=${formData.correo}
                            onInput=${handleInput}
                            onBlur=${handleEmailBlur}
                            error=${errors.correo || emailError}
                            rightElement=${emailIndicator}
                        />
                    `}
                    
                    ${!isEditMode && html`
                        <${FormInput} label="Contraseña Temporal" name="password" type="password" value=${formData.password} onInput=${handleInput} error=${errors.password} />
                    `}

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label for="rol" class="block font-medium leading-6 text-gray-900">Rol</label>
                            <select id="rol" name="rol" value=${formData.rol} onInput=${handleInput} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                                ${currentUser.role === 'Propietario' && html`<option value="Administrador">Administrador</option>`}
                                <option value="Empleado">Empleado</option>
                            </select>
                        </div>
                        <div>
                            <label for="sucursal_id" class="block font-medium leading-6 text-gray-900">Sucursal</label>
                            <select id="sucursal_id" name="sucursal_id" value=${formData.sucursal_id} onInput=${handleInput} class="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm">
                                ${branches.map(branch => html`<option value=${branch.id}>${branch.nombre}</option>`)}
                            </select>
                        </div>
                    </div>
                    
                    ${isEditMode && html`
                        <div class="pt-4 border-t border-gray-200">
                            <p class="text-sm font-medium text-gray-700">Cambiar Contraseña (opcional)</p>
                            <div class="space-y-4 mt-2">
                                <${FormInput} label="Nueva Contraseña" name="new_password" type="password" value=${newPassword} onInput=${(e) => setNewPassword(e.target.value)} error=${errors.new_password} required=${false} />
                                <${FormInput} label="Confirmar Nueva Contraseña" name="confirm_password" type="password" value=${confirmPassword} onInput=${(e) => setConfirmPassword(e.target.value)} error=${errors.confirm_password} required=${false} />
                            </div>
                        </div>
                    `}
                </div>
            </div>
        <//>
    `;
}
