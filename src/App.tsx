/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useState, useEffect, useCallback } from 'preact/hooks';
import { html } from 'htm/preact';

import { supabase } from './lib/supabaseClient.js';
import { LoadingPage } from './components/LoadingPage.js';
import { LoginPage } from './pages/Login/LoginPage.js';
import { RegistrationFlow } from './pages/Registro/RegistrationFlow.js';
import { SuperAdminPage } from './pages/SuperAdmin/SuperAdminPage.js';
import { CompanyDetailsPage } from './pages/SuperAdmin/CompanyDetailsPage.js';
import { PlanesPage } from './pages/SuperAdmin/PlanesPage.js';
import { ModulosPage } from './pages/SuperAdmin/ModulosPage.js';
import { DashboardLayout } from './components/DashboardLayout.js';
import { DashboardPage } from './pages/Tenant/DashboardPage.js';
import { TerminalVentaPage } from './pages/Tenant/TerminalVentaPage.js';
import { ProductosPage } from './pages/Tenant/ProductosPage.js';
import { ProductoDetailPage } from './pages/Tenant/ProductoDetailPage.js';
import { InventariosPage } from './pages/Tenant/InventariosPage.js';
import { HistorialInventarioPage } from './pages/Tenant/HistorialInventarioPage.js';
import { ComprasPage } from './pages/Tenant/ComprasPage.js';
import { NuevaCompraPage } from './pages/Tenant/NuevaCompraPage.js';
import { CompraDetailPage } from './pages/Tenant/CompraDetailPage.js';
import { VentasPage } from './pages/Tenant/VentasPage.js';
import { VentaDetailPage } from './pages/Tenant/VentaDetailPage.js';
import { HistorialCajasPage } from './pages/Tenant/HistorialCajasPage.js';
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
import { AuditoriaPage } from './pages/Tenant/AuditoriaPage.js';
import { SuspendedLicensePage } from './pages/Tenant/SuspendedLicensePage.js';
import { PendingApprovalPage } from './pages/Tenant/PendingApprovalPage.js';
import { AdminToolPage } from './pages/Admin/AdminToolPage.js';
import { ToastProvider, useToast } from './hooks/useToast.js';
import { LoadingProvider } from './hooks/useLoading.js';
import { RealtimeProvider } from './hooks/useRealtime.js';
import { CatalogApp } from './pages/Public/CatalogApp.js';
import { TerminalVentaProvider, NuevaCompraProvider, ProductFormProvider, CatalogCartProvider, InitialSetupProvider } from './contexts/StatePersistence.js';

function TenantRoutes({ currentPath, navigate, ...commonProps }) {
    const sucursalDetailsMatch = currentPath.match(/^\/sucursales\/(.+)$/);
    const productoDetailsMatch = currentPath.match(/^\/productos\/(.+)$/);
    const compraDetailsMatch = currentPath.match(/^\/compras\/(.+)$/);
    const ventaDetailsMatch = currentPath.match(/^\/ventas\/(.+)$/);
    const traspasoDetailsMatch = currentPath.match(/^\/traspasos\/(.+)$/);
    
    if (currentPath === '/dashboard') return html`<${DashboardPage} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/terminal-venta') return html`<${TerminalVentaPage} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/productos') return html`<${ProductosPage} ...${commonProps} navigate=${navigate} />`;
    if (productoDetailsMatch) return html`<${ProductoDetailPage} productoId=${productoDetailsMatch[1]} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/inventarios') return html`<${InventariosPage} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/historial-inventario') return html`<${HistorialInventarioPage} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/compras') return html`<${ComprasPage} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/compras/nueva') return html`<${NuevaCompraPage} ...${commonProps} navigate=${navigate} />`;
    if (compraDetailsMatch) return html`<${CompraDetailPage} compraId=${compraDetailsMatch[1]} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/ventas') return html`<${VentasPage} ...${commonProps} navigate=${navigate} />`;
    if (ventaDetailsMatch) return html`<${VentaDetailPage} ventaId=${ventaDetailsMatch[1]} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/historial-cajas') return html`<${HistorialCajasPage} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/sucursales') return html`<${SucursalesListPage} ...${commonProps} navigate=${navigate} />`;
    if (sucursalDetailsMatch) return html`<${SucursalDetailPage} sucursalId=${sucursalDetailsMatch[1]} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/proveedores') return html`<${ProveedoresPage} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/clientes') return html`<${ClientesPage} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/traspasos') return html`<${TraspasosPage} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/traspasos/nuevo') return html`<${NuevoTraspasoPage} ...${commonProps} navigate=${navigate} />`;
    if (traspasoDetailsMatch) return html`<${TraspasoDetailPage} traspasoId=${traspasoDetailsMatch[1]} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/gastos') return html`<${GastosPage} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/auditoria') return html`<${AuditoriaPage} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/licencia') return html`<${LicenciaPage} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/configuracion') return html`<${ConfiguracionPage} ...${commonProps} navigate=${navigate} />`;
    if (currentPath === '/notificaciones') return html`<${NotificacionesPage} ...${commonProps} navigate=${navigate} />`;

    navigate('/dashboard');
    return html`<${DashboardPage} ...${commonProps} navigate=${navigate} />`;
}

