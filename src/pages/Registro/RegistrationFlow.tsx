/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useState } from 'preact/hooks';
import { html } from 'htm/preact';
import { supabase } from '../../lib/supabaseClient.js';
import { FormInput, FormButtons } from '../../components/FormComponents.js';
import { PlanCard } from '../../components/PlanCard.js';
import { ConfirmationModal } from '../../components/ConfirmationModal.js';
import { ICONS } from '../../components/Icons.js';
import { LoadingPage } from '../../components/LoadingPage.js';
import { REGISTRATION_PLANS } from '../../lib/plansConfig.js';

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
                 <label for="pais" class="block text-sm font-medium leading-6 text-gray-900">País</label>
                <select id="pais" name="pais" value=${formData.pais} onChange=${handleCountryChange} class="mt-2 block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/25 sm:text-sm sm:leading-6">
                    ${countries.map(c => html`<option key=${c.name} value=${c.name}>${c.name}</option>`)}
                </select>
            </div>
            <${FormButtons} onBack=${onBack} />
        </form>
    `;
}


function StepPropietario({ onNext, onBack, formData, handleInput, formErrors }) {
    const handleSubmit = (e) => {
        e.preventDefault();
        onNext();
    };
     return html`
        <form onSubmit=${handleSubmit}>
            <h3 class="text-lg font-semibold text-gray-900">3. Crea tu cuenta de Propietario</h3>
            <div class="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
                <div class="sm:col-span-2"><${FormInput} label="Nombre Completo" name="user_nombre" type="text" value=${formData.user_nombre} onInput=${handleInput} error=${formErrors.user_nombre} /></div>
                <${FormInput} label="Correo electrónico" name="user_email" type="email" value=${formData.user_email} onInput=${handleInput} error=${formErrors.user_email} />
                <${FormInput} label="Contraseña" name="user_password" type="password" value=${formData.user_password} onInput=${handleInput} error=${formErrors.user_password} />
            </div>
            <${FormButtons} onBack=${onBack} />
        </form>
    `;
}

function StepSucursal({ onNext, onBack, formData, handleInput, formErrors }) {
    const handleSubmit = (e) => {
        e.preventDefault();
        onNext();
    };
     return html`
        <form onSubmit=${handleSubmit}>
            <h3 class="text-lg font-semibold text-gray-900">4. Registra tu Sucursal Principal</h3>
            <div class="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
                <${FormInput} label="Nombre de la Sucursal (Ej: Casa Matriz)" name="sucursal_nombre" type="text" value=${formData.sucursal_nombre} onInput=${handleInput} error=${formErrors.sucursal_nombre} />
                <${FormInput} label="Dirección" name="sucursal_direccion" type="text" value=${formData.sucursal_direccion} onInput=${handleInput} required=${false} />
                <${FormInput} label="Teléfono" name="sucursal_telefono" type="tel" value=${formData.sucursal_telefono} onInput=${handleInput} required=${false} />
            </div>
            <${FormButtons} onBack=${onBack} />
        </form>
    `;
}

function StepPlan({ onBack, onSelectPlan, error, currencySymbol }) {
    return html`
        <div>
            <h3 class="text-lg font-semibold text-gray-900">5. Elige tu Plan</h3>
            ${error && html`<div class="mt-4 p-4 rounded-md bg-red-50 text-red-700 text-sm" aria-live="assertive"><p>${error}</p></div>`}
            
            <div class="isolate mx-auto mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
                ${REGISTRATION_PLANS.filter(p => !p.prices.free).map(plan => html`<${PlanCard} plan=${plan} onSelect=${onSelectPlan} showTrialInfo=${true} currencySymbol=${currencySymbol} />`)}
            </div>

            <div class="mt-8 flex justify-start">
              <button type="button" onClick=${onBack} class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Volver</button>
            </div>
        </div>
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

