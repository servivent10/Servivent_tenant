/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useState, useCallback } from 'preact/hooks';
import { html } from 'htm/preact';
import { FormInput } from '../../components/FormComponents.js';
import { Spinner } from '../../components/Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { ICONS } from '../../components/Icons.js';

const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
};

export function ClienteRegistroPage({ navigate, slug }) {
    const [formData, setFormData] = useState({
        email: '', nombre: '', telefono: '', password: '',
    });
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    const [validationState, setValidationState] = useState('idle'); // idle, checking, new, exists_unlinked, exists_linked
    const [welcomeName, setWelcomeName] = useState('');

    const checkEmailStatus = async (emailToCheck) => {
        if (!emailToCheck || !emailToCheck.includes('@') || !emailToCheck.includes('.')) {
            setValidationState('idle');
            return;
        }
        setValidationState('checking');
        try {
            const { data, error } = await supabase.rpc('validate_client_email_status', {
                p_slug: slug,
                p_correo: emailToCheck,
            });
            if (error) throw error;

            setValidationState(data.status);
            if (data.status === 'exists_unlinked') {
                setWelcomeName(data.nombre);
            } else {
                setWelcomeName('');
            }
        } catch (err) {
            setValidationState('idle');
            addToast({ message: 'No se pudo verificar el correo.', type: 'error' });
        }
    };

    const debouncedCheck = useCallback(debounce(checkEmailStatus, 500), [slug]);

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'email') {
            debouncedCheck(value);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (validationState === 'new') {
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            nombre: formData.nombre,
                            telefono: formData.telefono,
                            slug: slug,
                        }
                    }
                });
                if (signUpError) throw signUpError;
                
                if (signUpData.session) {
                    addToast({ message: '¡Cuenta creada y sesión iniciada!', type: 'success' });
                    navigate(`/catalogo/${slug}`);
                } else {
                    addToast({ message: '¡Cuenta creada! Revisa tu correo para confirmar tu cuenta.', type: 'success', duration: 10000 });
                    navigate(`/catalogo/${slug}/login`);
                }
            } else if (validationState === 'exists_unlinked') {
                const { error: invokeError } = await supabase.functions.invoke('link-existing-client', {
                    body: { email: formData.email, password: formData.password, slug: slug },
                });
                if (invokeError) throw new Error('Error al activar la cuenta. Contacta a soporte.');

                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password,
                });

                if (signInError) {
                    addToast({ message: '¡Cuenta activada! Ya puedes iniciar sesión.', type: 'success' });
                    navigate(`/catalogo/${slug}/login`);
                } else {
                    addToast({ message: '¡Cuenta activada y sesión iniciada!', type: 'success' });
                    navigate(`/catalogo/${slug}`);
                }
            }
        } catch (err) {
            addToast({ message: err.message || 'Error en el registro.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return html`
        <div class="min-h-full flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 bg-slate-50">
            <div class="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">Crea tu cuenta</h2>
                <p class="mt-2 text-center text-sm text-gray-600">
                    ¿Ya tienes una?
                    <a href=${`/#/catalogo/${slug}/login`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}/login`); }} class="font-medium text-primary hover:text-primary-hover">
                        Inicia sesión aquí
                    </a>
                </p>
            </div>

            <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <form class="space-y-6" onSubmit=${handleRegister}>
                        <${FormInput} label="Correo Electrónico" name="email" type="email" value=${formData.email} onInput=${handleInput} />

                        ${validationState === 'checking' && html`<div class="flex justify-center"><${Spinner} color="text-primary"/></div>`}
                        
                        ${validationState === 'exists_linked' && html`
                            <div class="p-3 bg-red-50 border border-red-200 rounded-md text-center text-sm text-red-800">
                                Este correo ya tiene una cuenta web. Por favor, <a href="#" onClick=${(e) => {e.preventDefault(); navigate(`/catalogo/${slug}/login`)}} class="font-bold underline">inicia sesión</a>.
                            </div>
                        `}

                        ${validationState === 'new' && html`
                            <div class="space-y-6 animate-fade-in-down">
                                <p class="text-sm text-center text-gray-600">¡Genial! Completa tus datos para finalizar.</p>
                                <${FormInput} label="Nombre Completo" name="nombre" type="text" value=${formData.nombre} onInput=${handleInput} />
                                <${FormInput} label="Teléfono" name="telefono" type="tel" value=${formData.telefono} onInput=${handleInput} />
                                <${FormInput} label="Crea una Contraseña" name="password" type="password" value=${formData.password} onInput=${handleInput} />
                            </div>
                        `}
                        
                        ${validationState === 'exists_unlinked' && html`
                            <div class="space-y-6 animate-fade-in-down">
                                <div class="p-3 bg-green-50 border border-green-200 rounded-md text-center">
                                    <p class="font-semibold text-green-800">¡Hola de nuevo, ${welcomeName}!</p>
                                    <p class="text-sm text-green-700">Solo necesitas crear una contraseña para tu cuenta web.</p>
                                </div>
                                <${FormInput} label="Crea tu Contraseña" name="password" type="password" value=${formData.password} onInput=${handleInput} />
                            </div>
                        `}

                        <div>
                            <button type="submit" disabled=${loading || !['new', 'exists_unlinked'].includes(validationState)} class="flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:bg-slate-400">
                                ${loading ? html`<${Spinner} />` : 'Crear Cuenta'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}