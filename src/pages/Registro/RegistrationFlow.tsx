/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { html } from 'htm/preact';
import { supabase } from '../../lib/supabaseClient.js';
import { FormInput, FormButtons, FormSelect } from '../../components/FormComponents.js';
import { PlanCard } from '../../components/PlanCard.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { ICONS } from '../../components/Icons.js';
import { LoadingPage } from '../../components/LoadingPage.js';
import { Spinner } from '../../components/Spinner.js';

const countries = [
    { name: 'Argentina', timezone: 'America/Argentina/Buenos_Aires', moneda: 'ARS' },
    { name: 'Bolivia', timezone: 'America/La_Paz', moneda: 'BOB' },
    { name: 'Brasil', timezone: 'America/Sao_Paulo', moneda: 'BRL' },
    { name: 'Chile', timezone: 'America/Santiago', moneda: 'CLP' },
    { name: 'Colombia', timezone: 'America/Bogota', moneda: 'COP' },
    { name: 'Ecuador', timezone: 'America/Guayaquil', moneda: 'USD' },
    { name: 'El Salvador', timezone: 'America/El_Salvador', moneda: 'USD' },
    { name: 'España', timezone: 'Europe/Madrid', moneda: 'EUR' },
    { name: 'Guatemala', timezone: 'America/Guatemala', moneda: 'GTQ' },
    { name: 'Honduras', timezone: 'America/Tegucigalpa', moneda: 'HNL' },
    { name: 'México', timezone: 'America/Mexico_City', moneda: 'MXN' },
    { name: 'Panamá', timezone: 'America/Panama', moneda: 'USD' },
    { name: 'Paraguay', timezone: 'America/Asuncion', moneda: 'PYG' },
    { name: 'Perú', timezone: 'America/Lima', moneda: 'PEN' },
    { name: 'República Dominicana', timezone: 'America/Santo_Domingo', moneda: 'DOP' },
    { name: 'Uruguay', timezone: 'America/Montevideo', moneda: 'UYU' },
];

const getCurrencySymbol = (monedaCode) => {
    const symbolMap = {
        'BOB': 'Bs', 'ARS': '$', 'BRL': 'R$', 'CLP': '$',
        'COP': '$', 'USD': '$', 'GTQ': 'Q', 'HNL': 'L',
        'MXN': '$', 'PAB': 'B/.', 'PYG': '₲', 'PEN': 'S/',
        'DOP': 'RD$', 'UYU': '$U', 'EUR': '€'
    };
    return symbolMap[monedaCode] || monedaCode;
};


function StepEmpresa({ onNext, navigate, formData, handleInput, formErrors }) {
    const handleSubmit = (e) => {
        e.preventDefault();
        onNext();
    };
    return html`
        <form onSubmit=${handleSubmit}>
            <h3 class="text-lg font-semibold text-gray-900">1. Datos de la Empresa</h3>
            <div class="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
                <div class="sm:col-span-1"><${FormInput} label="Nombre de la Empresa" name="empresa_nombre" type="text" value=${formData.empresa_nombre} onInput=${handleInput} error=${formErrors.empresa_nombre} /></div>
                <div class="sm:col-span-1"><${FormInput} label="NIT" name="empresa_nit" type="text" value=${formData.empresa_nit} onInput=${handleInput} error=${formErrors.empresa_nit} /></div>
            </div>
            <${FormButtons} onBack=${() => navigate('/login')} backText="Cancelar" />
        </form>
    `;
}

