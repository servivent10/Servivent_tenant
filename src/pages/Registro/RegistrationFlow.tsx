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

function StepEmpresa({ onNext, navigate, formData, handleInput, formErrors }) {
    const handleSubmit = (e) => {
        e.preventDefault();
        if (onNext()) {
            // The onNext function now returns a boolean indicating success
        }
    };
    return html`
        <form onSubmit=${handleSubmit}>
            <h3 class="text-lg font-semibold text-gray-900">1. Datos de la Empresa</h3>
            <div class="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
                <${FormInput} label="Nombre de la Empresa" name="empresa_nombre" type="text" value=${formData.empresa_nombre} onInput=${handleInput} error=${formErrors.empresa_nombre} />
                <${FormInput} label="NIT" name="empresa_nit" type="text" value=${formData.empresa_nit} onInput=${handleInput} error=${formErrors.empresa_nit} />
                <div class="sm:col-span-2"><${FormInput} label="Dirección" name="empresa_direccion" type="text" value=${formData.empresa_direccion} onInput=${handleInput} required=${false} /></div>
                <${FormInput} label="Teléfono" name="empresa_telefono" type="tel" value=${formData.empresa_telefono} onInput=${handleInput} required=${false} />
            </div>
            <${FormButtons} onBack=${() => navigate('/login')} backText="Cancelar" />
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
            <h3 class="text-lg font-semibold text-gray-900">2. Crea tu cuenta de Propietario</h3>
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
            <h3 class="text-lg font-semibold text-gray-900">3. Registra tu Sucursal Principal</h3>
            <div class="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
                <${FormInput} label="Nombre de la Sucursal (Ej: Casa Matriz)" name="sucursal_nombre" type="text" value=${formData.sucursal_nombre} onInput=${handleInput} error=${formErrors.sucursal_nombre} />
                <${FormInput} label="Dirección" name="sucursal_direccion" type="text" value=${formData.sucursal_direccion} onInput=${handleInput} required=${false} />
                <${FormInput} label="Teléfono" name="sucursal_telefono" type="tel" value=${formData.sucursal_telefono} onInput=${handleInput} required=${false} />
            </div>
            <${FormButtons} onBack=${onBack} />
        </form>
    `;
}

function StepPlan({ onBack, onSelectPlan, error }) {
    return html`
        <div>
            <h3 class="text-lg font-semibold text-gray-900">4. Elige tu Plan</h3>
            ${error && html`<div class="mt-4 p-4 rounded-md bg-red-50 text-red-700 text-sm" aria-live="assertive"><p>${error}</p></div>`}
            
            <div class="isolate mx-auto mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
                ${REGISTRATION_PLANS.map(plan => html`<${PlanCard} plan=${plan} onSelect=${onSelectPlan} />`)}
            </div>

            <div class="mt-8 flex justify-start">
              <button type="button" onClick=${onBack} class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Volver</button>
            </div>
        </div>
    `;
}

