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
import { ICONS } from '../../components/Icons.js';

export function ClienteLoginPage({ navigate, slug }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            // onAuthStateChange in App.tsx will handle profile loading
            addToast({ message: 'Inicio de sesión exitoso.', type: 'success' });
            navigate(`/catalogo/${slug}`);
        } catch (err) {
            addToast({ message: 'Correo o contraseña incorrectos.', type: 'error' });
            setLoading(false);
        }
    };

    return html`
        <div class="min-h-full flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 bg-slate-50">
            <div class="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">Inicia sesión en tu cuenta</h2>
                <p class="mt-2 text-center text-sm text-gray-600">
                    ¿Aún no tienes una?
                    <a href=${`/#/catalogo/${slug}/registro`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}/registro`); }} class="font-medium text-primary hover:text-primary-hover">
                        Crea una cuenta aquí
                    </a>
                </p>
            </div>

            <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <form class="space-y-6" onSubmit=${handleLogin}>
                        <${FormInput} label="Correo Electrónico" name="email" type="email" value=${email} onInput=${e => setEmail(e.target.value)} />
                        <${FormInput} label="Contraseña" name="password" type="password" value=${password} onInput=${e => setPassword(e.target.value)} />

                        <div class="flex items-center justify-between">
                            <div class="text-sm">
                                <a href=${`/#/catalogo/${slug}/recuperar-clave`} onClick=${(e) => { e.preventDefault(); navigate(`/catalogo/${slug}/recuperar-clave`); }} class="font-medium text-primary hover:text-primary-hover">¿Olvidaste tu contraseña?</a>
                            </div>
                        </div>

                        <div>
                            <button type="submit" disabled=${loading} class="flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:bg-slate-400">
                                ${loading ? html`<${Spinner} />` : 'Iniciar Sesión'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}