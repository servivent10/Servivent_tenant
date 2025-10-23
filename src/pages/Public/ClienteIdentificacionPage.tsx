/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useState, useCallback, useRef } from 'preact/hooks';
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

// Regex to check for a syntactically complete email format ending in .com
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.com$/;

export function ClienteIdentificacionPage({ navigate, slug }) {
    const [formData, setFormData] = useState({ email: '', nombre: '', telefono: '', password: '' });
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    // State for backend validation result
    const [emailState, setEmailState] = useState('idle'); // 'idle', 'checking', 'new', 'exists_unlinked', 'exists_linked'
    // State for local, synchronous format validation error message
    const [emailFormatError, setEmailFormatError] = useState('');
    
    const [welcomeName, setWelcomeName] = useState('');

    const [phoneState, setPhoneState] = useState('idle'); // idle, checking, found, not_found
    const [clientFoundByPhone, setClientFoundByPhone] = useState(null);
    const [linkConfirmation, setLinkConfirmation] = useState(null); // 'link' or 'create_new'

    const debounceTimeout = useRef(null);

    const checkEmailOnBackend = async (emailToCheck) => {
        setEmailState('checking');
        try {
            const { data, error } = await supabase.rpc('validate_client_email_status', {
                p_slug: slug,
                p_correo: emailToCheck,
            });
            if (error) throw error;
            
            // Only update if the backend didn't return 'idle' (which means format was incomplete on its side)
            if (data.status !== 'idle') {
                setEmailState(data.status);
                if (data.status === 'exists_unlinked') {
                    setWelcomeName(data.nombre);
                } else {
                    setWelcomeName('');
                }
            } else {
                // If backend says idle, it means format is still considered invalid. Revert to format error.
                setEmailState('invalid_format');
                setEmailFormatError('Formato o proveedor de correo no válido (ej: gmail, hotmail).');
            }
        } catch (err) {
            setEmailState('idle');
            addToast({ message: 'No se pudo verificar el correo.', type: 'error' });
        }
    };
    
    const checkPhoneStatus = async (phoneToCheck) => {
        if (!phoneToCheck || phoneToCheck.length < 5) {
            setPhoneState('idle');
            return;
        }
        setPhoneState('checking');
        try {
            const { data, error } = await supabase.rpc('find_client_by_phone', { p_slug: slug, p_telefono: phoneToCheck });
            if (error) throw error;
            if (data.found) {
                setPhoneState('found');
                setClientFoundByPhone(data.client);
            } else {
                setPhoneState('not_found');
            }
        } catch (err) {
            setPhoneState('idle');
            addToast({ message: 'No se pudo verificar el teléfono.', type: 'error' });
        }
    };
    
    const debouncedCheckPhone = useCallback(debounce(checkPhoneStatus, 500), [slug]);

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'email') {
            clearTimeout(debounceTimeout.current);
            const trimmedEmail = value.trim();

            if (!trimmedEmail) {
                setEmailState('idle');
                setEmailFormatError('');
                setPhoneState('idle');
                setClientFoundByPhone(null);
                setLinkConfirmation(null);
                return;
            }

            if (EMAIL_REGEX.test(trimmedEmail)) {
                // Format is VALID. Clear local error and trigger backend check.
                setEmailFormatError('');
                setEmailState('checking');
                debounceTimeout.current = setTimeout(() => {
                    checkEmailOnBackend(trimmedEmail);
                }, 400);
            } else {
                // Format is INCOMPLETE/INVALID. Show local error and do NOT call backend.
                setEmailState('invalid_format');
                if (trimmedEmail.includes('@')) {
                    setEmailFormatError('Formato o proveedor de correo no válido (ej: gmail, hotmail).');
                } else {
                    setEmailFormatError('');
                }
            }
        }

        if (name === 'telefono' && emailState === 'new') {
            debouncedCheckPhone(value);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (emailState === 'exists_linked') { // Login flow
                const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
                if (error) throw error;
                addToast({ message: 'Inicio de sesión exitoso.', type: 'success' });
                navigate(`/catalogo/${slug}`);
            } else if (emailState === 'exists_unlinked') { // Activate existing client flow
                const { error: invokeError } = await supabase.functions.invoke('link-existing-client', { body: { email: formData.email, password: formData.password, slug: slug } });
                if (invokeError) throw new Error('Error al activar la cuenta. Contacta a soporte.');
                const { error: signInError } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
                if (signInError) throw signInError;
                addToast({ message: '¡Cuenta activada y sesión iniciada!', type: 'success' });
                navigate(`/catalogo/${slug}`);
            } else if (emailState === 'new') { // New user registration flow
                const optionsData: { [key: string]: any } = { nombre: formData.nombre, telefono: formData.telefono, slug: slug };
                if (phoneState === 'found' && linkConfirmation === 'link') {
                    optionsData.existingClientId = clientFoundByPhone.id;
                }

                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: { data: optionsData }
                });
                if (signUpError) throw signUpError;
                
                if (signUpData.session) {
                    addToast({ message: '¡Cuenta creada y sesión iniciada!', type: 'success' });
                    navigate(`/catalogo/${slug}`);
                } else {
                    addToast({ message: '¡Cuenta creada! Revisa tu correo para confirmar tu cuenta.', type: 'success', duration: 10000 });
                    navigate(`/catalogo/${slug}`);
                }
            }
        } catch (err) {
            addToast({ message: err.message || 'Ocurrió un error.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    let title, subtitle;
    switch(emailState) {
        case 'exists_linked':
            title = 'Inicia sesión';
            subtitle = 'Ingresa tu contraseña para acceder a tu cuenta.';
            break;
        case 'exists_unlinked':
            title = `¡Hola de nuevo, ${welcomeName}!`;
            subtitle = 'Parece que ya eres nuestro cliente. Solo necesitas crear una contraseña para activar tu cuenta web.';
            break;
        case 'new':
            title = 'Crea tu cuenta';
            subtitle = 'Completa tus datos para registrarte.';
            break;
        default: // idle, checking, invalid_format
            title = 'Identifícate';
            subtitle = 'Ingresa tu correo para continuar.';
    }

    let emailIndicatorIcon = null;
    if (emailState === 'checking') {
        emailIndicatorIcon = html`<${Spinner} size="h-5 w-5" color="text-gray-400" />`;
    } else if (['new', 'exists_linked', 'exists_unlinked'].includes(emailState) && !emailFormatError) {
        emailIndicatorIcon = html`<div class="text-green-500">${ICONS.success}</div>`;
    } else if (emailFormatError) {
        emailIndicatorIcon = html`<div class="text-red-500">${ICONS.error}</div>`;
    }

    const isSubmitDisabled = loading || !(['new', 'exists_unlinked', 'exists_linked'].includes(emailState)) || (emailState === 'new' && phoneState === 'found' && !linkConfirmation);

    return html`
        <div class="min-h-full flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 bg-slate-50">
            <div class="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">${title}</h2>
                <p class="mt-2 text-center text-sm text-gray-600">${subtitle}</p>
            </div>

            <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <form class="space-y-6" onSubmit=${handleSubmit}>
                        <${FormInput}
                            label="Correo Electrónico"
                            name="email"
                            type="email"
                            value=${formData.email}
                            onInput=${handleInput}
                            error=${emailFormatError}
                            rightElement=${emailIndicatorIcon}
                        />

                        ${emailState === 'exists_linked' && html`
                            <div class="space-y-6 animate-fade-in-down">
                                <${FormInput} label="Contraseña" name="password" type="password" value=${formData.password} onInput=${handleInput} />
                                <div class="text-sm text-right">
                                    <a href=${`/#/catalogo/${slug}/recuperar-clave`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}/recuperar-clave`); }} class="font-medium text-primary hover:text-primary-hover">¿Olvidaste tu contraseña?</a>
                                </div>
                            </div>
                        `}
                        
                        ${emailState === 'exists_unlinked' && html`
                            <div class="space-y-6 animate-fade-in-down">
                                <${FormInput} label="Crea tu Contraseña" name="password" type="password" value=${formData.password} onInput=${handleInput} />
                            </div>
                        `}

                        ${emailState === 'new' && html`
                            <div class="space-y-6 animate-fade-in-down">
                                <${FormInput} label="Nombre Completo" name="nombre" type="text" value=${formData.nombre} onInput=${handleInput} />
                                <${FormInput} label="Teléfono" name="telefono" type="tel" value=${formData.telefono} onInput=${handleInput} />

                                ${phoneState === 'checking' && html`<div class="flex justify-center"><${Spinner} color="text-primary"/></div>`}
                                
                                ${phoneState === 'found' && clientFoundByPhone && !linkConfirmation && html`
                                    <div class="p-4 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800 space-y-3 animate-fade-in-down">
                                        <p>Hemos encontrado un perfil a nombre de <b class="font-bold">${clientFoundByPhone.nombre}</b> asociado a este número de teléfono.</p>
                                        <p>¿Deseas vincular este nuevo correo a tu perfil existente?</p>
                                        <div class="flex gap-2 pt-2">
                                            <button type="button" onClick=${() => setLinkConfirmation('link')} class="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">Sí, vincular</button>
                                            <button type="button" onClick=${() => setLinkConfirmation('create_new')} class="flex-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">No, soy un nuevo cliente</button>
                                        </div>
                                    </div>
                                `}
                                
                                <${FormInput} label="Crea una Contraseña" name="password" type="password" value=${formData.password} onInput=${handleInput} />
                            </div>
                        `}

                        <div>
                            <button type="submit" disabled=${isSubmitDisabled} class="flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:bg-slate-400">
                                ${loading ? html`<${Spinner} />` : 'Continuar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}