/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useState, useEffect } from 'preact/hooks';
import { html } from 'htm/preact';

import { supabase } from './lib/supabaseClient.js';
import { LoadingPage } from './components/LoadingPage.js';
import { LoginPage } from './pages/Login/LoginPage.js';
import { RegistrationFlow } from './pages/Registro/RegistrationFlow.js';
import { SuperAdminPage } from './pages/SuperAdmin/SuperAdminPage.js';
import { CompanyDetailsPage } from './pages/SuperAdmin/CompanyDetailsPage.js';
import { DashboardPage } from './pages/Tenant/DashboardPage.js';
import { TerminalVentaPage } from './pages/Tenant/TerminalVentaPage.js';
import { ProductosPage } from './pages/Tenant/ProductosPage.js';
import { ProductoDetailPage } from './pages/Tenant/ProductoDetailPage.js';
import { InventariosPage } from './pages/Tenant/InventariosPage.js';
import { ComprasPage } from './pages/Tenant/ComprasPage.js';
import { VentasPage } from './pages/Tenant/VentasPage.js';
import { SucursalesListPage } from './pages/Tenant/SucursalesListPage.js';
import { SucursalDetailPage } from './pages/Tenant/SucursalDetailPage.js';
import { ProveedoresPage } from './pages/Tenant/ProveedoresPage.js';
import { ClientesPage } from './pages/Tenant/ClientesPage.js';
import { TraspasosPage } from './pages/Tenant/TraspasosPage.js';
import { GastosPage } from './pages/Tenant/GastosPage.js';
import { LicenciaPage } from './pages/Tenant/LicenciaPage.js';
import { ConfiguracionPage } from './pages/Tenant/ConfiguracionPage.js';
import { SuspendedLicensePage } from './pages/Tenant/SuspendedLicensePage.js';
import { AdminToolPage } from './pages/Admin/AdminToolPage.js';
import { ToastProvider, useToast } from './hooks/useToast.js';
import { LoadingProvider } from './hooks/useLoading.js';
import { UPGRADE_PLANS, REGISTRATION_PLANS } from './lib/plansConfig.js';


