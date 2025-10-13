/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { FormInput } from '../../components/FormComponents.js';
import { ICONS } from '../../components/Icons.js';
import { Spinner } from '../../components/Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';

const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
};

export function IdentificacionModal({ isOpen, onClose, onConfirm, slug }) {
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();
    
    const [email, setEmail] = useState('');
    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    
    const [validationState, setValidationState] = useState('idle'); // 'idle', 'checking', 'exists', 'new'
    const [welcomeName, setWelcomeName] = useState('');
    
    useEffect(() => {
        if (isOpen) {
            setEmail('');
            setNombre('');
            setTelefono('');
            setValidationState('idle');
            setWelcomeName('');
        }
    }, [isOpen]);

    const checkEmailExistence = async (emailToCheck) => {
        if (!emailToCheck) {
            setValidationState('idle');
            return;
        }
        try {
            const { data, error } = await supabase.rpc('check_web_client_existence', { 
                p_slug: slug, 
                p_email: emailToCheck 
            });
            if (error) throw error;

            if (data.exists) {
                setValidationState('exists');
                setWelcomeName(data.nombre);
            } else {
                setValidationState('new');
                setWelcomeName('');
            }
        } catch (err) {
            setValidationState('idle');
            addToast({ message: 'No se pudo verificar el correo.', type: 'error' });
        }
    };
    
    const debouncedCheck = useCallback(debounce(checkEmailExistence, 500), [slug]);

    const handleEmailInput = (e) => {
        const newEmail = e.target.value;
        setEmail(newEmail);
        if (newEmail.includes('@') && newEmail.includes('.')) {
            setValidationState('checking');
            debouncedCheck(newEmail);
        } else {
            setValidationState('idle');
        }
    };

    const handleSubmit = async () => {
        const isNew = validationState === 'new';
        let customerData = { email, isNew, nombre: null, telefono: null };
        
        if (isNew) {
            if (!nombre.trim() || !telefono.trim() || !email.trim()) {
                addToast({ message: 'Por favor, completa todos los campos.', type: 'error' });
                return;
            }
            customerData = { ...customerData, nombre, telefono };
        } else {
            if (!email.trim()) {
                addToast({ message: 'Por favor, ingresa un correo.', type: 'error' });
                return;
            }
        }
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
             addToast({ message: 'Por favor, ingresa un correo electrónico válido.', type: 'error' });
             return;
        }

        setIsLoading(true);
        await onConfirm(customerData);
        setIsLoading(false);
    };

    return html`
        <${ConfirmationModal}
            isOpen=${isOpen}
            onClose=${onClose}
            onConfirm=${handleSubmit}
            title="Identifícate para continuar"
            confirmText=${isLoading ? html`<${Spinner} />` : 'Enviar enlace de acceso'}
            icon=${ICONS.person_add}
        >
            <p class="text-sm text-gray-600 mb-4">Te enviaremos un enlace a tu correo para que puedas acceder de forma segura sin necesidad de una contraseña.</p>
            
            <div class="space-y-4">
                <${FormInput} 
                    label="Correo Electrónico" 
                    name="email" 
                    type="email" 
                    value=${email} 
                    onInput=${handleEmailInput} 
                    onFocus=${e => e.target.select()} 
                />

                ${validationState === 'checking' && html`
                    <div class="flex items-center justify-center gap-2 text-sm text-gray-500 p-4">
                        <${Spinner} color="text-primary" /> Verificando...
                    </div>
                `}

                ${validationState === 'exists' && html`
                    <div class="p-3 bg-green-50 border border-green-200 rounded-md text-center animate-fade-in-down">
                        <p class="font-semibold text-green-800">¡Hola de nuevo, ${welcomeName.split(' ')[0]}!</p>
                    </div>
                `}
                
                ${validationState === 'new' && html`
                    <div class="space-y-4 animate-fade-in-down pt-2 border-t">
                        <p class="text-sm text-center text-gray-600 font-medium">Parece que eres nuevo. ¡Completa tus datos para crear tu cuenta!</p>
                        <${FormInput} label="Nombre Completo" name="nombre" type="text" value=${nombre} onInput=${(e) => setNombre(e.target.value)} onFocus=${e => e.target.select()} />
                        <${FormInput} label="Teléfono" name="telefono" type="tel" value=${telefono} onInput=${(e) => setTelefono(e.target.value)} onFocus=${e => e.target.select()} />
                    </div>
                `}
            </div>
        <//>
    `;
};