export function RegistrationFlow({ navigate }) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        empresa_nombre: '',
        empresa_nit: '',
        user_nombre: '',
        user_email: '',
        user_password: '',
        sucursal_nombre: 'Sucursal Principal',
        sucursal_direccion: '',
        sucursal_telefono: '',
        pais: 'Bolivia',
        timezone: 'America/La_Paz',
        moneda: 'BOB',
    });
    const [loading, setLoading] = useState(false);
    const [registrationSteps, setRegistrationSteps] = useState([]);
    const [error, setError] = useState('');
    const [formErrors, setFormErrors] = useState({});
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [successData, setSuccessData] = useState(null);
    const totalSteps = 5;

    const validateField = (name, value) => {
        switch (name) {
            case 'empresa_nombre':
                return value.trim() ? '' : 'El nombre de la empresa es obligatorio.';
            case 'empresa_nit':
                return value.trim() ? '' : 'El NIT es obligatorio.';
            case 'user_nombre':
                return value.trim() ? '' : 'Tu nombre completo es obligatorio.';
            case 'user_email': {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!value.trim()) return 'El correo electrónico es obligatorio.';
                return emailRegex.test(value.trim()) ? '' : 'Por favor, introduce un correo electrónico válido.';
            }
            case 'user_password': {
                if (!value) return 'La contraseña es obligatoria.';
                return value.length >= 6 ? '' : 'La contraseña debe tener al menos 6 caracteres.';
            }
            case 'sucursal_nombre':
                return value.trim() ? '' : 'El nombre de la sucursal es obligatorio.';
            default:
                return '';
        }
    };

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        const errorMessage = validateField(name, value);
        setFormErrors(prev => ({ ...prev, [name]: errorMessage }));
    };

    const handleCountryChange = (e) => {
        const selectedCountryName = e.target.value;
        const countryData = countries.find(c => c.name === selectedCountryName);
        if (countryData) {
            setFormData(prev => ({
                ...prev,
                pais: countryData.name,
                timezone: countryData.timezone,
                moneda: countryData.moneda,
            }));
        }
    };


    const validateStep = (currentStep) => {
        setError('');
        let newErrors = {};
        let isValid = true;
        const fieldsToValidate = {
            1: ['empresa_nombre', 'empresa_nit'],
            3: ['user_nombre', 'user_email', 'user_password'],
            4: ['sucursal_nombre']
        };

        const fieldsForStep = fieldsToValidate[currentStep] || [];
        fieldsForStep.forEach(fieldName => {
            const errorMessage = validateField(fieldName, formData[fieldName]);
            if (errorMessage) {
                newErrors[fieldName] = errorMessage;
                isValid = false;
            }
        });
        
        setFormErrors(prev => ({ ...prev, ...newErrors }));
        return isValid;
    };
    
    const nextStep = () => {
        if (step === 2 || validateStep(step)) { // Skip validation for country step
            setStep(s => Math.min(s + 1, totalSteps));
            return true;
        }
        return false;
    };

    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    const handleInitiateRegistration = (planDetails) => {
        if (!validateStep(1) || !validateStep(3) || !validateStep(4)) {
            setError("Por favor, corrige los errores en los pasos anteriores antes de continuar.");
            setStep(1); // Go back to the first step with errors
            return;
        }
        setSelectedPlan(planDetails);
        setIsConfirmModalOpen(true);
    };

    const getPlanTypeString = () => {
        if (!selectedPlan) return '';
        const { title, cycle } = selectedPlan;
        const cycleTextMap = {
            monthly: 'Mensual',
            yearly: 'Anual',
            lifetime: 'Pago Único'
        };
        const cycleText = cycleTextMap[cycle];
        return cycleText ? `${title} (${cycleText})` : title;
    };

    const handleConfirmRegistration = async () => {
        setIsConfirmModalOpen(false);
        setLoading(true);
        setError('');
        
        const initialSteps = [
            { key: 'creation', label: 'Creando cuenta, empresa y sucursal...', status: 'pending' },
            { key: 'finalize', label: 'Finalizando y preparando todo', status: 'pending' },
        ];
        setRegistrationSteps(initialSteps);

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const updateStepStatus = (key, status) => {
            setRegistrationSteps(prevSteps => 
                prevSteps.map(step => step.key === key ? { ...step, status } : step)
            );
        };
        
        await delay(100);

        try {
            updateStepStatus('creation', 'loading');
            const trimmedEmail = formData.user_email.trim();

            const registrationPayload = {
                // User fields
                nombre_completo: formData.user_nombre.trim(),
                correo: trimmedEmail,
                password: formData.user_password,
                rol: 'Propietario',
                // Company and branch fields
                empresa_nombre: formData.empresa_nombre.trim(),
                empresa_nit: formData.empresa_nit.trim(),
                sucursal_nombre: formData.sucursal_nombre.trim(),
                sucursal_direccion: formData.sucursal_direccion.trim(),
                sucursal_telefono: formData.sucursal_telefono.trim(),
                plan_tipo: getPlanTypeString(),
                timezone: formData.timezone,
                moneda: formData.moneda,
            };

            const { error: functionError } = await supabase.functions.invoke('create-company-user', {
                body: registrationPayload,
            });

            if (functionError) {
                let friendlyError = functionError.message;
                 if (functionError.context && typeof functionError.context.json === 'function') {
                    try {
                        const errorData = await functionError.context.json();
                        if (errorData.error) { friendlyError = errorData.error; }
                    } catch (e) { /* ignore json parsing error */ }
                }
                if (friendlyError.includes('Este correo electrónico ya está en uso.')) {
                    friendlyError += ` Si este es tu correo, intenta iniciar sesión. Si el problema persiste, usa la "Herramienta de Administrador" en la página de inicio para eliminar el usuario con este correo y vuelve a intentarlo.`
                }
                throw new Error(friendlyError);
            }

            updateStepStatus('creation', 'success');
            await delay(500);
            
            updateStepStatus('finalize', 'loading');
            await delay(1000);
            updateStepStatus('finalize', 'success');
            
            setSuccessData({
                empresa: formData.empresa_nombre.trim(),
                email: trimmedEmail,
            });
            setLoading(false);

        } catch (err) {
            console.error("Full Registration Flow Error:", err);
            setError(err.message);
            
            setRegistrationSteps(prevSteps => {
                const currentStepIndex = prevSteps.findIndex(s => s.status === 'loading');
                if (currentStepIndex > -1) {
                    const newSteps = [...prevSteps];
                    newSteps[currentStepIndex] = { ...newSteps[currentStepIndex], status: 'error' };
                    return newSteps;
                }
                return prevSteps;
            });

            setTimeout(() => {
                setLoading(false);
            }, 3000);
        }
    };

    const steps = [
        { name: 'Empresa', href: '#', status: step > 1 ? 'complete' : (step === 1 ? 'current' : 'upcoming') },
        { name: 'País', href: '#', status: step > 2 ? 'complete' : (step === 2 ? 'current' : 'upcoming') },
        { name: 'Propietario', href: '#', status: step > 3 ? 'complete' : (step === 3 ? 'current' : 'upcoming') },
        { name: 'Sucursal', href: '#', status: step > 4 ? 'complete' : (step === 4 ? 'current' : 'upcoming') },
        { name: 'Plan', href: '#', status: step === 5 ? 'current' : 'upcoming' },
    ];

    const stepProps = { formData, handleInput, formErrors, validateStep };
    
    if (loading) {
        return html`<${LoadingPage} steps=${registrationSteps} onForceLogout=${() => navigate('/login')} />`;
    }

    if (successData) {
        return html`
            <div class="flex min-h-full flex-col justify-center items-center px-6 py-12 lg:px-8 bg-slate-100">
                <div class="sm:mx-auto sm:w-full sm:max-w-md">
                     <div class="bg-white p-8 rounded-lg shadow-md">
                        <${RegistrationSuccess} successData=${successData} navigate=${navigate} />
                     </div>
                </div>
            </div>
        `;
    }

    return html`
        <div class="flex min-h-full flex-col justify-center items-center px-6 py-12 lg:px-8 bg-slate-100">
            <div class="sm:mx-auto sm:w-full sm:max-w-5xl">
                <h1 class="text-3xl font-bold text-center text-primary">ServiVENT</h1>
                <h2 class="mt-4 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">Registro de Nueva Empresa</h2>
                
                <nav aria-label="Progress" class="mt-8">
                  <ol role="list" class="space-y-4 md:flex md:space-x-8 md:space-y-0">
                    ${steps.map((s, index) => html`
                      <li class="md:flex-1">
                        ${s.status === 'complete' ? html`
                          <a href="#" onClick=${(e) => { e.preventDefault(); if (index < step - 1) setStep(index + 1); }} class="group flex flex-col border-l-4 border-primary py-2 pl-4 transition-colors hover:border-primary-dark md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4">
                            <span class="text-sm font-medium text-primary transition-colors">${`Paso ${index+1}`}</span>
                            <span class="text-sm font-medium">${s.name}</span>
                          </a>
                        ` : s.status === 'current' ? html`
                          <div class="flex flex-col border-l-4 border-primary py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4" aria-current="step">
                            <span class="text-sm font-medium text-primary">${`Paso ${index+1}`}</span>
                            <span class="text-sm font-medium">${s.name}</span>
                          </div>
                        ` : html`
                           <div class="group flex flex-col border-l-4 border-gray-200 py-2 pl-4 transition-colors md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4">
                            <span class="text-sm font-medium text-gray-500 transition-colors">${`Paso ${index+1}`}</span>
                            <span class="text-sm font-medium">${s.name}</span>
                          </div>
                        `}
                      </li>
                    `)}
                  </ol>
                </nav>

                <div class="mt-8 bg-white p-8 rounded-lg shadow-md min-h-[30rem]">
                  ${step === 1 && html`<${StepEmpresa} onNext=${nextStep} navigate=${navigate} ...${stepProps} />`}
                  ${step === 2 && html`<${StepLocalizacion} onNext=${nextStep} onBack=${prevStep} formData=${formData} handleCountryChange=${handleCountryChange} />`}
                  ${step === 3 && html`<${StepPropietario} onNext=${nextStep} onBack=${prevStep} ...${stepProps} />`}
                  ${step === 4 && html`<${StepSucursal} onNext=${nextStep} onBack=${prevStep} ...${stepProps} />`}
                  ${step === 5 && html`<${StepPlan} onBack=${prevStep} onSelectPlan=${handleInitiateRegistration} error=${error} currencySymbol=${getCurrencySymbol(formData.moneda)} />`}
                </div>
            </div>

            <${ConfirmationModal}
                isOpen=${isConfirmModalOpen}
                onClose=${() => setIsConfirmModalOpen(false)}
                onConfirm=${handleConfirmRegistration}
                title="Confirmar Registro"
                confirmText="Sí, crear cuenta"
                confirmVariant="primary"
                icon=${ICONS.business}
            >
                <p class="text-sm text-gray-600">Estás a punto de crear una nueva cuenta para tu empresa <span class="font-bold text-gray-800">${formData.empresa_nombre}</span> con el plan <span class="font-bold text-gray-800">${getPlanTypeString()}</span>.</p>
                <p class="text-sm text-gray-600 mt-2">¿Deseas continuar?</p>
            <//>
        </div>
    `;
}