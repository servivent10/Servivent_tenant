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

export function ModuloFormModal({ isOpen, onClose, onSave, moduleToEdit }) {
    const isEditMode = Boolean(moduleToEdit);
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const getInitialState = () => ({
        nombre_visible: '',
        codigo_interno: '',
        descripcion: '',
        precio_mensual: '0.00'
    });
    
    const [formData, setFormData] = useState(getInitialState());

    useEffect(() => {
        if (isOpen) {
            if (isEditMode) {
                setFormData({
                    nombre_visible: moduleToEdit.nombre_visible || '',
                    codigo_interno: moduleToEdit.codigo_interno || '',
                    descripcion: moduleToEdit.descripcion || '',
                    precio_mensual: moduleToEdit.precio_mensual || '0.00'
                });
            } else {
                setFormData(getInitialState());
            }
        }
    }, [isOpen, moduleToEdit]);

    const handleInput = (e) => {
        let { name, value } = e.target;
        if (name === 'codigo_interno') {
            value = value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleConfirm = async () => {
        if (!formData.nombre_visible.trim() || !formData.codigo_interno.trim()) {
            addToast({ message: 'El nombre y el código interno son obligatorios.', type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                id: isEditMode ? moduleToEdit.id : null,
                nombre_visible: formData.nombre_visible,
                codigo_interno: formData.codigo_interno,
                descripcion: formData.descripcion,
                precio_mensual: Number(formData.precio_mensual)
            };
            const { error } = await supabase.rpc('upsert_modulo', { p_modulo: payload });
            if (error) throw error;
            addToast({ message: `Módulo guardado con éxito.`, type: 'success' });
            onSave();
        } catch (err) {
            addToast({ message: `Error al guardar el módulo: ${err.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const title = isEditMode ? 'Editar Módulo' : 'Crear Nuevo Módulo';

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : 'Guardar'}
            icon=${ICONS.bolt}
        >
            <div class="space-y-4">
                <${FormInput} label="Nombre Visible para el Cliente" name="nombre_visible" type="text" value=${formData.nombre_visible} onInput=${handleInput} />
                <${FormInput} label="Código Interno (Ej: CATALOGO_WEB)" name="codigo_interno" type="text" value=${formData.codigo_interno} onInput=${handleInput} disabled=${isEditMode} />
                <${FormInput} label="Descripción Breve" name="descripcion" type="text" value=${formData.descripcion} onInput=${handleInput} required=${false} />
                <${FormInput} label="Precio Mensual Adicional (USD)" name="precio_mensual" type="number" value=${formData.precio_mensual} onInput=${handleInput} />
            </div>
        <//>
    `;
}