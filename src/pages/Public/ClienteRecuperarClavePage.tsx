/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useState } from 'preact/hooks';
import { html } from 'htm/preact';
import { FormInput } from '../../components/FormComponents.js';
import { Spinner } from '../../components/Spinner.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';

export function ClienteRecuperarClavePage({ navigate, slug }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    const handleReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}${window.location.pathname}#/catalogo/${slug}/login`, // Redirect back to login after password reset
            });
            if (error) throw error;
            addToast({ message: 'Si tu correo existe, recibirás un enlace para restablecer tu contraseña.', type: 'success', duration: 10000 });
            navigate(`/catalogo/${slug}/login`);
        } catch (err) {
            addToast({ message: 'Error al enviar el correo de recuperación.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };
    
    return html`
        <div class="min-h-full flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 bg-slate-50">
            <div class="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">Recupera tu contraseña</h2>
                <p class="mt-2 text-center text-sm text-gray-600">
                    Ingresa tu correo y te enviaremos un enlace para que puedas restablecerla.
                </p>
            </div>
            <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <form class="space-y-6" onSubmit=${handleReset}>
                        <${FormInput} label="Correo Electrónico" name="email" type="email" value=${email} onInput=${e => setEmail(e.target.value)} />
                        <div>
                            <button type="submit" disabled=${loading} class="flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:bg-slate-400">
                                ${loading ? html`<${Spinner} />` : 'Enviar Enlace de Recuperación'}
                            </button>
                        </div>
                    </form>
                     <div class="mt-6 text-center">
                        <a href=${`/#/catalogo/${slug}/login`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}/login`); }} class="font-medium text-primary hover:text-primary-hover text-sm">
                           Volver a Inicio de Sesión
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}