export function RegistrationFlow({ navigate }) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        empresa_nombre: '',
        empresa_nit: '',
        empresa_direccion: '',
        empresa_telefono: '',
        user_nombre: '',
        user_email: '',
        user_password: '',
        sucursal_nombre: 'Sucursal Principal',
        sucursal_direccion: '',
        sucursal_telefono: '',
    });
    const [loading, setLoading] = useState(false);
    const [registrationSteps, setRegistrationSteps] = useState([]);
    const [error, setError] = useState('');
    const [formErrors, setFormErrors] = useState({});
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const totalSteps = 4;

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
        
        // Real-time validation
        const errorMessage = validateField(name, value);
        setFormErrors(prev => ({ ...prev, [name]: errorMessage }));
    };

    const validateStep = (currentStep) => {
        setError('');
        let newErrors = {};
        let isValid = true;
        const fieldsToValidate = {
            1: ['empresa_nombre', 'empresa_nit'],
            2: ['user_nombre', 'user_email', 'user_password'],
            3: ['sucursal_nombre']
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
        if (validateStep(step)) {
            setStep(s => Math.min(s + 1, totalSteps));
            return true;
        }
        return false;
    };
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    const handleInitiateRegistration = (planDetails) => {
        if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
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
            { key: 'auth', label: 'Creando tu cuenta de usuario', status: 'pending' },
            { key: 'company', label: 'Registrando los datos de la empresa', status: 'pending' },
            { key: 'finalize', label: 'Finalizando configuración', status: 'pending' },
        ];
        setRegistrationSteps(initialSteps);

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const updateStepStatus = (key, status) => {
            setRegistrationSteps(prevSteps => 
                prevSteps.map(step => step.key === key ? { ...step, status } : step)
            );
        };
        
        await delay(100); // Allow UI to update before starting heavy work

        try {
            const trimmedEmail = formData.user_email.trim();

            // --- Step 1: Create Auth User ---
            updateStepStatus('auth', 'loading');
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: trimmedEmail,
                password: formData.user_password,
            });

            if (signUpError) {
                if (signUpError.message.includes('User already registered')) throw new Error('El correo electrónico ya está registrado. Por favor, usa otro.');
                if (signUpError.message.includes('Password should be at least 6 characters')) throw new Error('La contraseña es demasiado corta. Debe tener al menos 6 caracteres.');
                throw new Error(`Error de autenticación: ${signUpError.message}`);
            }
            if (!signUpData.user) throw new Error('No se pudo crear el usuario en el sistema de autenticación. Por favor, inténtalo de nuevo.');
            
            updateStepStatus('auth', 'success');
            await delay(500);

            // --- Step 2: Create Company Data ---
            updateStepStatus('company', 'loading');
            const params = {
                p_user_id: signUpData.user.id,
                p_user_nombre_completo: formData.user_nombre.trim(),
                p_user_email: trimmedEmail,
                p_empresa_nombre: formData.empresa_nombre.trim(),
                p_empresa_nit: formData.empresa_nit.trim(),
                p_empresa_direccion: formData.empresa_direccion.trim(),
                p_empresa_telefono: formData.empresa_telefono.trim(),
                p_sucursal_nombre: formData.sucursal_nombre.trim(),
                p_sucursal_direccion: formData.sucursal_direccion.trim(),
                p_sucursal_telefono: formData.sucursal_telefono.trim(),
                p_plan_tipo: getPlanTypeString(),
            };
            const { error: rpcError } = await supabase.rpc('finish_registration', params);

            if (rpcError) {
                console.error("RPC Error:", rpcError);
                let detailedError = rpcError.message.includes('ERROR_NIT_DUPLICADO')
                    ? `El NIT "${formData.empresa_nit.trim()}" ya ha sido registrado por otra empresa.`
                    : `Causa: ${rpcError.message}.`;
                throw new Error(`¡Error Crítico! Se creó tu cuenta de usuario, pero falló el registro de la empresa. ${detailedError} Para solucionar esto, ve a la "Herramienta de Administrador" en la página de inicio de sesión y elimina el usuario con el correo "${trimmedEmail}" antes de volver a intentarlo.`);
            }
            updateStepStatus('company', 'success');
            await delay(500);

            // --- Step 3: Finalize and Redirect ---
            updateStepStatus('finalize', 'loading');
            await supabase.auth.signOut();
            updateStepStatus('finalize', 'success');
            await delay(1000);
            
            navigate('/login');

        } catch (err) {
            console.error("Full Registration Flow Error:", err);
            setError(err.message);
            
            // Mark the failing step as 'error'
            setRegistrationSteps(prevSteps => {
                const currentStepIndex = prevSteps.findIndex(s => s.status === 'loading');
                if (currentStepIndex > -1) {
                    const newSteps = [...prevSteps];
                    newSteps[currentStepIndex] = { ...newSteps[currentStepIndex], status: 'error' };
                    return newSteps;
                }
                return prevSteps;
            });

            // Stop loading so the user can see the error on the form
            setLoading(false);
        }
    };

    const steps = [
        { name: 'Empresa', href: '#', status: step > 1 ? 'complete' : (step === 1 ? 'current' : 'upcoming') },
        { name: 'Propietario', href: '#', status: step > 2 ? 'complete' : (step === 2 ? 'current' : 'upcoming') },
        { name: 'Sucursal', href: '#', status: step > 3 ? 'complete' : (step === 3 ? 'current' : 'upcoming') },
        { name: 'Plan', href: '#', status: step === 4 ? 'current' : 'upcoming' },
    ];

    const stepProps = { formData, handleInput, formErrors, validateStep };
    
    if (loading) {
        return html`<${LoadingPage} steps=${registrationSteps} onForceLogout=${() => navigate('/login')} />`;
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
                  ${step === 2 && html`<${StepPropietario} onNext=${nextStep} onBack=${prevStep} ...${stepProps} />`}
                  ${step === 3 && html`<${StepSucursal} onNext=${nextStep} onBack=${prevStep} ...${stepProps} />`}
                  ${step === 4 && html`<${StepPlan} onBack=${prevStep} onSelectPlan=${handleInitiateRegistration} error=${error} />`}
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
                <p class="text-sm text-gray-300">Estás a punto de crear una nueva cuenta para tu empresa <span class="font-bold text-white">${formData.empresa_nombre}</span> con el plan <span class="font-bold text-white">${getPlanTypeString()}</span>.</p>
                <p class="text-sm text-gray-300 mt-2">¿Deseas continuar?</p>
            <//>
        </div>
    `;
}