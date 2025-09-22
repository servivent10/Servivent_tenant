/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { ConfirmationModal } from '../ConfirmationModal.js';
import { FormInput } from '../FormComponents.js';
import { Avatar } from '../Avatar.js';
import { ICONS } from '../Icons.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { Spinner } from '../Spinner.js';

export function ProfileModal({ isOpen, onClose, user, onProfileUpdate }) {
    const [name, setName] = useState(user.name);
    const [avatarFile, setAvatarFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(user.avatar);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);
    const { addToast } = useToast();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<{ new_password?: string; confirm_password?: string; }>({});

    useEffect(() => {
        // Reset state if user changes or modal reopens
        setName(user.name);
        setAvatarFile(null);
        setPreviewUrl(user.avatar);
        setNewPassword('');
        setConfirmPassword('');
        setErrors({});
    }, [isOpen, user]);

    // Real-time validation for password fields
    useEffect(() => {
        if (!newPassword && !confirmPassword) {
            setErrors({});
            return;
        }
        let newErrors: { new_password?: string; confirm_password?: string; } = {};
        if (newPassword && newPassword.length < 6) {
            newErrors.new_password = 'Debe tener al menos 6 caracteres.';
        }
        if (newPassword !== confirmPassword) {
            newErrors.confirm_password = 'Las contraseñas no coinciden.';
        }
        setErrors(newErrors);
    }, [newPassword, confirmPassword]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                addToast({ message: 'El archivo es demasiado grande. El límite es 2MB.', type: 'error' });
                return;
            }
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const name_completo = name.trim();
            if (!name_completo) {
                addToast({ message: 'El nombre no puede estar vacío.', type: 'error' });
                return;
            }

            // --- Password Validation ---
            const wantsToChangePassword = newPassword !== '';
            if (wantsToChangePassword && Object.keys(errors).some(key => errors[key])) {
                addToast({ message: 'Por favor, corrige los errores en la contraseña.', type: 'error' });
                return;
            }
            
            // --- Logic Execution ---
            let avatarUrl = user.avatar;
            
            // 1. Upload new avatar if one was selected
            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const filePath = `${user.empresa_id}/${user.id}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, avatarFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);
                
                avatarUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
            }

            // 2. Update user profile (name and avatar)
            const { error: rpcError } = await supabase.rpc('update_my_profile', {
                p_nombre_completo: name_completo,
                p_avatar: avatarUrl,
            });

            if (rpcError) throw rpcError;

            // 3. Update password if provided
            if (wantsToChangePassword) {
                const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
                if (passwordError) throw passwordError;
            }

            // 4. Update local state in App.tsx
            onProfileUpdate({ name: name_completo, avatar: avatarUrl });

            addToast({ message: 'Perfil actualizado con éxito.', type: 'success' });
            onClose();

        } catch (error) {
            console.error("Error updating profile:", error);
            addToast({ message: `Error al actualizar: ${error.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleSave}
            title="Mi Perfil"
            confirmText=${isLoading ? html`<${Spinner}/>` : 'Guardar Cambios'}
            icon=${ICONS.users}
        >
            <div class="space-y-6">
                <div class="flex items-center space-x-4">
                    <${Avatar} name=${name} avatarUrl=${previewUrl} size="h-20 w-20" />
                    <div class="flex-1">
                        <input
                            ref=${fileInputRef}
                            type="file"
                            class="hidden"
                            accept="image/png, image/jpeg"
                            onChange=${handleFileChange}
                        />
                        <button
                            onClick=${() => fileInputRef.current.click()}
                            class="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-gray-400 hover:bg-white/20 transition-colors"
                        >
                            ${ICONS.upload_file}
                            Cambiar Foto
                        </button>
                        <p class="text-xs text-gray-400 mt-2">JPG o PNG. Máx 2MB.</p>
                    </div>
                </div>
                <${FormInput}
                    label="Nombre Completo"
                    name="nombre_completo"
                    type="text"
                    value=${name}
                    onInput=${(e) => setName(e.target.value)}
                    theme="dark"
                />
                 <div class="relative py-2">
                    <div class="absolute inset-0 flex items-center" aria-hidden="true">
                        <div class="w-full border-t border-white/20"></div>
                    </div>
                    <div class="relative flex justify-center">
                        <span class="bg-secondary-dark px-2 text-sm text-gray-400">Cambiar Contraseña (opcional)</span>
                    </div>
                </div>

                <${FormInput}
                    label="Nueva Contraseña"
                    name="new_password"
                    type="password"
                    value=${newPassword}
                    onInput=${(e) => setNewPassword(e.target.value)}
                    theme="dark"
                    required=${false}
                    error=${errors.new_password}
                />
                <${FormInput}
                    label="Confirmar Nueva Contraseña"
                    name="confirm_password"
                    type="password"
                    value=${confirmPassword}
                    onInput=${(e) => setConfirmPassword(e.target.value)}
                    theme="dark"
                    required=${false}
                    error=${errors.confirm_password}
                />
            </div>
        <//>
    `;
}