function StepLocalizacion({ onNext, onBack, formData, handleCountryChange }) {
    const handleSubmit = (e) => {
        e.preventDefault();
        onNext();
    };
    return html`
        <form onSubmit=${handleSubmit}>
            <h3 class="text-lg font-semibold text-gray-900">2. Localización</h3>
            <p class="mt-1 text-sm text-gray-600">Selecciona el país donde opera tu empresa. Esto configurará la zona horaria y la moneda por defecto.</p>
            <div class="mt-6">
                 <${FormSelect} 
                    label="País" 
                    name="pais" 
                    value=${formData.pais} 
                    onInput=${handleCountryChange}
                >
                    ${countries.map(c => html`<option key=${c.name} value=${c.name}>${c.name}</option>`)}
                <//>
            </div>
            <${FormButtons} onBack=${onBack} />
        </form>
    `;
}


function StepPropietario({ onNext, onBack, formData, handleInput, formErrors, emailValidationStatus, emailError }) {
    const handleSubmit = (e) => {
        e.preventDefault();
        onNext();
    };
    
    let emailIndicator = null;
    if (emailValidationStatus === 'checking') emailIndicator = html`<${Spinner} size="h-5 w-5" color="text-gray-400" />`;
    else if (emailValidationStatus === 'valid') emailIndicator = html`<div class="text-green-500">${ICONS.success}</div>`;
    else if (emailValidationStatus === 'invalid') emailIndicator = html`<div class="text-red-500">${ICONS.error}</div>`;

     return html`
        <form onSubmit=${handleSubmit}>
            <h3 class="text-lg font-semibold text-gray-900">3. Crea tu cuenta de Propietario</h3>
            <div class="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
                <div class="sm:col-span-2"><${FormInput} label="Nombre Completo" name="user_nombre" type="text" value=${formData.user_nombre} onInput=${handleInput} error=${formErrors.user_nombre} /></div>
                <${FormInput} 
                    label="Correo electrónico" 
                    name="user_email" 
                    type="email" 
                    value=${formData.user_email} 
                    onInput=${handleInput} 
                    error=${formErrors.user_email || emailError}
                    rightElement=${emailIndicator}
                />
                <${FormInput} label="Contraseña" name="user_password" type="password" value=${formData.user_password} onInput=${handleInput} error=${formErrors.user_password} />
            </div>
            <${FormButtons} onBack=${onBack} />
        </form>
    `;
}

