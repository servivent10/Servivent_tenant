/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useState } from 'preact/hooks';
import { html } from 'htm/preact';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Spinner } from '../../components/Spinner.js';
import { ServiVentLogo } from '../../components/Logo.js';

export function AdminToolPage({ navigate }) {
    const [supabaseUrl, setSupabaseUrl] = useState('https://fqqmbgqeikiaehzpdway.supabase.co');
    const [serviceKey, setServiceKey] = useState('');
    const [userId, setUserId] = useState('');
    const [advancedMode, setAdvancedMode] = useState(false);
    
    const [loading, setLoading] = useState({ diagnose: false, verify: false, delete: false });
    const [result, setResult] = useState({ type: '', message: '' });
    const [verifiedUser, setVerifiedUser] = useState(null);
    const [userList, setUserList] = useState([]);

    const sanitizeInput = (input) => input.trim();

    const getSupabaseAdminClient = () => {
        const sanitizedUrl = sanitizeInput(supabaseUrl);
        const sanitizedKey = sanitizeInput(serviceKey);
        
        if (!sanitizedUrl || !sanitizedKey) {
            setResult({ type: 'error', message: 'La URL del proyecto y la Service Role Key son obligatorias.' });
            return null;
        }
        return createClient(sanitizedUrl, sanitizedKey);
    };

    const handleDiagnoseAndList = async () => {
        setLoading(prev => ({ ...prev, diagnose: true }));
        setResult({ type: '', message: '' });
        setUserList([]);
        setVerifiedUser(null);

        const supabaseAdmin = getSupabaseAdminClient();
        if (!supabaseAdmin) {
            setLoading(prev => ({ ...prev, diagnose: false }));
            return;
        }

        try {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 10 });
            if (error) throw error;

            if (data.users && data.users.length > 0) {
                setUserList(data.users);
                setResult({ type: 'success', message: `¡Conexión exitosa! Se encontraron ${data.users.length} usuarios. Haz clic en 'Usar' para seleccionar un ID.` });
            } else {
                 setResult({ type: 'warning', message: '¡Conexión exitosa, pero no se encontraron usuarios! Verifica que la URL y la Clave corresponden al proyecto correcto que ves en tu panel de Supabase.' });
            }

        } catch (error) {
             console.error('Diagnostic Error:', error);
             let friendlyMessage = `ERROR de diagnóstico: ${error.message}.`;
             if (error.message && (error.message.toLowerCase().includes('invalid key') || error.message.toLowerCase().includes('invalid jwt'))) {
                friendlyMessage = 'ERROR: La Service Role Key o la URL son inválidas. No se pudo establecer la conexión.';
            }
            setResult({ type: 'error', message: friendlyMessage });
        } finally {
             setLoading(prev => ({ ...prev, diagnose: false }));
        }
    };
    
    const handleUseUser = (id) => {
        setUserId(id);
        setVerifiedUser(null);
        setResult({ type: '', message: '' });
        const element = document.getElementById('step-2-heading');
        element?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleVerifyUser = async () => {
        const sanitizedUserId = sanitizeInput(userId);
        if (!sanitizedUserId) {
            setResult({ type: 'error', message: 'El ID del usuario es obligatorio para verificar.' });
            return;
        }
        
        setLoading(prev => ({ ...prev, verify: true }));
        setResult({ type: '', message: '' });
        setVerifiedUser(null);
        
        const supabaseAdmin = getSupabaseAdminClient();
        if (!supabaseAdmin) {
            setLoading(prev => ({ ...prev, verify: false }));
            return;
        }

        try {
            const { data, error } = await supabaseAdmin.auth.admin.getUserById(sanitizedUserId);
            if (error) throw error;

            if (data.user) {
                setVerifiedUser(data.user);
                setResult({ type: 'success', message: `Usuario encontrado: ${data.user.email}. Ahora puedes proceder a eliminarlo.` });
            } else {
                 setResult({ type: 'error', message: 'Verificación fallida: No se encontró un usuario con ese ID.' });
            }
        } catch (error) {
            console.error('Verify User Error:', error);
            let friendlyMessage = `ERROR: ${error.message}.`;
             if (error.message && error.message.toLowerCase().includes('user not found')) {
                friendlyMessage = 'ERROR: Usuario no encontrado. Verifica que el ID del usuario es correcto y que la URL y la Clave corresponden al proyecto donde reside este usuario.';
            } else if (error.message && (error.message.toLowerCase().includes('invalid key') || error.message.toLowerCase().includes('invalid jwt'))) {
                friendlyMessage = 'ERROR: La Service Role Key o la URL son inválidas. No se puede verificar el usuario.';
            }
            setResult({ type: 'error', message: friendlyMessage });
        } finally {
            setLoading(prev => ({ ...prev, verify: false }));
        }
    };

    const handleDelete = async () => {
        const sanitizedUserId = sanitizeInput(userId);
        if (!sanitizedUserId) {
            setResult({ type: 'error', message: 'Debes introducir un ID de usuario para poder eliminarlo.' });
            return;
        }

        setLoading(prev => ({ ...prev, delete: true }));
        setResult({ type: '', message: '' });
        
        const supabaseAdmin = getSupabaseAdminClient();
        if (!supabaseAdmin) {
            setLoading(prev => ({ ...prev, delete: false }));
            return;
        }

        try {
            if (advancedMode) {
                // --- MODO AVANZADO ---
                const { data, error } = await supabaseAdmin.rpc('delete_user_by_id_forcefully', {
                    user_id_to_delete: sanitizedUserId
                });
                
                if (error) {
                    throw new Error(`Error RPC: ${error.message}. ¿Creaste la función SQL en tu base de datos?`);
                }

                if (typeof data === 'string' && data.startsWith('ÉXITO:')) {
                     setResult({ type: 'success', message: data });
                     setVerifiedUser(null);
                     setUserId('');
                     setUserList(prevList => prevList.filter(u => u.id !== sanitizedUserId));
                } else {
                    throw new Error(data || 'La función de eliminación forzosa devolvió una respuesta inesperada.');
                }

            } else {
                // --- MODO NORMAL ---
                const { error } = await supabaseAdmin.auth.admin.deleteUser(sanitizedUserId);
                if (error) throw error;
                
                const userEmail = verifiedUser?.id === sanitizedUserId ? verifiedUser.email : `con ID ${sanitizedUserId}`;
                setResult({ type: 'success', message: `¡ÉXITO! El usuario ${userEmail} ha sido eliminado permanentemente.` });
                setVerifiedUser(null);
                setUserId('');
                setUserList(prevList => prevList.filter(u => u.id !== sanitizedUserId));
            }

        } catch (error) {
            console.error('Admin Deletion Error:', error);
            let friendlyMessage = `ERROR al eliminar: ${error.message}`;
             if (error.message && error.message.toLowerCase().includes('user not found')) {
                friendlyMessage = 'ERROR: El usuario no fue encontrado y no pudo ser eliminado. Verifica que el ID es correcto.';
            }
            setResult({ type: 'error', message: friendlyMessage });
        } finally {
            setLoading(prev => ({ ...prev, delete: false }));
        }
    };

    const isAnyLoading = loading.diagnose || loading.verify || loading.delete;
    const areCredentialsEntered = sanitizeInput(supabaseUrl) && sanitizeInput(serviceKey);

    const resultClasses = {
        success: 'bg-green-100 text-green-800',
        error: 'bg-red-100 text-red-800',
        warning: 'bg-amber-100 text-amber-800',
    };
    
    const deleteButtonClass = advancedMode
        ? "bg-amber-600 hover:bg-amber-500"
        : "bg-red-600 hover:bg-red-500";

    return html`
        <div class="flex min-h-full flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div class="w-full max-w-2xl space-y-8">
                <div>
                    <${ServiVentLogo} className="mx-auto h-12 w-auto" />
                    <h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                        Herramienta de Eliminación de Usuario
                    </h2>
                     <p class="mt-2 text-center text-sm text-gray-600">
                        Este panel se conecta directamente a tu proyecto de Supabase para eliminar un usuario de forma segura.
                    </p>
                </div>
                
                <div class="rounded-lg bg-white p-8 shadow-lg">
                    <div class="space-y-6">
                        <div>
                            <h3 class="text-base font-semibold leading-7 text-gray-900">Paso 1: Ingresa tus Credenciales de Administrador</h3>
                            <p class="text-sm text-gray-600 mt-1">Ve a <code class="bg-gray-100 p-1 rounded">Settings > API</code> en tu panel de Supabase. Asegúrate de que ambos datos correspondan al **mismo proyecto**.</p>
                            <div class="mt-4 space-y-4">
                                <div>
                                    <label for="supabase-url" class="block text-sm font-medium leading-6 text-gray-900">1. URL del Proyecto</label>
                                    <input id="supabase-url" type="text" placeholder="https://xxxxxxxx.supabase.co" value=${supabaseUrl} onInput=${e => setSupabaseUrl(e.target.value)}
                                        class="block w-full rounded-md border border-gray-300 p-2 bg-gray-50 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm transition-colors duration-200" />
                                </div>
                                 <div>
                                    <label for="service-key" class="block text-sm font-medium leading-6 text-gray-900">2. Service Role Key</label>
                                    <input id="service-key" type="password" placeholder="Pega tu clave secreta service_role aquí" value=${serviceKey} onInput=${e => setServiceKey(e.target.value)}
                                        class="block w-full rounded-md border border-gray-300 p-2 bg-gray-50 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm transition-colors duration-200" />
                                </div>
                            </div>
                        </div>

                         <div class="border-t pt-6">
                            <h3 class="text-base font-semibold leading-7 text-gray-900">Paso 2: Diagnóstico (Opcional pero Recomendado)</h3>
                             <p class="mt-1 text-sm text-gray-600">Confirma que tus credenciales funcionan listando los usuarios de tu proyecto.</p>
                             <div class="mt-4">
                                 <button onClick=${handleDiagnoseAndList} disabled=${isAnyLoading || !areCredentialsEntered} class="flex w-full justify-center rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-500 disabled:opacity-50 disabled:bg-gray-400">
                                    ${loading.diagnose ? html`<${Spinner} />` : 'Diagnosticar Conexión y Listar Usuarios'}
                                 </button>
                             </div>
                        </div>

                        ${userList.length > 0 && html`
                           <div class="border-t pt-6">
                                <h3 class="text-base font-semibold leading-7 text-gray-900">Usuarios Encontrados (hasta 10)</h3>
                                <div class="mt-4 flow-root">
                                    <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                                        <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                                            <table class="min-w-full divide-y divide-gray-300">
                                                <thead>
                                                    <tr>
                                                        <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Email</th>
                                                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">User ID</th>
                                                        <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0"><span class="sr-only">Usar</span></th>
                                                    </tr>
                                                </thead>
                                                <tbody class="divide-y divide-gray-200">
                                                    ${userList.map(user => html`
                                                        <tr>
                                                            <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">${user.email}</td>
                                                            <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono text-xs">${user.id}</td>
                                                            <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                                                                <button onClick=${() => handleUseUser(user.id)} class="text-blue-600 hover:text-blue-900">Usar</button>
                                                            </td>
                                                        </tr>
                                                    `)}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `}

                        <div class="border-t pt-6">
                             <h3 id="step-2-heading" class="text-base font-semibold leading-7 text-gray-900">Paso 3: Especifica el Usuario a Eliminar</h3>
                            <label for="user-id" class="mt-1 block text-sm font-medium leading-6 text-gray-600">Pega el ID del usuario o usa el botón "Usar" de la lista de arriba.</label>
                            <div class="mt-2">
                                <input id="user-id" type="text" placeholder="ID de Usuario (UUID)" value=${userId} onInput=${e => setUserId(e.target.value)}
                                    class="block w-full rounded-md border border-gray-300 p-2 bg-gray-50 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm transition-colors duration-200" />
                            </div>
                        </div>

                        <div class="border-t pt-6">
                             <h3 class="text-base font-semibold leading-7 text-gray-900">Paso 4: Verifica y Elimina</h3>
                             <p class="mt-1 text-sm text-gray-600">Puedes verificar al usuario para confirmar su identidad o proceder a eliminarlo directamente si conoces el ID correcto.</p>
                            
                            <div class="relative flex items-start mt-4 rounded-md bg-amber-50 p-4">
                                <div class="flex h-6 items-center">
                                    <input id="advanced-mode" type="checkbox" checked=${advancedMode} onChange=${(e) => setAdvancedMode(e.target.checked)} class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                </div>
                                <div class="ml-3 text-sm leading-6">
                                    <label for="advanced-mode" class="font-medium text-amber-900">Activar Modo Avanzado (Eliminación Forzosa)</label>
                                    <p class="text-amber-700">Usa este modo si la eliminación normal falla. <span class="font-semibold">Requiere</span> haber creado la función <code class="bg-amber-200 text-amber-900 rounded px-1 py-0.5">delete_user_by_id_forcefully</code> en el Editor SQL de Supabase.</p>
                                </div>
                            </div>
                            
                            <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                 <button onClick=${handleVerifyUser} disabled=${isAnyLoading || !areCredentialsEntered || !sanitizeInput(userId)} class="flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:bg-gray-400">
                                    ${loading.verify ? html`<${Spinner} />` : 'Verificar Usuario'}
                                </button>
                                <button onClick=${handleDelete} disabled=${isAnyLoading || !areCredentialsEntered || !sanitizeInput(userId)} class="flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm ${deleteButtonClass} disabled:opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                    ${loading.delete ? html`<${Spinner} />` : (advancedMode ? 'Eliminar Forzosamente' : 'Eliminar Permanentemente')}
                                </button>
                            </div>
                        </div>

                        ${result.message && html`
                            <div class="mt-4 p-4 rounded-md ${resultClasses[result.type] || 'bg-gray-100 text-gray-800'}">
                                <p class="text-sm font-medium">${result.message}</p>
                            </div>
                        `}
                        
                         <div class="border-t pt-6 text-center">
                            <button onClick=${() => navigate('/login')} disabled=${isAnyLoading} class="text-sm font-semibold leading-6 text-primary hover:text-primary-dark disabled:opacity-50">
                                Volver a Inicio de Sesión
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}