/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useState } from 'preact/hooks';
import { html } from 'htm/preact';
import { FormInput } from '../../components/FormComponents.js';
import { ServiVentLogo } from '../../components/Logo.js';
import { Spinner } from '../../components/Spinner.js';
import { useToast } from '../../hooks/useToast.js';

export function LoginPage({ onLogin, navigate }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await onLogin(email, password);
            // Si el login es exitoso, onAuthStateChange en App.tsx se encargará de la navegación.
            // El componente se desmontará, por lo que no es necesario set loading a false aquí.
        } catch (err) {
            let friendlyMessage;
            switch (err.message) {
                case 'Invalid login credentials':
                    friendlyMessage = 'Correo o contraseña incorrectos.';
                    break;
                case 'El correo y la contraseña son obligatorios.':
                    friendlyMessage = err.message;
                    break;
                default:
                    friendlyMessage = 'Ocurrió un error. Por favor, inténtalo de nuevo.';
                    break;
            }
            addToast({ message: friendlyMessage, type: 'error' });
            setLoading(false);
        }
    };

    return html`
        <div class="relative flex min-h-full w-full items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div class="absolute inset-0 -z-20">
                <img class="h-full w-full object-cover" src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2830&q=80" alt="Team working" />
                <div class="absolute inset-0 bg-secondary-dark/70"></div>
            </div>

            <div class="max-w-md space-y-8 rounded-xl bg-black/20 p-8 shadow-2xl backdrop-blur-lg">
                 <div>
                    <${ServiVentLogo} className="mx-auto h-12 w-auto" textColor="text-white" accentColor="text-primary-light" />
                    <h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-white">
                        Inicia sesión en tu cuenta
                    </h2>
                     <p class="mt-2 text-center text-sm text-gray-300">
                        ¿Aún no tienes una cuenta?
                        <a href="#" onClick=${(e) => { e.preventDefault(); navigate('/registro'); }} class="font-medium text-primary-light hover:text-primary-hover"> Registra tu empresa</a>
                    </p>
                </div>

                <form class="mt-8 space-y-6" onSubmit=${handleSubmit}>
                    <${FormInput}
                        label="Correo electrónico"
                        name="email"
                        type="email"
                        value=${email}
                        onInput=${(e) => setEmail(e.target.value)}
                        theme="dark"
                    />
                    
                    <${FormInput}
                        label="Contraseña"
                        name="password"
                        type="password"
                        value=${password}
                        onInput=${(e) => setPassword(e.target.value)}
                        theme="dark"
                    />

                    <div>
                        <button 
                            type="submit" 
                            disabled=${loading}
                            class="group relative flex w-full justify-center rounded-md border border-transparent bg-primary py-2 px-4 text-sm font-medium text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ${loading ? html`<${Spinner} />` : 'Iniciar Sesión'}
                        </button>
                    </div>
                </form>

                <div class="mt-6 border-t border-white/20 pt-4">
                     <p class="text-center text-xs text-amber-300">
                        <a href="#" onClick=${(e) => { e.preventDefault(); navigate('/admin-delete-tool'); }} class="font-medium hover:text-amber-200">
                           Acceso a Herramienta de Administrador Temporal
                        </a>
                    </p>
                </div>

            </div>
        </div>
    `;
}