function StepSucursal({ onNext, onBack, formData, handleInput, formErrors, setFormData }) {
    const mapRef = useRef(null);
    const searchInputRef = useRef(null);
    const mapInstance = useRef(null);
    const markerInstance = useRef(null);
    const [isMapLoading, setIsMapLoading] = useState(true);

    const initAutocomplete = useCallback((map) => {
        if (!searchInputRef.current || !(window as any).google) return;
        const autocomplete = new (window as any).google.maps.places.Autocomplete(searchInputRef.current, { componentRestrictions: { country: "bo" }, fields: ["name", "formatted_address", "geometry"] });
        autocomplete.bindTo("bounds", map);
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.geometry && place.geometry.location) {
                map.setCenter(place.geometry.location);
                if (markerInstance.current) markerInstance.current.setPosition(place.geometry.location);
                let addressText = place.formatted_address || '';
                if (place.name && !addressText.toLowerCase().includes(place.name.toLowerCase())) addressText = `${place.name}, ${addressText}`;
                
                // Actualizar el valor del input de búsqueda y del formulario
                if (searchInputRef.current) searchInputRef.current.value = addressText;
                setFormData(prev => ({ ...prev, sucursal_direccion: addressText, sucursal_latitud: place.geometry.location.lat(), sucursal_longitud: place.geometry.location.lng() }));
            }
        });
    }, [setFormData]);

    const geocodePosition = useCallback((pos) => {
        if (!(window as any).google) return;
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ location: pos }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const address = results[0].formatted_address;
                setFormData(prev => ({ ...prev, sucursal_direccion: address }));
            } else {
                console.warn('Reverse geocoding failed due to: ' + status);
            }
        });
    }, [setFormData]);

    const initMap = useCallback(() => {
        if (mapInstance.current || !mapRef.current || !(window as any).google) return;
        setIsMapLoading(true);
        const defaultLocation = { lat: -17.7833, lng: -63.1821 };
        const setupGoogleMap = (location) => {
            mapInstance.current = new (window as any).google.maps.Map(mapRef.current, { center: location, zoom: 16, mapTypeControl: false, streetViewControl: false, fullscreenControl: false });
            markerInstance.current = new (window as any).google.maps.Marker({ position: location, map: mapInstance.current, draggable: true, title: "Arrastra para ajustar", animation: (window as any).google.maps.Animation.DROP });
            markerInstance.current.addListener('dragend', () => {
                const newPosition = markerInstance.current.getPosition();
                if (newPosition) {
                    setFormData(prev => ({ ...prev, sucursal_latitud: newPosition.lat(), sucursal_longitud: newPosition.lng() }));
                    geocodePosition(newPosition);
                }
            });
            initAutocomplete(mapInstance.current);
            setIsMapLoading(false);
        };
        setupGoogleMap(defaultLocation);
    }, [initAutocomplete, setFormData, geocodePosition]);
    
    useEffect(() => {
        setTimeout(initMap, 150);
        return () => {
            mapInstance.current = null;
            markerInstance.current = null;
        };
    }, [initMap]);
    
    // Sincronizar el input de dirección con el estado del formulario
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.value = formData.sucursal_direccion;
        }
    }, [formData.sucursal_direccion]);


    const handleSubmit = (e) => {
        e.preventDefault();
        onNext();
    };

    return html`
        <form onSubmit=${handleSubmit}>
            <h3 class="text-lg font-semibold text-gray-900">4. Registra tu Sucursal Principal</h3>
            <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-6">
                    <${FormInput} label="Nombre (Ej: Casa Matriz)" name="sucursal_nombre" type="text" value=${formData.sucursal_nombre} onInput=${handleInput} error=${formErrors.sucursal_nombre} />
                    <${FormInput} label="Teléfono (Opcional)" name="sucursal_telefono" type="tel" value=${formData.sucursal_telefono} onInput=${handleInput} required=${false} />
                    <${FormInput} label="Dirección Completa" name="sucursal_direccion" type="text" value=${formData.sucursal_direccion} onInput=${handleInput} required=${false} />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Ubicación en el Mapa</label>
                    <div class="mt-1 relative">
                        <input ref=${searchInputRef} type="text" placeholder="Buscar un lugar o dirección..." class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base bg-white text-gray-900 focus:outline-none focus:border-[#0d6efd] focus:ring-4 focus:ring-[#0d6efd]/25 sm:text-sm" />
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">${ICONS.search}</div>
                    </div>
                    <div ref=${mapRef} class="mt-2 h-64 w-full rounded-md bg-gray-200 relative overflow-hidden">
                        ${isMapLoading && html`<div class="absolute inset-0 flex items-center justify-center bg-gray-200/50"><${Spinner} color="text-primary"/></div>`}
                    </div>
                </div>
            </div>
            <${FormButtons} onBack=${onBack} />
        </form>
    `;
}

function StepPlan({ onBack, onSelectPlan, error, plans, isLoadingPlans }) {
    return html`
        <div>
            <h3 class="text-lg font-semibold text-gray-900">5. Elige tu Plan</h3>
            ${error && html`<div class="mt-4 p-4 rounded-md bg-red-50 text-red-700 text-sm" aria-live="assertive"><p>${error}</p></div>`}
            ${isLoadingPlans ? html`
                <div class="flex justify-center items-center h-64"><${Spinner} color="text-primary" size="h-10 w-10" /></div>
            ` : html`
                <div class="isolate mx-auto mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
                    ${plans.filter(p => !p.prices.free).map(plan => html`<${PlanCard} plan=${plan} onSelect=${onSelectPlan} showTrialInfo=${true} currencySymbol="$" />`)}
                </div>
            `}
            <div class="mt-8 flex justify-start">
              <button type="button" onClick=${onBack} class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Volver</button>
            </div>
        </div>
    `;
}