function AppContent() {
    const [session, setSession] = useState(null);
    const [companyInfo, setCompanyInfo] = useState(null);
    const [displayUser, setDisplayUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingSteps, setLoadingSteps] = useState([]);
    const [hasLoadFailed, setHasLoadFailed] = useState(false); // Circuit breaker state
    const [currentPath, setCurrentPath] = useState(() => window.location.hash.substring(1) || '/login');
    const { addToast } = useToast();

    const navigate = (path) => {
        window.location.hash = path;
    };

    // Effect 1: Manages Auth State and URL hash changes ONLY.
    useEffect(() => {
        const onHashChange = () => {
            setCurrentPath(window.location.hash.substring(1) || '/login');
        };
        window.addEventListener('hashchange', onHashChange);
        
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (!session) {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        if (!window.location.hash) {
            window.location.hash = '/login';
        }

        return () => {
            window.removeEventListener('hashchange', onHashChange);
            subscription.unsubscribe();
        };
    }, []);

    // Effect 2: Manages data fetching based on session state. This is the core sequential loading logic.
    useEffect(() => {
        if (!session) {
            // User is logged out, clear all state.
            setDisplayUser(null);
            setCompanyInfo(null);
            setLoading(false);
            setHasLoadFailed(false); // Reset circuit breaker on logout
            const current = window.location.hash.substring(1);
            if (!current.startsWith('/registro') && !current.startsWith('/admin-delete-tool')) {
                navigate('/login');
            }
            return;
        }

        // --- FIX START: Prevent race condition during registration ---
        // If a session is detected but we are still on the registration page,
        // it means signUp just completed. We must wait for the RegistrationFlow
        // component to finish its process (including signOut) before proceeding.
        if (window.location.hash.startsWith('#/registro')) {
            return;
        }
        // --- FIX END ---

        if (hasLoadFailed) return; // Circuit breaker is active, do not proceed.

        const loadUserData = async () => {
            setLoading(true);

            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            const initialSteps = [
                { key: 'profile', label: 'Cargando Perfil de Usuario', status: 'pending' },
                { key: 'company', label: 'Verificando Información de la Empresa', status: 'pending' },
                { key: 'branch', label: 'Obteniendo Datos de la Sucursal', status: 'pending' },
            ];
            
            const updateStepStatus = (key, status) => {
                setLoadingSteps(prevSteps => 
                    prevSteps.map(step => step.key === key ? { ...step, status } : step)
                );
            };

            setLoadingSteps(initialSteps);
            await delay(100); // Allow state to update before starting
            updateStepStatus('profile', 'loading');
            
            const fetchWithTimeout = (promise, timeout = 8000) => {
                let timeoutId;
                const timeoutPromise = new Promise((_, reject) => {
                    timeoutId = setTimeout(() => {
                        reject(new Error('La solicitud tardó demasiado. Revisa tu conexión a internet.'));
                    }, timeout);
                });
                return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
            };

            try {
                // --- Step 1: Fetch ALL initial data in one go to avoid RLS recursion ---
                const profilePromise = supabase
                    .rpc('get_user_profile_data')
                    .single();

                const { data: profile, error: profileError } = await fetchWithTimeout(profilePromise);
                
                // As requested by user, log the received data for debugging.
                console.log('Datos recibidos de la función get_user_profile_data:', profile);

                if (profileError) throw profileError;
                if (!profile) throw new Error("Error Crítico: Usuario autenticado pero no se encontraron datos de perfil.");
                
                // --- Orchestrate the visual success sequence ---
                updateStepStatus('profile', 'success');
                await delay(1000); // 1-second pause

                updateStepStatus('company', 'loading');
                await delay(150); // Show spinner briefly
                updateStepStatus('company', 'success');
                await delay(1000); // 1-second pause

                updateStepStatus('branch', 'loading');
                await delay(150); // Show spinner briefly
                updateStepStatus('branch', 'success');
                await delay(2000); // 2-second pause for the final step

                // --- Step 2: All data is here, construct final user and company objects ---
                let companyData = null;
                if (profile.empresa_id) {
                    const planName = profile.plan_actual || 'Sin Plan';
                    const basePlanName = planName.split('(')[0].trim();
                    const allPlans = [...REGISTRATION_PLANS, ...UPGRADE_PLANS];
                    const planDetails = allPlans.find(p => p.title === basePlanName);

                    companyData = {
                        name: profile.empresa_nombre,
                        nit: profile.empresa_nit,
                        direccion: profile.empresa_direccion,
                        telefono: profile.empresa_telefono,
                        plan: planName,
                        logo: profile.empresa_logo,
                        planDetails: planDetails,
                        licenseStatus: profile.estado_licencia || 'Activa',
                        licenseEndDate: profile.fecha_fin_licencia,
                        paymentHistory: profile.historial_pagos || [],
                    };
                }
                setCompanyInfo(companyData);
                
                const branchName = profile.sucursal_principal_nombre || 'Sucursal Principal';
                setDisplayUser({
                    id: session.user.id,
                    empresa_id: profile.empresa_id,
                    email: session.user.email,
                    name: profile.nombre_completo,
                    role: profile.rol,
                    avatar: profile.avatar,
                    sucursal: profile.rol === 'SuperAdmin' ? 'Global' : branchName,
                });

                // Check for suspended license before navigating
                if (companyData && companyData.licenseStatus === 'Suspendida') {
                    // Do not navigate away, the renderer will handle showing the suspended page.
                } else {
                    const expectedPath = profile.rol === 'SuperAdmin' ? '/superadmin' : '/dashboard';
                    const currentHash = window.location.hash.substring(1);

                    // Don't redirect if we are already on a valid superadmin sub-page
                    const isSuperAdminSubRoute = currentHash.startsWith('/superadmin/');

                    if (profile.rol === 'SuperAdmin' && !currentHash.startsWith('/superadmin')) {
                        navigate('/superadmin');
                    } else if (profile.rol !== 'SuperAdmin' && (currentHash === '/login' || currentHash === '/')) {
                         navigate(expectedPath);
                    }
                }
                
                setLoading(false);

            } catch (error) {
                console.error('Error during user data loading:', error);
                
                setLoadingSteps(prevSteps => {
                    const currentStepIndex = prevSteps.findIndex(s => s.status === 'loading');
                    if (currentStepIndex > -1) {
                        const newSteps = [...prevSteps];
                        newSteps[currentStepIndex] = { ...newSteps[currentStepIndex], status: 'error' };
                        return newSteps;
                    }
                    const newSteps = [...initialSteps];
                    if (newSteps.length > 0) {
                      newSteps[0] = { ...newSteps[0], status: 'error' };
                    }
                    return newSteps;
                });
                
                let friendlyError = error.message;
                if (error.message.includes('relation "public.get_user_profile_data" does not exist') || error.message.includes('function public.get_user_profile_data() does not exist')) {
                    friendlyError = "La función 'get_user_profile_data' no existe o está desactualizada. Por favor, ejecuta el nuevo script SQL del archivo DATABASE_FIX.md.";
                }

                addToast({ message: `Error crítico al cargar datos: ${friendlyError}`, type: 'error', duration: Infinity });
                setHasLoadFailed(true); // Activate the circuit breaker
            }
        };

        loadUserData();

    }, [session, hasLoadFailed]); // Add hasLoadFailed to dependency array


    const handleLogin = async (email, pass) => {
        const trimmedEmail = email.trim();
        const trimmedPassword = pass.trim();
        if (!trimmedEmail || !trimmedPassword) {
            throw new Error('El correo y la contraseña son obligatorios.');
        }
        const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password: trimmedPassword });
        if (error) {
            console.error('Login Error Details:', error);
            throw error;
        }
    };

    const handleLogout = async () => {
        setLoading(true); // Show loading screen immediately on logout
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error during signOut call:', error);
            handleForceLogout();
        }
    };

    const handleForceLogout = () => {
        console.warn('Forcing logout due to potential stale state.');
        setSession(null);
        setDisplayUser(null);
        setCompanyInfo(null);
        setLoading(false);
        setHasLoadFailed(false); // Also reset circuit breaker on forced logout
        navigate('/login');
    };

    const handleProfileUpdate = (updatedData) => {
        setDisplayUser(currentUser => ({
            ...currentUser,
            ...updatedData
        }));
    };

    const handleCompanyInfoUpdate = (updatedData) => {
        setCompanyInfo(currentInfo => ({
            ...currentInfo,
            ...updatedData
        }));
    };

    if (loading) {
        return html`<${LoadingPage} onForceLogout=${handleForceLogout} steps=${loadingSteps} />`;
    }

    let content;
    const isRegistrationRoute = currentPath.startsWith('/registro');
    const isAdminToolRoute = currentPath === '/admin-delete-tool';

    if (displayUser) {
        // --- START: Intercept for Suspended License ---
        if (companyInfo && companyInfo.licenseStatus === 'Suspendida' && displayUser.role !== 'SuperAdmin') {
            content = html`<${SuspendedLicensePage} user=${displayUser} onLogout=${handleLogout} onProfileUpdate=${handleProfileUpdate} companyInfo=${companyInfo} />`;
        // --- END: Intercept for Suspended License ---
        } else if (displayUser.role === 'SuperAdmin') {
            const companyDetailsMatch = currentPath.match(/^\/superadmin\/empresa\/(.+)$/);
            if (companyDetailsMatch) {
                const companyId = companyDetailsMatch[1];
                content = html`<${CompanyDetailsPage} companyId=${companyId} user=${displayUser} onLogout=${handleLogout} navigate=${navigate} onProfileUpdate=${handleProfileUpdate} />`;
            } else if (currentPath.startsWith('/superadmin')) {
                content = html`<${SuperAdminPage} user=${displayUser} onLogout=${handleLogout} navigate=${navigate} onProfileUpdate=${handleProfileUpdate} />`;
            } else {
                navigate('/superadmin');
            }
        } else if (displayUser.role === 'Propietario' || displayUser.role === 'Administrador' || displayUser.role === 'Empleado') {
            const commonProps = { 
                user: displayUser, 
                onLogout: handleLogout,
                companyInfo: companyInfo,
                notifications: { support: [], system: [] },
                onProfileUpdate: handleProfileUpdate,
                onCompanyInfoUpdate: handleCompanyInfoUpdate,
                navigate: navigate,
            };

            const sucursalDetailsMatch = currentPath.match(/^\/sucursales\/(.+)$/);
            const productoDetailsMatch = currentPath.match(/^\/productos\/(.+)$/);

            if (currentPath === '/dashboard') {
                content = html`<${DashboardPage} ...${commonProps} />`;
            } else if (currentPath === '/terminal-venta') {
                content = html`<${TerminalVentaPage} ...${commonProps} />`;
            } else if (currentPath === '/productos') {
                content = html`<${ProductosPage} ...${commonProps} />`;
            } else if (productoDetailsMatch) {
                const productoId = productoDetailsMatch[1];
                content = html`<${ProductoDetailPage} productoId=${productoId} ...${commonProps} />`;
            } else if (currentPath === '/inventarios') {
                content = html`<${InventariosPage} ...${commonProps} />`;
            } else if (currentPath === '/compras') {
                content = html`<${ComprasPage} ...${commonProps} />`;
            } else if (currentPath === '/ventas') {
                content = html`<${VentasPage} ...${commonProps} />`;
            } else if (currentPath === '/sucursales') {
                content = html`<${SucursalesListPage} ...${commonProps} />`;
            } else if (sucursalDetailsMatch) {
                const sucursalId = sucursalDetailsMatch[1];
                content = html`<${SucursalDetailPage} sucursalId=${sucursalId} ...${commonProps} />`;
            } else if (currentPath === '/proveedores') {
                content = html`<${ProveedoresPage} ...${commonProps} />`;
            } else if (currentPath === '/clientes') {
                content = html`<${ClientesPage} ...${commonProps} />`;
            } else if (currentPath === '/traspasos') {
                content = html`<${TraspasosPage} ...${commonProps} />`;
            } else if (currentPath === '/gastos') {
                content = html`<${GastosPage} ...${commonProps} />`;
            } else if (currentPath === '/licencia') {
                content = html`<${LicenciaPage} ...${commonProps} />`;
            } else if (currentPath === '/configuracion') {
                content = html`<${ConfiguracionPage} ...${commonProps} />`;
            } else {
                navigate('/dashboard');
            }
        } else {
             handleLogout(); // For other roles
        }
    } else {
        if (isRegistrationRoute) {
            content = html`<${RegistrationFlow} navigate=${navigate} />`;
        } else if (isAdminToolRoute) {
            content = html`<${AdminToolPage} navigate=${navigate} />`;
        } else {
            content = html`<${LoginPage} onLogin=${handleLogin} navigate=${navigate} />`;
        }
    }

    return html`<div class="h-full font-sans">${content}</div>`;
}

export function App() {
    return html`
        <${ToastProvider}>
            <${LoadingProvider}>
                <${AppContent} />
            <//>
        <//>
    `;
}