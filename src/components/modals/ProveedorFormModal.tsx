/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { ConfirmationModal } from '../ConfirmationModal.js';
import { FormInput } from '../FormComponents.js';
import { Spinner } from '../Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { ICONS } from '../Icons.js';

export function ProveedorFormModal({ isOpen, onClose, onSave, proveedorToEdit }) {
    const isEditMode = Boolean(proveedorToEdit);
    const [formData, setFormData] = useState({ nombre: '', nit: '', telefono: '', email: '', direccion: '', nombre_contacto: '' });
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();
    
    useEffect(() => {
        if(isOpen) {
            setFormData(isEditMode ? { ...proveedorToEdit, nombre_contacto: proveedorToEdit.nombre_contacto || '' } : { nombre: '', nit: '', telefono: '', email: '', direccion: '', nombre_contacto: '' });
        }
    }, [isOpen, proveedorToEdit]);

    const handleInput = (e) => setFormData(prev => ({...prev, [e.target.name]: e.target.value}));

    const handleConfirm = async () => {
        if (!formData.nombre.trim() || !formData.nombre_contacto.trim() || !formData.telefono.trim()) {
            addToast({ message: 'El nombre de la empresa, nombre del contacto y teléfono son obligatorios.', type: 'error' });
            return;
        }
        setIsLoading(true);
        try {
            const { data: newId, error } = await supabase.rpc('upsert_proveedor', {
                p_id: isEditMode ? proveedorToEdit.id : null,
                p_nombre: formData.nombre,
                p_nit: formData.nit,
                p_telefono: formData.telefono,
                p_email: formData.email,
                p_direccion: formData.direccion,
                p_nombre_contacto: formData.nombre_contacto
            });
            if (error) throw error;
            onSave(isEditMode ? 'edit' : 'create', newId);
        } catch(err) {
            addToast({ message: `Error al guardar: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const title = isEditMode ? 'Editar Proveedor' : 'Añadir Proveedor';

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : (isEditMode ? 'Guardar Cambios' : 'Crear Proveedor')}
            icon=${ICONS.suppliers}
        >
            <div class="space-y-4">
                <${FormInput} label="Nombre de la Empresa" name="nombre" type="text" value=${formData.nombre} onInput=${handleInput} />
                <${FormInput} label="Nombre del Contacto" name="nombre_contacto" type="text" value=${formData.nombre_contacto} onInput=${handleInput} required=${true} />
                <${FormInput} label="NIT (Opcional)" name="nit" type="text" value=${formData.nit} onInput=${handleInput} required=${false} />
                <div class="grid grid-cols-2 gap-4">
                    <${FormInput} label="Teléfono" name="telefono" type="tel" value=${formData.telefono} onInput=${handleInput} required=${true} />
                    <${FormInput} label="Correo Electrónico (Opcional)" name="email" type="email" value=${formData.email} onInput=${handleInput} required=${false} />
                </div>
                <${FormInput} label="Dirección (Opcional)" name="direccion" type="text" value=${formData.direccion} onInput=${handleInput} required=${false} />
            </div>
        <//>
    `;
}