function StepModulos({ onBack, onNext, formData, handleModuleToggle, modules, isLoadingModules }) {
     const formatCurrencyUSD = (value) => {
        const number = Number(value || 0);
        return `$${number.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        onNext();
    };

    return html`
        <form onSubmit=${handleSubmit}>
            <h3 class="text-lg font-semibold text-gray-900">6. Módulos Adicionales</h3>
            <p class="mt-1 text-sm text-gray-600">Potencia tu negocio activando funcionalidades premium desde el inicio.</p>
            ${isLoadingModules ? html`
                <div class="flex justify-center items-center h-64"><${Spinner} color="text-primary" size="h-10 w-10" /></div>
            ` : html`
                <div class="mt-6 space-y-4">
                    ${modules.map(mod => html`
                        <div key=${mod.id} class="relative flex items-start p-4 border rounded-lg has-[:checked]:bg-blue-50 has-[:checked]:border-blue-200">
                            <div class="flex h-6 items-center">
                                <input 
                                    id=${`mod-${mod.id}`} 
                                    name="selected_modules" 
                                    type="checkbox" 
                                    value=${mod.id}
                                    checked=${formData.selected_modules.includes(mod.id)}
                                    onChange=${() => handleModuleToggle(mod.id)}
                                    class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                            </div>
                            <div class="ml-3 text-sm leading-6">
                                <label for=${`mod-${mod.id}`} class="font-medium text-gray-900">${mod.nombre_visible}</label>
                                <p class="text-gray-500">${mod.descripcion}</p>
                                <p class="text-gray-700 font-semibold mt-1">${formatCurrencyUSD(mod.precio_mensual)} / mes</p>
                            </div>
                        </div>
                    `)}
                </div>
            `}
            <${FormButtons} onBack=${onBack} nextText="Finalizar" />
        </form>
    `;
}

function RegistrationSuccess({ successData, navigate }) {
    return html`
        <div class="text-center animate-fade-in-down">
            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <div class="text-green-600 text-4xl">${ICONS.success}</div>
            </div>
            <h3 class="mt-6 text-2xl font-bold text-gray-900">¡Solicitud Enviada!</h3>
            <div class="mt-4 text-gray-600 space-y-2">
                <p>Tu empresa <span class="font-semibold text-gray-800">${successData.empresa}</span> ha sido registrada y está pendiente de aprobación.</p>
                <p>Nuestro equipo revisará tu solicitud y activará tu cuenta a la brevedad posible. Recibirás una notificación por correo electrónico a <span class="font-semibold text-gray-800">${successData.email}</span> una vez que esté lista.</p>
            </div>
            <div class="mt-8">
                <button 
                    onClick=${() => navigate('/login')}
                    class="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    Finalizar
                </button>
            </div>
        </div>
    `;
}

const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
};

export function RegistrationFlow({ navigate }) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<any>({
        empresa_nombre: '', empresa_nit: '',
        user_nombre: '', user_email: '', user_password: '',
        sucursal_nombre: 'Sucursal Principal', sucursal_direccion: '', sucursal_telefono: '',
        sucursal_latitud: null, sucursal_longitud: null,
        pais: 'Bolivia', timezone: 'America/La_Paz', moneda: 'BOB',
        selected_modules: [],
    });
    const [loading, setLoading] = useState(false);
    const [registrationSteps, setRegistrationSteps] = useState([]);
    const [error, setError] = useState('');
    // FIX: Explicitly type formErrors state to prevent TypeScript errors on property access.
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [successData, setSuccessData] = useState(null);
    const totalSteps = 6;

    const [plans, setPlans] = useState([]);
    const [modules, setModules] = useState([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(true);
    const [isLoadingModules, setIsLoadingModules] = useState(true);

    const [emailValidationStatus, setEmailValidationStatus] = useState('idle');
    const [emailError, setEmailError] = useState('');

    const validateEmail = useCallback(async (email) => {
        if (!email.trim()) {
            setEmailValidationStatus('idle');
            setEmailError('');
            return;
        }

        setEmailValidationStatus('checking');
        setEmailError('');

        try {
            const { data, error } = await supabase.rpc('validate_user_email', { p_correo: email });
            if (error) throw error;
            if (data.valid) {
                setEmailValidationStatus('valid');
                setEmailError('');
            } else {
                setEmailValidationStatus('invalid');
                if (data.reason === 'format') setEmailError('Formato o proveedor no válido (ej: gmail, hotmail).');
                else if (data.reason === 'exists') setEmailError('Este correo ya está en uso.');
            }
        } catch (err) {
            setEmailValidationStatus('error');
            setEmailError('No se pudo verificar el correo.');
        }
    }, []);

    const debouncedValidateEmail = useCallback(debounce(validateEmail, 500), [validateEmail]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [plansRes, modulesRes] = await Promise.all([
                    supabase.rpc('get_public_plans'),
                    supabase.rpc('get_public_modules')
                ]);
                if (plansRes.error) throw plansRes.error;
                if (modulesRes.error) throw modulesRes.error;
                setPlans(plansRes.data || []);
                setModules(modulesRes.data || []);
            } catch (err) {
                setError('No se pudieron cargar los datos de configuración. Intenta recargar la página.');
            } finally {
                setIsLoadingPlans(false);
                setIsLoadingModules(false);
            }
        };
        fetchData();
    }, []);

    const validateField = (name, value) => {
        switch (name) {
            case 'empresa_nombre': return value.trim() ? '' : 'El nombre de la empresa es obligatorio.';
            case 'empresa_nit': return value.trim() ? '' : 'El NIT es obligatorio.';
            case 'user_nombre': return value.trim() ? '' : 'Tu nombre completo es obligatorio.';
            case 'user_email':
                if (!value.trim()) return 'El correo es obligatorio.';
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '' : 'Introduce un correo válido.';
            case 'user_password':
                if (!value) return 'La contraseña es obligatoria.';
                return value.length >= 6 ? '' : 'Debe tener al menos 6 caracteres.';
            case 'sucursal_nombre': return value.trim() ? '' : 'El nombre de la sucursal es obligatorio.';
            default: return '';
        }
    };

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        if (name === 'user_email') {
            debouncedValidateEmail(value);
        }
        
        if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
    };
    
    const handleModuleToggle = (moduleId) => {
        setFormData(prev => {
            const newSelection = prev.selected_modules.includes(moduleId)
                ? prev.selected_modules.filter(id => id !== moduleId)
                : [...prev.selected_modules, moduleId];
            return { ...prev, selected_modules: newSelection };
        });
    };

    const handleCountryChange = (e) => {
        const country = countries.find(c => c.name === e.target.value);
        if (country) setFormData(prev => ({ ...prev, pais: country.name, timezone: country.timezone, moneda: country.moneda }));
    };

    const validateStep = (currentStep) => {
        let isValid = true;
        const newFormErrors = { ...formErrors };
        
        const fieldsToValidate = { 
            1: ['empresa_nombre', 'empresa_nit'], 
            3: ['user_nombre', 'user_email', 'user_password'], 
            4: ['sucursal_nombre'] 
        };
        const fieldsForStep = fieldsToValidate[currentStep] || [];

        fieldsForStep.forEach(fieldName => {
            const errorMessage = validateField(fieldName, formData[fieldName]);
            if (errorMessage) {
                newFormErrors[fieldName] = errorMessage;
                isValid = false;
            }
        });
        
        if (currentStep === 3) {
            if (emailValidationStatus === 'invalid') {
                isValid = false;
                newFormErrors.user_email = emailError || 'Correo no válido.';
            } else if (emailValidationStatus !== 'valid') {
                isValid = false;
                 newFormErrors.user_email = 'Verifica que el correo sea válido antes de continuar.';
            }
        }
        
        setFormErrors(newFormErrors);
        return isValid;
    };
    
    const nextStep = () => {
        if ([2, 5].includes(step)) {
            setStep(s => s + 1);
        } else if (step === 6) {
             handleInitiateRegistration();
        } else if (validateStep(step)) {
             setStep(s => Math.min(s + 1, totalSteps));
        }
    };
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    const handleSelectPlan = (planDetails) => {
        setSelectedPlan(planDetails);
        nextStep();
    };

    const handleInitiateRegistration = () => {
        if (!validateStep(1) || !validateStep(3) || !validateStep(4) || !selectedPlan) {
            setError("Por favor, corrige los errores o completa todos los pasos anteriores.");
            setStep(1); return;
        }
        setIsConfirmModalOpen(true);
    };

    const getPlanTypeString = () => selectedPlan ? `${selectedPlan.title} (${{monthly:'Mensual', yearly:'Anual', lifetime:'Único'}[selectedPlan.cycle] || selectedPlan.cycle})` : '';

    const handleConfirmRegistration = async () => {
        setIsConfirmModalOpen(false);
        setLoading(true);
        setError('');
        
        const registrationPayload = {
            nombre_completo: formData.user_nombre.trim(), 
            correo: formData.user_email.trim(), 
            password: formData.user_password, 
            rol: 'Propietario',
            empresa_nombre: formData.empresa_nombre.trim(), 
            empresa_nit: formData.empresa_nit.trim(),
            sucursal_nombre: formData.sucursal_nombre.trim(), 
            sucursal_direccion: formData.sucursal_direccion.trim(), 
            sucursal_telefono: formData.sucursal_telefono.trim(),
            sucursal_latitud: formData.sucursal_latitud, 
            sucursal_longitud: formData.sucursal_longitud,
            plan_tipo: getPlanTypeString(), 
            timezone: formData.timezone, 
            moneda: formData.moneda, 
            selected_modules: formData.selected_modules
        };
        
        setRegistrationSteps([{ key: 'creation', label: 'Creando cuenta y empresa...', status: 'loading' }]);
        
        try {
            const { error: functionError } = await supabase.functions.invoke('create-company-user', { body: registrationPayload });
            if (functionError) {
                let friendlyError = 'Ocurrió un error inesperado.';
                 if (functionError.context && typeof functionError.context.json === 'function') {
                    try {
                        const errorData = await functionError.context.json();
                        if (errorData.error) friendlyError = errorData.error;
                    } catch (e) {}
                }
                throw new Error(friendlyError);
            }

            setRegistrationSteps(prev => prev.map(s => s.key === 'creation' ? {...s, status: 'success'} : s));
            setSuccessData({ empresa: formData.empresa_nombre.trim(), email: formData.user_email.trim() });
            
            setTimeout(() => {
                setLoading(false);
            }, 1500);

        } catch (err) {
            setError(err.message);
            setRegistrationSteps(prev => prev.map(s => s.key === 'creation' ? {...s, status: 'error'} : s));
            setTimeout(() => setLoading(false), 3000);
        }
    };

    const steps = [
        { name: 'Empresa', status: step > 1 ? 'complete' : (step === 1 ? 'current' : 'upcoming') },
        { name: 'País', status: step > 2 ? 'complete' : (step === 2 ? 'current' : 'upcoming') },
        { name: 'Propietario', status: step > 3 ? 'complete' : (step === 3 ? 'current' : 'upcoming') },
        { name: 'Sucursal', status: step > 4 ? 'complete' : (step === 4 ? 'current' : 'upcoming') },
        { name: 'Plan', status: step > 5 ? 'complete' : (step === 5 ? 'current' : 'upcoming') },
        { name: 'Módulos', status: step === 6 ? 'current' : 'upcoming' },
    ];
    
    if (loading) return html`<${LoadingPage} steps=${registrationSteps} onForceLogout=${() => navigate('/login')} />`;
    if (successData) return html`<div class="flex min-h-full flex-col justify-center items-center px-6 py-12 lg:px-8 bg-slate-100"><div class="sm:mx-auto sm:w-full sm:max-w-md"><div class="bg-white p-8 rounded-lg shadow-md"><${RegistrationSuccess} successData=${successData} navigate=${navigate} /></div></div></div>`;

    return html`
        <div class="flex min-h-full flex-col justify-center items-center px-6 py-12 lg:px-8 bg-slate-100">
            <div class="sm:mx-auto sm:w-full sm:max-w-5xl">
                <h1 class="text-3xl font-bold text-center text-primary">ServiVENT</h1>
                <h2 class="mt-4 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">Registro de Nueva Empresa</h2>
                <nav aria-label="Progress" class="mt-8">
                  <ol role="list" class="space-y-4 md:flex md:space-x-8 md:space-y-0">
                    ${steps.map((s, index) => html`
                      <li class="md:flex-1">
                        <div onClick=${() => step > index + 1 && setStep(index + 1)} class="group flex flex-col border-l-4 py-2 pl-4 transition-colors md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4 ${s.status === 'complete' ? 'border-primary hover:border-primary-dark cursor-pointer' : (s.status === 'current' ? 'border-primary' : 'border-gray-200')}">
                          <span class="text-sm font-medium ${s.status === 'complete' || s.status === 'current' ? 'text-primary' : 'text-gray-500'}">${`Paso ${index+1}`}</span>
                          <span class="text-sm font-medium text-gray-900">${s.name}</span>
                        </div>
                      </li>`)}
                  </ol>
                </nav>
                <div class="mt-8 bg-white p-8 rounded-lg shadow-md min-h-[30rem]">
                  ${step === 1 && html`<${StepEmpresa} onNext=${nextStep} navigate=${navigate} formData=${formData} handleInput=${handleInput} formErrors=${formErrors} />`}
                  ${step === 2 && html`<${StepLocalizacion} onNext=${nextStep} onBack=${prevStep} formData=${formData} handleCountryChange=${handleCountryChange} />`}
                  ${step === 3 && html`<${StepPropietario} onNext=${nextStep} onBack=${prevStep} formData=${formData} handleInput=${handleInput} formErrors=${formErrors} emailValidationStatus=${emailValidationStatus} emailError=${emailError} />`}
                  ${step === 4 && html`<${StepSucursal} onNext=${nextStep} onBack=${prevStep} formData=${formData} handleInput=${handleInput} formErrors=${formErrors} setFormData=${setFormData} />`}
                  ${step === 5 && html`<${StepPlan} onBack=${prevStep} onSelectPlan=${handleSelectPlan} error=${error} plans=${plans} isLoadingPlans=${isLoadingPlans} />`}
                  ${step === 6 && html`<${StepModulos} onBack=${prevStep} onNext=${nextStep} formData=${formData} handleModuleToggle=${handleModuleToggle} modules=${modules} isLoadingModules=${isLoadingModules} />`}
                </div>
            </div>
            <${ConfirmationModal} isOpen=${isConfirmModalOpen} onClose=${() => setIsConfirmModalOpen(false)} onConfirm=${handleConfirmRegistration} title="Confirmar Registro" confirmText="Sí, crear cuenta" icon=${ICONS.business}>
                <p class="text-sm text-gray-600">Estás a punto de crear una nueva cuenta para tu empresa <span class="font-bold text-gray-800">${formData.empresa_nombre}</span> con el plan <span class="font-bold text-gray-800">${getPlanTypeString()}</span>.</p>
                <p class="text-sm text-gray-600 mt-2">¿Deseas continuar?</p>
            <//>
        </div>
    `;
}