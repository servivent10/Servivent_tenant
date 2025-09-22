/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { ConfirmationModal } from '../ConfirmationModal.js';
import { FormInput } from '../FormComponents.js';
import { ICONS } from '../Icons.js';
import { Spinner } from '../Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';

export function SucursalFormModal({ isOpen, onClose, onSave, sucursalToEdit }) {
    const isEditMode = Boolean(sucursalToEdit);
    const { addToast } = useToast();
    const [formData, setFormData] = useState({
        nombre: '',
        direccion: '',
        telefono: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({ nombre: '' });

    useEffect(() => {
        if (isOpen) {
            setErrors({ nombre: '' });
            if (isEditMode) {
                setFormData({
                    nombre: sucursalToEdit.nombre || '',
                    direccion: sucursalToEdit.direccion || '',
                    telefono: sucursalToEdit.telefono || '',
                });
            } else {
                setFormData({
                    nombre: '',
                    direccion: '',
                    telefono: '',
                });
            }
        }
    }, [isOpen, sucursalToEdit, isEditMode]);

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'nombre' && errors.nombre) {
            setErrors(prev => ({ ...prev, nombre: '' }));
        }
    };

    const validateForm = () => {
        if (!formData.nombre.trim()) {
            setErrors({ nombre: 'El nombre de la sucursal es obligatorio.' });
            return false;
        }
        return true;
    };

    const handleConfirm = async () => {
        if (!validateForm()) {
            addToast({ message: 'Por favor, corrige los errores del formulario.', type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            if (isEditMode) {
                const { error } = await supabase.rpc('update_sucursal', {
                    p_sucursal_id: sucursalToEdit.id,
                    p_nombre: formData.nombre,
                    p_direccion: formData.direccion,
                    p_telefono: formData.telefono
                });
                if (error) throw error;
                onSave('edit');
            } else {
                const { error } = await supabase.rpc('create_sucursal', {
                    p_nombre: formData.nombre,
                    p_direccion: formData.direccion,
                    p_telefono: formData.telefono
                });
                if (error) throw error;
                onSave('create');
            }
        } catch (err) {
            console.error('Error saving sucursal:', err);
            let friendlyError = err.message;
             if (err.message.includes('Límite de sucursales alcanzado')) {
                friendlyError = 'Has alcanzado el límite de sucursales de tu plan.';
            }
            addToast({ message: `Error: ${friendlyError}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const title = isEditMode ? 'Editar Sucursal' : 'Añadir Nueva Sucursal';

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : (isEditMode ? 'Guardar Cambios' : 'Crear Sucursal')}
            icon=${ICONS.storefront}
        >
            <div class="space-y-4 text-sm">
                <${FormInput} label="Nombre" name="nombre" type="text" value=${formData.nombre} onInput=${handleInput} theme="dark" error=${errors.nombre} />
                <${FormInput} label="Dirección" name="direccion" type="text" value=${formData.direccion} onInput=${handleInput} required=${false} theme="dark" />
                <${FormInput} label="Teléfono" name="telefono" type="tel" value=${formData.telefono} onInput=${handleInput} required=${false} theme="dark" />
            </div>
        <//>
    `;
}
