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
import { DashboardLayout } from './components/DashboardLayout.js';
import { DashboardPage } from './pages/Tenant/DashboardPage.js';
import { TerminalVentaPage } from './pages/Tenant/TerminalVentaPage.js';
import { ProductosPage } from './pages/Tenant/ProductosPage.js';
import { ProductoDetailPage } from './pages/Tenant/ProductoDetailPage.js';
import { InventariosPage } from './pages/Tenant/InventariosPage.js';
import { ComprasPage } from './pages/Tenant/ComprasPage.js';
import { NuevaCompraPage } from './pages/Tenant/NuevaCompraPage.js';
import { CompraDetailPage } from './pages/Tenant/CompraDetailPage.js';
import { VentasPage } from './pages/Tenant/VentasPage.js';
import { VentaDetailPage } from './pages/Tenant/VentaDetailPage.js';
import { SucursalesListPage } from './pages/Tenant/SucursalesListPage.js';
import { SucursalDetailPage } from './pages/Tenant/SucursalDetailPage.js';
import { ProveedoresPage } from './pages/Tenant/ProveedoresPage.js';
import { ClientesPage } from './pages/Tenant/ClientesPage.js';
import { TraspasosPage } from './pages/Tenant/TraspasosPage.js';
import { NuevoTraspasoPage } from './pages/Tenant/NuevoTraspasoPage.js';
import { TraspasoDetailPage } from './pages/Tenant/TraspasoDetailPage.js';
import { GastosPage } from './pages/Tenant/GastosPage.js';
import { LicenciaPage } from './pages/Tenant/LicenciaPage.js';
import { ConfiguracionPage } from './pages/Tenant/ConfiguracionPage.js';
import { NotificacionesPage } from './pages/Tenant/NotificacionesPage.js';
import { SuspendedLicensePage } from './pages/Tenant/SuspendedLicensePage.js';
import { PendingApprovalPage } from './pages/Tenant/PendingApprovalPage.js';
import { AdminToolPage } from './pages/Admin/AdminToolPage.js';
import { ToastProvider, useToast } from './hooks/useToast.js';
import { LoadingProvider } from './hooks/useLoading.js';
import { UPGRADE_PLANS, REGISTRATION_PLANS } from './lib/plansConfig.js';
import { RealtimeProvider } from './hooks/useRealtime.js';


