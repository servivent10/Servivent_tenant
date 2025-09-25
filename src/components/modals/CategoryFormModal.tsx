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

export function CategoryFormModal({ isOpen, onClose, onSave, categoryToEdit }) {
    const isEditMode = Boolean(categoryToEdit);
    const { addToast } = useToast();
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setError('');
            setName(isEditMode ? categoryToEdit.nombre : '');
        }
    }, [isOpen, categoryToEdit, isEditMode]);

    const handleInput = (e) => {
        setName(e.target.value);
        if (error) {
            setError('');
        }
    };

    const validateForm = () => {
        if (!name.trim()) {
            setError('El nombre de la categoría es obligatorio.');
            return false;
        }
        return true;
    };

    const handleConfirm = async () => {
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        try {
            const { error: rpcError } = await supabase.rpc('upsert_category', {
                p_id: isEditMode ? categoryToEdit.id : null,
                p_nombre: name.trim()
            });
            if (rpcError) throw rpcError;
            
            onSave(isEditMode ? 'edit' : 'create');
        } catch (err) {
            console.error('Error saving category:', err);
            let friendlyError = err.message;
            if (err.message.includes('duplicate key value violates unique constraint')) {
                friendlyError = `La categoría "${name.trim()}" ya existe.`;
            }
            addToast({ message: `Error: ${friendlyError}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const title = isEditMode ? 'Editar Categoría' : 'Crear Nueva Categoría';

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : (isEditMode ? 'Guardar Cambios' : 'Crear Categoría')}
            icon=${ICONS.category}
        >
            <div class="space-y-4 text-sm text-gray-600">
                <${FormInput} label="Nombre de la Categoría" name="nombre" type="text" value=${name} onInput=${handleInput} error=${error} />
            </div>
        <//>
    `;
}