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

export function GastoCategoriaFormModal({ isOpen, onClose, onSave, categoryToEdit }) {
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
    }, [isOpen, categoryToEdit]);

    const handleInput = (e) => {
        setName(e.target.value);
        if (error) setError('');
    };

    const handleConfirm = async () => {
        if (!name.trim()) {
            setError('El nombre de la categoría es obligatorio.');
            return;
        }

        setIsLoading(true);
        try {
            const { error: rpcError } = await supabase.rpc('upsert_gasto_categoria', {
                p_id: isEditMode ? categoryToEdit.id : null,
                p_nombre: name.trim()
            });
            if (rpcError) throw rpcError;
            
            addToast({ message: `Categoría ${isEditMode ? 'actualizada' : 'creada'} con éxito.`, type: 'success' });
            onSave(name.trim());
        } catch (err) {
            let friendlyError = err.message;
            if (err.message.includes('duplicate key value violates unique constraint')) {
                friendlyError = `La categoría "${name.trim()}" ya existe.`;
            }
            addToast({ message: `Error: ${friendlyError}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const title = isEditMode ? 'Editar Categoría de Gasto' : 'Crear Categoría de Gasto';

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleConfirm}
            title=${title}
            confirmText=${isLoading ? html`<${Spinner}/>` : 'Guardar'}
            icon=${ICONS.category}
        >
            <div class="space-y-4">
                <${FormInput} label="Nombre de la Categoría" name="nombre" type="text" value=${name} onInput=${handleInput} error=${error} />
            </div>
        <//>
    `;
}