function AppContent() {
    const [session, setSession] = useState(null);
    const [companyInfo, setCompanyInfo] = useState(null);
    const [displayUser, setDisplayUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
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
            if (!session) {
                setLoading(false);
                setIsLoggingOut(false);
                setLoadingSteps([]);
            }
        });

        if (!window.location.hash) {
            window.location.hash = '/login';
        }

        return () => {
            window.removeEventListener('hashchange', onHashChange);
            subscription.unsubscribe();
        };
    }, []);

    // Effect 2: Manages data fetching based on session state.
    useEffect(() => {
        if (!session) {
            setDisplayUser(null);
            setCompanyInfo(null);
            setLoading(false);
            setHasLoadFailed(false);
            const current = window.location.hash.substring(1);
            if (!current.startsWith('/registro') && !current.startsWith('/admin-delete-tool')) {
                navigate('/login');
            }
            return;
        }

        if (window.location.hash.startsWith('#/registro')) {
            return;
        }
       
        if (hasLoadFailed) return;
        
        if (displayUser) {
            return;
        }

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
            await delay(100); 
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
                const profilePromise = supabase
                    .rpc('get_user_profile_data')
                    .single();

                const { data: profile, error: profileError } = await fetchWithTimeout(profilePromise);
                
                if (profileError) throw profileError;
                if (!profile) throw new Error("Error Crítico: Usuario autenticado pero no se encontraron datos de perfil.");
                
                updateStepStatus('profile', 'success');
                await delay(1000);

                updateStepStatus('company', 'loading');
                await delay(150);
                updateStepStatus('company', 'success');
                await delay(1000);

                updateStepStatus('branch', 'loading');
                await delay(150);
                updateStepStatus('branch', 'success');
                await delay(2000);

                const getCurrencySymbol = (monedaCode) => {
                    const symbolMap = {
                        'BOB': 'Bs', 'ARS': '$', 'BRL': 'R$', 'CLP': '$',
                        'COP': '$', 'USD': '$', 'GTQ': 'Q', 'HNL': 'L',
                        'MXN': '$', 'PAB': 'B/.', 'PYG': '₲', 'PEN': 'S/',
                        'DOP': 'RD$', 'UYU': '$U', 'EUR': '€'
                    };
                    return symbolMap[monedaCode] || monedaCode;
                };

                let companyData = null;
                if (profile.empresa_id) {
                    const planName = profile.plan_actual || 'Sin Plan';
                    const basePlanName = planName.split('(')[0].trim();
                    const allPlans = [...REGISTRATION_PLANS, ...UPGRADE_PLANS];
                    const planDetails = allPlans.find(p => p.title === basePlanName);

                    companyData = {
                        name: profile.empresa_nombre,
                        nit: profile.empresa_nit,
                        plan: planName,
                        logo: profile.empresa_logo,
                        planDetails: planDetails,
                        licenseStatus: profile.estado_licencia || 'Activa',
                        licenseEndDate: profile.fecha_fin_licencia,
                        paymentHistory: profile.historial_pagos || [],
                        timezone: profile.empresa_timezone,
                        moneda: profile.empresa_moneda,
                        monedaSimbolo: getCurrencySymbol(profile.empresa_moneda),
                    };
                }
                setCompanyInfo(companyData);
                
                const branchName = profile.sucursal_principal_nombre || 'Sucursal Principal';
                setDisplayUser({
                    id: session.user.id,
                    empresa_id: profile.empresa_id,
                    sucursal_id: profile.sucursal_id,
                    email: session.user.email,
                    name: profile.nombre_completo,
                    role: profile.rol,
                    avatar: profile.avatar,
                    sucursal: profile.rol === 'SuperAdmin' ? 'Global' : branchName,
                });

                if (companyData && (companyData.licenseStatus === 'Suspendida' || companyData.licenseStatus === 'Pendiente de Aprobación')) {
                    // Renderer will handle showing the appropriate page.
                } else {
                    const expectedPath = profile.rol === 'SuperAdmin' ? '/superadmin' : '/dashboard';
                    const currentHash = window.location.hash.substring(1);

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
                setHasLoadFailed(true);
            }
        };

        loadUserData();

    }, [session, hasLoadFailed, displayUser]);


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
        setIsLoggingOut(true);
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const logoutSteps = [
            { key: 'logout_server', label: 'Cerrando sesión en el servidor', status: 'pending' },
            { key: 'cleanup', label: 'Limpiando datos de la aplicación', status: 'pending' },
        ];
        
        const updateStepStatus = (key, status) => {
            setLoadingSteps(prevSteps => 
                prevSteps.map(step => step.key === key ? { ...step, status } : step)
            );
        };
        
        setLoadingSteps(logoutSteps);
        await delay(100);
        updateStepStatus('logout_server', 'loading');
        
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error('Error during signOut call:', error);
            addToast({ message: 'Error al cerrar sesión. Forzando cierre local.', type: 'error' });
            handleForceLogout(); // Force a local logout if Supabase fails
            return;
        }
        
        updateStepStatus('logout_server', 'success');
        await delay(500);
        
        updateStepStatus('cleanup', 'loading');
        await delay(1000);
        updateStepStatus('cleanup', 'success');
        
        await delay(500);
        // The onAuthStateChange listener will handle the final state cleanup
    };

    const handleForceLogout = () => {
        console.warn('Forcing logout due to potential stale state.');
        setSession(null);
        setDisplayUser(null);
        setCompanyInfo(null);
        setLoading(false);
        setIsLoggingOut(false);
        setHasLoadFailed(false);
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

    let content;
    const isRegistrationRoute = currentPath.startsWith('/registro');
    const isAdminToolRoute = currentPath === '/admin-delete-tool';

    if (session) {
        if (!displayUser) {
            const shellUser = { name: ' ', email: session.user.email, role: '', sucursal: 'Cargando...', avatar: null };
            const shellCompany = { name: ' ', licenseStatus: 'Activa' };
            content = html`
                <${DashboardLayout} 
                    user=${shellUser} 
                    companyInfo=${shellCompany} 
                    onLogout=${handleLogout} 
                    onProfileUpdate=${handleProfileUpdate} 
                    disableNavigation=${true}
                >
                    <div />
                <//>`;
        } else if (companyInfo && companyInfo.licenseStatus === 'Suspendida' && displayUser.role !== 'SuperAdmin') {
            content = html`<${SuspendedLicensePage} user=${displayUser} onLogout=${handleLogout} onProfileUpdate=${handleProfileUpdate} companyInfo=${companyInfo} />`;
        } else if (companyInfo && companyInfo.licenseStatus === 'Pendiente de Aprobación' && displayUser.role !== 'SuperAdmin') {
            content = html`<${PendingApprovalPage} user=${displayUser} onLogout=${handleLogout} onProfileUpdate=${handleProfileUpdate} companyInfo=${companyInfo} />`;
        } else if (displayUser.role === 'SuperAdmin') {
            const companyDetailsMatch = currentPath.match(/^\/superadmin\/empresa\/(.+)$/);
            if (companyDetailsMatch) {
                const companyId = companyDetailsMatch[1];
                content = html`<${CompanyDetailsPage} companyId=${companyId} user=${displayUser} onLogout=${handleLogout} navigate=${navigate} onProfileUpdate=${handleProfileUpdate} />`;
            } else {
                content = html`<${SuperAdminPage} user=${displayUser} onLogout=${handleLogout} navigate=${navigate} onProfileUpdate=${handleProfileUpdate} />`;
            }
        } else if (displayUser.role === 'Propietario' || displayUser.role === 'Administrador' || displayUser.role === 'Empleado') {
            const commonProps = { 
                user: displayUser, 
                onLogout: handleLogout,
                companyInfo: companyInfo,
                onProfileUpdate: handleProfileUpdate,
                onCompanyInfoUpdate: handleCompanyInfoUpdate,
                navigate: navigate,
            };

            const sucursalDetailsMatch = currentPath.match(/^\/sucursales\/(.+)$/);
            const productoDetailsMatch = currentPath.match(/^\/productos\/(.+)$/);
            const compraDetailsMatch = currentPath.match(/^\/compras\/(.+)$/);
            const ventaDetailsMatch = currentPath.match(/^\/ventas\/(.+)$/);
            const traspasoDetailsMatch = currentPath.match(/^\/traspasos\/(.+)$/);
            
            let tenantContent;

            if (currentPath === '/dashboard') tenantContent = html`<${DashboardPage} ...${commonProps} />`;
            else if (currentPath === '/terminal-venta') tenantContent = html`<${TerminalVentaPage} ...${commonProps} />`;
            else if (currentPath === '/productos') tenantContent = html`<${ProductosPage} ...${commonProps} />`;
            else if (productoDetailsMatch) { const id = productoDetailsMatch[1]; tenantContent = html`<${ProductoDetailPage} productoId=${id} ...${commonProps} />`; }
            else if (currentPath === '/inventarios') tenantContent = html`<${InventariosPage} ...${commonProps} />`;
            else if (currentPath === '/compras') tenantContent = html`<${ComprasPage} ...${commonProps} />`;
            else if (currentPath === '/compras/nueva') tenantContent = html`<${NuevaCompraPage} ...${commonProps} />`;
            else if (compraDetailsMatch) { const id = compraDetailsMatch[1]; tenantContent = html`<${CompraDetailPage} compraId=${id} ...${commonProps} />`; }
            else if (currentPath === '/ventas') tenantContent = html`<${VentasPage} ...${commonProps} />`;
            else if (ventaDetailsMatch) { const id = ventaDetailsMatch[1]; tenantContent = html`<${VentaDetailPage} ventaId=${id} ...${commonProps} />`; }
            else if (currentPath === '/sucursales') tenantContent = html`<${SucursalesListPage} ...${commonProps} />`;
            else if (sucursalDetailsMatch) { const id = sucursalDetailsMatch[1]; tenantContent = html`<${SucursalDetailPage} sucursalId=${id} ...${commonProps} />`; }
            else if (currentPath === '/proveedores') tenantContent = html`<${ProveedoresPage} ...${commonProps} />`;
            else if (currentPath === '/clientes') tenantContent = html`<${ClientesPage} ...${commonProps} />`;
            else if (currentPath === '/traspasos') tenantContent = html`<${TraspasosPage} ...${commonProps} />`;
            else if (currentPath === '/traspasos/nuevo') tenantContent = html`<${NuevoTraspasoPage} ...${commonProps} />`;
            else if (traspasoDetailsMatch) { const id = traspasoDetailsMatch[1]; tenantContent = html`<${TraspasoDetailPage} traspasoId=${id} ...${commonProps} />`; }
            else if (currentPath === '/gastos') tenantContent = html`<${GastosPage} ...${commonProps} />`;
            else if (currentPath === '/licencia') tenantContent = html`<${LicenciaPage} ...${commonProps} />`;
            else if (currentPath === '/configuracion') tenantContent = html`<${ConfiguracionPage} ...${commonProps} />`;
            else if (currentPath === '/notificaciones') tenantContent = html`<${NotificacionesPage} ...${commonProps} />`;
            else {
                // Default route for logged-in users if hash is something unexpected
                navigate('/dashboard');
                tenantContent = html`<${DashboardPage} ...${commonProps} />`;
            }
            
            content = tenantContent;
        } else {
             handleLogout(); // For other roles or inconsistent states
        }
    } else {
        // Logged-out state
        if (isRegistrationRoute) {
            content = html`<${RegistrationFlow} navigate=${navigate} />`;
        } else if (isAdminToolRoute) {
            content = html`<${AdminToolPage} navigate=${navigate} />`;
        } else {
            content = html`<${LoginPage} onLogin=${handleLogin} navigate=${navigate} />`;
        }
    }


    return html`
        <div class="h-full font-sans relative">
            ${content}
            ${(loading || isLoggingOut) && html`<${LoadingPage} onForceLogout=${handleForceLogout} steps=${loadingSteps} />`}
        </div>
    `;
}

export function App() {
    return html`
        <${ToastProvider}>
            <${LoadingProvider}>
                <${RealtimeProvider}>
                    <${AppContent} />
                <//>
            <//>
        <//>
    `;
}