function AppContent() {
    const [session, setSession] = useState(null);
    const [companyInfo, setCompanyInfo] = useState(null);
    const [displayUser, setDisplayUser] = useState(null);
    const [customerProfile, setCustomerProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [loadingSteps, setLoadingSteps] = useState([]);
    const [hasLoadFailed, setHasLoadFailed] = useState(false);
    const [currentPath, setCurrentPath] = useState(() => window.location.hash.substring(1) || '/login');
    const { addToast } = useToast();

    const navigate = useCallback((path) => {
        window.location.hash = path;
    }, []);

    const resetAppState = useCallback(() => {
        setSession(null);
        setDisplayUser(null);
        setCompanyInfo(null);
        setCustomerProfile(null);
        setLoading(false);
        setIsLoggingOut(false);
        setLoadingSteps([]);
        setHasLoadFailed(false);
    }, []);

    // Effect for handling hash changes
    useEffect(() => {
        const handleHashChange = () => setCurrentPath(window.location.hash.substring(1) || '/login');
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Effect for setting up the auth listener
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            // Initial loading is complete after first session check
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Main effect to react to session changes
    useEffect(() => {
        const handleSessionChange = async () => {
            if (!session) {
                // If there's no session, reset everything and potentially navigate to login
                const path = window.location.hash.substring(1);
                const wasOnCatalog = path.startsWith('/catalogo/');
                resetAppState();
                if (!wasOnCatalog && !path.startsWith('/registro') && !path.startsWith('/admin-delete-tool')) {
                    navigate('/login');
                }
                return;
            }

            setLoading(true);
            setHasLoadFailed(false);
            setLoadingSteps([
                { key: 'profile', label: 'Cargando Perfil de Usuario...', status: 'loading' }
            ]);

            const { data: profile, error: profileError } = await supabase.rpc('get_user_profile_data').single();

            if (profileError) {
                addToast({ message: `Error crítico al cargar el perfil: ${profileError.message}`, type: 'error', duration: 10000 });
                await supabase.auth.signOut();
                setLoading(false);
                return;
            }

            if (profile && profile.rol) {
                // This is a TENANT user session (regular user or SuperAdmin)
                setCustomerProfile(null);

                const getCurrencySymbol = (code) => ({'BOB': 'Bs', 'ARS': '$', 'BRL': 'R$', 'CLP': '$', 'COP': '$', 'USD': '$', 'GTQ': 'Q', 'HNL': 'L', 'MXN': '$', 'PAB': 'B/.', 'PYG': '₲', 'PEN': 'S/', 'DOP': 'RD$', 'UYU': '$U', 'EUR': '€'}[code] || code);
                
                let companyData = null;
                // For regular users, company_id will be present. For SuperAdmin, it will be null.
                if (profile.empresa_id) {
                    const planDetails = profile.planDetails || {};
                    companyData = {
                        name: profile.empresa_nombre, nit: profile.empresa_nit, plan: profile.plan_actual, logo: profile.empresa_logo,
                        planDetails, licenseStatus: profile.estado_licencia || 'Activa', licenseEndDate: profile.fecha_fin_licencia,
                        paymentHistory: profile.historial_pagos || [], timezone: profile.empresa_timezone, moneda: profile.empresa_moneda,
                        monedaSimbolo: getCurrencySymbol(profile.empresa_moneda), modo_caja: profile.empresa_modo_caja || 'por_sucursal',
                        slug: profile.empresa_slug,
                    };
                } else if (profile.rol === 'SuperAdmin') {
                    // Create a placeholder companyInfo for SuperAdmin
                    companyData = { name: 'SuperAdmin Panel', licenseStatus: 'Activa', planDetails: {} };
                }
                
                setCompanyInfo(companyData);
                console.log('%c[DIAGNÓSTICO] Datos de la empresa cargados:', 'color: cyan; font-weight: bold;', companyData);

                setDisplayUser({
                    id: session.user.id, empresa_id: profile.empresa_id, sucursal_id: profile.sucursal_id,
                    email: session.user.email, name: profile.nombre_completo, role: profile.rol,
                    avatar: profile.avatar, sucursal: profile.sucursal_principal_nombre || 'Global',
                });

                const path = window.location.hash.substring(1);
                if (path.startsWith('/catalogo/')) {
                    navigate('/dashboard');
                } else if (profile.rol === 'SuperAdmin' && !path.startsWith('/superadmin')) {
                    navigate('/superadmin');
                } else if (profile.rol !== 'SuperAdmin' && (path === '/login' || path === '/')) {
                    navigate('/dashboard');
                }
            } else {
                // This is likely a CUSTOMER session OR A FAILED TENANT LOGIN
                setDisplayUser(null);
                setCompanyInfo(null);
                const path = window.location.hash.substring(1);

                if (path.startsWith('/catalogo/')) {
                    const slug = path.split('/')[2];
                    if (slug) {
                        try {
                            const { data: customer, error: customerError } = await supabase.rpc('get_my_client_profile', { p_slug: slug }).single();
                            if (customerError) throw customerError;
                            setCustomerProfile(customer);
                        } catch (err) {
                            console.error("Customer profile fetch failed:", err);
                        }
                    }
                } else if (!profile && !path.startsWith('/registro') && !path.startsWith('/admin-delete-tool')) {
                    // Definitive check for failed tenant login: profile is null/empty but it's not a customer route.
                    addToast({ message: 'Error al cargar el perfil de usuario. La sesión puede estar corrupta. Cerrando sesión.', type: 'error' });
                    await supabase.auth.signOut();
                }
            }
            setLoading(false);
            setLoadingSteps([]);
        };
        
        handleSessionChange();

    }, [session, addToast, navigate, resetAppState]);


    const handleLogin = async (email, pass) => {
        const trimmedEmail = email.trim();
        const trimmedPassword = pass.trim();
        if (!trimmedEmail || !trimmedPassword) throw new Error('El correo y la contraseña son obligatorios.');

        // 1. Sign in. This will trigger onAuthStateChange, which is the single source of truth.
        const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password: trimmedPassword });
        if (error) throw error;

        // 2. Manually set the session to ensure a prompt reaction from the main useEffect.
        setSession(data.session);
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        const logoutSteps = [
            { key: 'logout_server', label: 'Cerrando sesión en el servidor', status: 'pending' },
            { key: 'cleanup', label: 'Limpiando datos de la aplicación', status: 'pending' },
        ];
        setLoadingSteps(logoutSteps);
        
        await new Promise(r => setTimeout(r, 100));
        setLoadingSteps(prev => prev.map(s => s.key === 'logout_server' ? {...s, status: 'loading'} : s));
        
        const { error } = await supabase.auth.signOut();
        if (error) {
            addToast({ message: 'Error al cerrar sesión. Forzando cierre local.', type: 'error' });
            handleForceLogout();
            return;
        }

        setLoadingSteps(prev => prev.map(s => s.key === 'logout_server' ? {...s, status: 'success'} : s));
        await new Promise(r => setTimeout(r, 500));
        setLoadingSteps(prev => prev.map(s => s.key === 'cleanup' ? {...s, status: 'loading'} : s));
        await new Promise(r => setTimeout(r, 1000));
        setLoadingSteps(prev => prev.map(s => s.key === 'cleanup' ? {...s, status: 'success'} : s));
        await new Promise(r => setTimeout(r, 500));
        // onAuthStateChange will handle final cleanup by setting session to null
    };

    const handleForceLogout = () => {
        console.warn('Forcing logout.');
        resetAppState();
        navigate('/login');
    };

    const handleProfileUpdate = (updatedData) => setDisplayUser(currentUser => ({ ...currentUser, ...updatedData }));
    const handleCompanyInfoUpdate = (updatedData) => setCompanyInfo(currentInfo => ({ ...currentInfo, ...updatedData }));

    let content;
    const isRegistrationRoute = currentPath.startsWith('/registro');
    const isAdminToolRoute = currentPath === '/admin-delete-tool';
    const isCatalogRoute = currentPath.startsWith('/catalogo');
    const isLoginRoute = currentPath === '/login' || currentPath === '/';

    if (loading && !isLoggingOut) {
        // Show a shell layout only if a session exists but data is loading
        if (session && !isCatalogRoute) {
            const shellUser = { name: ' ', email: session.user.email, role: '', sucursal: 'Cargando...', avatar: null };
            const shellCompany = { name: ' ', licenseStatus: 'Activa' };
            content = html`<${DashboardLayout} user=${shellUser} companyInfo=${shellCompany} onLogout=${handleLogout} onProfileUpdate=${handleProfileUpdate} disableNavigation=${true}><div /><//>`;
        }
    } else if (isCatalogRoute) {
        content = html`<${CatalogApp} path=${currentPath} navigate=${navigate} session=${session} customerProfile=${customerProfile} />`;
    } else if (session && displayUser) {
        if (companyInfo && companyInfo.licenseStatus === 'Suspendida' && displayUser.role !== 'SuperAdmin') {
            content = html`<${SuspendedLicensePage} user=${displayUser} onLogout=${handleLogout} onProfileUpdate=${handleProfileUpdate} companyInfo=${companyInfo} />`;
        } else if (companyInfo && companyInfo.licenseStatus === 'Pendiente de Aprobación' && displayUser.role !== 'SuperAdmin') {
            content = html`<${PendingApprovalPage} user=${displayUser} onLogout=${handleLogout} onProfileUpdate=${handleProfileUpdate} companyInfo=${companyInfo} />`;
        } else if (displayUser.role === 'SuperAdmin') {
            const companyDetailsMatch = currentPath.match(/^\/superadmin\/empresa\/(.+)$/);
            const isPlanesRoute = currentPath === '/superadmin/planes';
            const isModulosRoute = currentPath === '/superadmin/modulos';
            if (isModulosRoute) {
                 content = html`<${ModulosPage} user=${displayUser} onLogout=${handleLogout} navigate=${navigate} onProfileUpdate=${handleProfileUpdate} />`;
            } else if (isPlanesRoute) {
                 content = html`<${PlanesPage} user=${displayUser} onLogout=${handleLogout} navigate=${navigate} onProfileUpdate=${handleProfileUpdate} />`;
            } else if (companyDetailsMatch) {
                content = html`<${CompanyDetailsPage} companyId=${companyDetailsMatch[1]} user=${displayUser} onLogout=${handleLogout} navigate=${navigate} onProfileUpdate=${handleProfileUpdate} />`;
            } else {
                content = html`<${SuperAdminPage} user=${displayUser} onLogout=${handleLogout} navigate=${navigate} onProfileUpdate=${handleProfileUpdate} />`;
            }
        } else if (['Propietario', 'Administrador', 'Empleado'].includes(displayUser.role)) {
            const commonProps = { user: displayUser, onLogout: handleLogout, companyInfo, onProfileUpdate: handleProfileUpdate, onCompanyInfoUpdate: handleCompanyInfoUpdate };
            content = html`<${TenantRoutes} currentPath=${currentPath} navigate=${navigate} ...${commonProps} />`;
        } else {
            handleLogout();
        }
    } else {
        if (isRegistrationRoute) content = html`<${RegistrationFlow} navigate=${navigate} />`;
        else if (isAdminToolRoute) content = html`<${AdminToolPage} navigate=${navigate} />`;
        else if (isLoginRoute) {
            const shellUser = { name: ' ', email: ' ', role: '', sucursal: ' ', avatar: null };
            const shellCompany = { name: ' ', licenseStatus: 'Activa' };
            content = html`
                <div class="h-full">
                    <${DashboardLayout} 
                        user=${shellUser} 
                        companyInfo=${shellCompany} 
                        onLogout=${() => {}} 
                        onProfileUpdate=${() => {}} 
                        disableNavigation=${true}
                    >
                        <div />
                    <//>
                    <${LoginPage} onLogin=${handleLogin} navigate=${navigate} />
                </div>
            `;
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
                    <${TerminalVentaProvider}>
                        <${NuevaCompraProvider}>
                            <${ProductFormProvider}>
                                <${CatalogCartProvider}>
                                    <${InitialSetupProvider}>
                                        <${AppContent} />
                                    <//>
                                <//>
                            <//>
                        <//>
                    <//>
                <//>
            <//>
        <//>
    `;
}