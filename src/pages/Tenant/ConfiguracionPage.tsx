/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { FormInput } from '../../components/FormComponents.js';
import { useToast } from '../../hooks/useToast.js';
import { supabase } from '../../lib/supabaseClient.js';
import { Spinner } from '../../components/Spinner.js';
import { useLoading } from '../../hooks/useLoading.js';

export function ConfiguracionPage({ user, onLogout, onProfileUpdate, companyInfo, notifications, onCompanyInfoUpdate, navigate }) {
    const { addToast } = useToast();
    const { startLoading, stopLoading } = useLoading();
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        nombre: '',
        nit: '',
        direccion: '',
        telefono: '',
    });
    const [logoFile, setLogoFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [dataError, setDataError] = useState(null);

    useEffect(() => {
        if (companyInfo) {
            setFormData({
                nombre: companyInfo.name || '',
                nit: companyInfo.nit || '',
                direccion: companyInfo.direccion || '',
                telefono: companyInfo.telefono || '',
            });
            setPreviewUrl(companyInfo.logo);
        }
        
        if (user && !user.empresa_id) {
            setDataError("No se pudo identificar la empresa de tu cuenta. Esto es un error de consistencia de datos que impide guardar cambios. Por favor, ejecuta el script de reparación de datos del archivo DATA_INTEGRITY_FIX.md y vuelve a iniciar sesión.");
        } else {
            setDataError(null);
        }

    }, [companyInfo, user]);

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                addToast({ message: 'El archivo es demasiado grande (máx 2MB).', type: 'error' });
                return;
            }
            setLogoFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };
    
    const handleSave = async () => {
        if (dataError) {
            addToast({ message: 'No se puede guardar debido a un error de datos. Sigue las instrucciones en el mensaje de error.', type: 'error', duration: 8000 });
            return;
        }

        if (!formData.nombre.trim() || !formData.nit.trim()) {
            addToast({ message: 'El nombre de la empresa y el NIT son obligatorios.', type: 'error' });
            return;
        }

        setIsSaving(true);
        startLoading();
        try {
            let logoUrl = previewUrl;

            // --- LÓGICA DE SUBIDA DIRECTA A STORAGE (igual que avatares) ---
            if (logoFile) {
                if (!user.empresa_id) {
                    throw new Error("No se pudo identificar la empresa del usuario para subir el logo.");
                }

                const fileExt = logoFile.name.split('.').pop();
                const filePath = `${user.empresa_id}/logo.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('logos')
                    .upload(filePath, logoFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('logos')
                    .getPublicUrl(filePath);
                
                logoUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
            }
            // --- FIN DE LA NUEVA LÓGICA ---

            const { error: rpcError } = await supabase.rpc('update_company_info', {
                p_nombre: formData.nombre,
                p_nit: formData.nit,
                p_direccion: formData.direccion,
                p_telefono: formData.telefono,
                p_logo: logoUrl
            });

            if (rpcError) throw rpcError;

            onCompanyInfoUpdate({
                name: formData.nombre,
                logo: logoUrl,
                nit: formData.nit,
                direccion: formData.direccion,
                telefono: formData.telefono
            });

            addToast({ message: 'Configuración guardada con éxito.', type: 'success' });

        } catch (error) {
            console.error("Error saving configuration:", error);
            addToast({ message: `Error al guardar: ${error.message}`, type: 'error', duration: 10000 });
        } finally {
            setIsSaving(false);
            stopLoading();
        }
    };

    const breadcrumbs = [
        { name: 'Configuración', href: '#/configuracion' }
    ];

    const canEdit = user.role === 'Propietario';

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Configuración"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-2xl font-semibold text-gray-900">Configuración de la Empresa</h1>
                    <p class="mt-1 text-sm text-gray-600">Actualiza los datos y el logo de tu empresa.</p>
                </div>
                 ${canEdit && html`
                    <button 
                        onClick=${handleSave}
                        disabled=${isSaving || !!dataError}
                        class="flex-shrink-0 w-full sm:w-auto flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50 disabled:bg-gray-400 min-w-[120px]"
                    >
                        ${isSaving ? html`<${Spinner}/>` : 'Guardar Cambios'}
                    </button>
                 `}
            </div>

            ${dataError && html`
                <div class="mt-6 p-4 rounded-md bg-red-50 text-red-800 border border-red-200" role="alert">
                    <h3 class="font-bold flex items-center gap-2">${ICONS.error} Error Crítico de Datos</h3>
                    <p class="mt-2 text-sm">${dataError}</p>
                </div>
            `}

            <div class="mt-8 max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow-sm border">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="md:col-span-1">
                        <h3 class="text-lg font-medium leading-6 text-gray-900">Logo de la Empresa</h3>
                        <p class="mt-1 text-sm text-gray-500">
                            Este logo aparecerá en la barra lateral y en futuros documentos.
                        </p>
                        <div class="mt-4 flex flex-col items-center">
                            ${previewUrl ? html`
                                <img src=${previewUrl} alt="Logo de la empresa" class="h-32 w-32 rounded-lg object-contain bg-slate-100 p-2 border" />
                            ` : html`
                                <div class="h-32 w-32 rounded-lg bg-slate-100 border flex items-center justify-center">
                                    <div class="text-slate-400 text-5xl">${ICONS.business}</div>
                                </div>
                            `}
                            <input
                                ref=${fileInputRef}
                                type="file"
                                class="hidden"
                                accept="image/png, image/jpeg, image/svg+xml"
                                onChange=${handleFileChange}
                                disabled=${!canEdit || !!dataError}
                            />
                            ${canEdit && html`
                                <button
                                    onClick=${() => fileInputRef.current.click()}
                                    type="button"
                                    disabled=${!!dataError}
                                    class="mt-4 w-full flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    ${ICONS.upload_file}
                                    Cambiar Logo
                                </button>
                            `}
                        </div>
                    </div>
                    <div class="md:col-span-2">
                        <h3 class="text-lg font-medium leading-6 text-gray-900">Información General</h3>
                        <div class="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-6">
                            <div class="sm:col-span-2">
                                <${FormInput} label="Nombre de la Empresa" name="nombre" type="text" value=${formData.nombre} onInput=${handleInput} disabled=${!canEdit || !!dataError} />
                            </div>
                            <div class="sm:col-span-1">
                                <${FormInput} label="NIT" name="nit" type="text" value=${formData.nit} onInput=${handleInput} disabled=${!canEdit || !!dataError} />
                            </div>
                             <div class="sm:col-span-1">
                                <${FormInput} label="Teléfono" name="telefono" type="tel" value=${formData.telefono} onInput=${handleInput} required=${false} disabled=${!canEdit || !!dataError} />
                            </div>
                            <div class="sm:col-span-2">
                                <${FormInput} label="Dirección" name="direccion" type="text" value=${formData.direccion} onInput=${handleInput} required=${false} disabled=${!canEdit || !!dataError} />
                            </div>
                        </div>
                        ${!canEdit && !dataError && html`
                            <div class="mt-6 p-4 rounded-md bg-blue-50 text-blue-700 text-sm" role="alert">
                                <p>Solo el rol de <strong>Propietario</strong> puede editar esta información.</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        <//>
    `;
}