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
import { UPGRADE_PLANS, REGISTRATION_PLANS } from './lib/plansConfig.js';
import { RealtimeProvider } from './hooks/useRealtime.js';
import { CatalogApp } from './pages/Public/CatalogApp.js';


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

    const navigate = (path) => {
        window.location.hash = path;
    };

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

    const loadTenantData = useCallback(async (session) => {
        if (hasLoadFailed || displayUser) return;
        
        setLoading(true);
        setCustomerProfile(null);
        
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const initialSteps = [
            { key: 'profile', label: 'Cargando Perfil de Usuario', status: 'pending' },
            { key: 'company', label: 'Verificando Información de la Empresa', status: 'pending' },
            { key: 'branch', label: 'Obteniendo Datos de la Sucursal', status: 'pending' },
        ];
        
        const updateStepStatus = (key, status) => setLoadingSteps(prev => prev.map(step => step.key === key ? { ...step, status } : step));
        setLoadingSteps(initialSteps);
        
        try {
            await delay(100); updateStepStatus('profile', 'loading');
            
            const { data: profile, error: profileError } = await supabase.rpc('get_user_profile_data').single();
            if (profileError) throw profileError;
            if (!profile) throw new Error("Error Crítico: Usuario autenticado pero no se encontraron datos de perfil.");

            updateStepStatus('profile', 'success'); await delay(1000);
            updateStepStatus('company', 'loading'); await delay(150);
            updateStepStatus('company', 'success'); await delay(1000);
            updateStepStatus('branch', 'loading'); await delay(150);
            updateStepStatus('branch', 'success'); await delay(2000);

            const getCurrencySymbol = (code) => ({'BOB': 'Bs', 'ARS': '$', 'BRL': 'R$', 'CLP': '$', 'COP': '$', 'USD': '$', 'GTQ': 'Q', 'HNL': 'L', 'MXN': '$', 'PAB': 'B/.', 'PYG': '₲', 'PEN': 'S/', 'DOP': 'RD$', 'UYU': '$U', 'EUR': '€'}[code] || code);

            let companyData = null;
            if (profile.empresa_id) {
                const planName = profile.plan_actual || 'Sin Plan';
                const basePlanName = planName.split('(')[0].trim();
                const planDetails = [...REGISTRATION_PLANS, ...UPGRADE_PLANS].find(p => p.title === basePlanName);
                companyData = {
                    name: profile.empresa_nombre, nit: profile.empresa_nit, plan: planName, logo: profile.empresa_logo,
                    planDetails, licenseStatus: profile.estado_licencia || 'Activa', licenseEndDate: profile.fecha_fin_licencia,
                    paymentHistory: profile.historial_pagos || [], timezone: profile.empresa_timezone, moneda: profile.empresa_moneda,
                    monedaSimbolo: getCurrencySymbol(profile.empresa_moneda), modo_caja: profile.empresa_modo_caja || 'por_sucursal',
                    slug: profile.empresa_slug,
                };
            }
            setCompanyInfo(companyData);

            setDisplayUser({
                id: session.user.id, empresa_id: profile.empresa_id, sucursal_id: profile.sucursal_id,
                email: session.user.email, name: profile.nombre_completo, role: profile.rol,
                avatar: profile.avatar, sucursal: profile.rol === 'SuperAdmin' ? 'Global' : (profile.sucursal_principal_nombre || 'Sucursal Principal'),
            });

            const current = window.location.hash.substring(1);
            if (profile.rol === 'SuperAdmin' && !current.startsWith('/superadmin')) navigate('/superadmin');
            else if (profile.rol !== 'SuperAdmin' && (current === '/login' || current === '/')) navigate('/dashboard');

        } catch (error) {
            console.error('Error during user data loading:', error);
            setLoadingSteps(prev => {
                const stepIndex = prev.findIndex(s => s.status === 'loading');
                const newSteps = [...prev];
                if (stepIndex > -1) newSteps[stepIndex] = { ...newSteps[stepIndex], status: 'error' };
                return newSteps;
            });
            addToast({ message: `Error crítico al cargar datos: ${error.message}`, type: 'error', duration: Infinity });
            setHasLoadFailed(true);
        } finally {
            setLoading(false);
        }
    }, [addToast, hasLoadFailed, displayUser]);
    
    const loadCustomerData = useCallback(async (slug) => {
        if (customerProfile) { setLoading(false); return; }
        
        try {
            const { data, error } = await supabase.rpc('get_my_client_profile', { p_slug: slug }).single();
            if (error) throw error;
            setCustomerProfile(data);
        } catch (err) {
            console.error("Customer profile fetch failed:", err);
            addToast({ message: 'No se pudo cargar tu perfil de cliente.', type: 'error' });
            // Don't block the UI, just show an error. The user might still be able to browse.
        } finally {
            setLoading(false);
        }
    }, [addToast, customerProfile]);

    useEffect(() => {
        const handleHashChange = () => setCurrentPath(window.location.hash.substring(1) || '/login');
        window.addEventListener('hashchange', handleHashChange);
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
            if (newSession && newSession.access_token !== session?.access_token) {
                setSession(newSession);
                const path = window.location.hash.substring(1);
                if (path.startsWith('/catalogo/')) {
                    const slug = path.split('/')[2];
                    if (slug) loadCustomerData(slug);
                } else if (!path.startsWith('/registro')) {
                    loadTenantData(newSession);
                }
            } else if (!newSession) {
                resetAppState();
                const path = window.location.hash.substring(1);
                if (!path.startsWith('/catalogo/')) {
                    navigate('/login');
                }
            }
        });

        const initializeSession = async () => {
            const { data: { session: initialSession } } = await supabase.auth.getSession();
            setSession(initialSession);
            
            if (initialSession) {
                const path = window.location.hash.substring(1);
                if (path.startsWith('/catalogo/')) {
                    const slug = path.split('/')[2];
                    if (slug) {
                       await loadCustomerData(slug);
                    } else {
                       setLoading(false);
                    }
                } else if (!path.startsWith('/registro') && !path.startsWith('/admin-delete-tool')) {
                    await loadTenantData(initialSession);
                } else {
                     setLoading(false);
                }
            } else {
                setLoading(false);
                if (!window.location.hash) navigate('/login');
            }
        };

        initializeSession();

        return () => {
            window.removeEventListener('hashchange', handleHashChange);
            subscription.unsubscribe();
        };
    }, [loadTenantData, loadCustomerData, resetAppState]);


    const handleLogin = async (email, pass) => {
        const trimmedEmail = email.trim();
        const trimmedPassword = pass.trim();
        if (!trimmedEmail || !trimmedPassword) throw new Error('El correo y la contraseña son obligatorios.');
        const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password: trimmedPassword });
        if (error) throw error;
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
        // onAuthStateChange will handle final cleanup
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

    if (loading && !isLoggingOut && session && !isCatalogRoute) {
        const shellUser = { name: ' ', email: session.user.email, role: '', sucursal: 'Cargando...', avatar: null };
        const shellCompany = { name: ' ', licenseStatus: 'Activa' };
        content = html`<${DashboardLayout} user=${shellUser} companyInfo=${shellCompany} onLogout=${handleLogout} onProfileUpdate=${handleProfileUpdate} disableNavigation=${true}><div /><//>`;
    } else if (isCatalogRoute) {
        content = html`<${CatalogApp} path=${currentPath} navigate=${navigate} session=${session} customerProfile=${customerProfile} />`;
    } else if (session && displayUser) {
        if (companyInfo && companyInfo.licenseStatus === 'Suspendida' && displayUser.role !== 'SuperAdmin') {
            content = html`<${SuspendedLicensePage} user=${displayUser} onLogout=${handleLogout} onProfileUpdate=${handleProfileUpdate} companyInfo=${companyInfo} />`;
        } else if (companyInfo && companyInfo.licenseStatus === 'Pendiente de Aprobación' && displayUser.role !== 'SuperAdmin') {
            content = html`<${PendingApprovalPage} user=${displayUser} onLogout=${handleLogout} onProfileUpdate=${handleProfileUpdate} companyInfo=${companyInfo} />`;
        } else if (displayUser.role === 'SuperAdmin') {
            const companyDetailsMatch = currentPath.match(/^\/superadmin\/empresa\/(.+)$/);
            content = companyDetailsMatch
                ? html`<${CompanyDetailsPage} companyId=${companyDetailsMatch[1]} user=${displayUser} onLogout=${handleLogout} navigate=${navigate} onProfileUpdate=${handleProfileUpdate} />`
                : html`<${SuperAdminPage} user=${displayUser} onLogout=${handleLogout} navigate=${navigate} onProfileUpdate=${handleProfileUpdate} />`;
        } else if (['Propietario', 'Administrador', 'Empleado'].includes(displayUser.role)) {
            // FIX: Assign the correct handler functions to the props in 'commonProps'
            const commonProps = { user: displayUser, onLogout: handleLogout, companyInfo, onProfileUpdate: handleProfileUpdate, onCompanyInfoUpdate: handleCompanyInfoUpdate, navigate };
            const sucursalDetailsMatch = currentPath.match(/^\/sucursales\/(.+)$/);
            const productoDetailsMatch = currentPath.match(/^\/productos\/(.+)$/);
            const compraDetailsMatch = currentPath.match(/^\/compras\/(.+)$/);
            const ventaDetailsMatch = currentPath.match(/^\/ventas\/(.+)$/);
            const traspasoDetailsMatch = currentPath.match(/^\/traspasos\/(.+)$/);
            
            let tenantContent;
            if (currentPath === '/dashboard') tenantContent = html`<${DashboardPage} ...${commonProps} />`;
            else if (currentPath === '/terminal-venta') tenantContent = html`<${TerminalVentaPage} ...${commonProps} />`;
            else if (currentPath === '/productos') tenantContent = html`<${ProductosPage} ...${commonProps} />`;
            else if (productoDetailsMatch) tenantContent = html`<${ProductoDetailPage} productoId=${productoDetailsMatch[1]} ...${commonProps} />`;
            else if (currentPath === '/inventarios') tenantContent = html`<${InventariosPage} ...${commonProps} />`;
            else if (currentPath === '/historial-inventario') tenantContent = html`<${HistorialInventarioPage} ...${commonProps} />`;
            else if (currentPath === '/compras') tenantContent = html`<${ComprasPage} ...${commonProps} />`;
            else if (currentPath === '/compras/nueva') tenantContent = html`<${NuevaCompraPage} ...${commonProps} />`;
            else if (compraDetailsMatch) tenantContent = html`<${CompraDetailPage} compraId=${compraDetailsMatch[1]} ...${commonProps} />`;
            else if (currentPath === '/ventas') tenantContent = html`<${VentasPage} ...${commonProps} />`;
            else if (ventaDetailsMatch) tenantContent = html`<${VentaDetailPage} ventaId=${ventaDetailsMatch[1]} ...${commonProps} />`;
            else if (currentPath === '/historial-cajas') tenantContent = html`<${HistorialCajasPage} ...${commonProps} />`;
            else if (currentPath === '/sucursales') tenantContent = html`<${SucursalesListPage} ...${commonProps} />`;
            else if (sucursalDetailsMatch) tenantContent = html`<${SucursalDetailPage} sucursalId=${sucursalDetailsMatch[1]} ...${commonProps} />`;
            else if (currentPath === '/proveedores') tenantContent = html`<${ProveedoresPage} ...${commonProps} />`;
            else if (currentPath === '/clientes') tenantContent = html`<${ClientesPage} ...${commonProps} />`;
            else if (currentPath === '/traspasos') tenantContent = html`<${TraspasosPage} ...${commonProps} />`;
            else if (currentPath === '/traspasos/nuevo') tenantContent = html`<${NuevoTraspasoPage} ...${commonProps} />`;
            else if (traspasoDetailsMatch) tenantContent = html`<${TraspasoDetailPage} traspasoId=${traspasoDetailsMatch[1]} ...${commonProps} />`;
            else if (currentPath === '/gastos') tenantContent = html`<${GastosPage} ...${commonProps} />`;
            else if (currentPath === '/auditoria') tenantContent = html`<${AuditoriaPage} ...${commonProps} />`;
            else if (currentPath === '/licencia') tenantContent = html`<${LicenciaPage} ...${commonProps} />`;
            else if (currentPath === '/configuracion') tenantContent = html`<${ConfiguracionPage} ...${commonProps} />`;
            else if (currentPath === '/notificaciones') tenantContent = html`<${NotificacionesPage} ...${commonProps} />`;
            else {
                navigate('/dashboard');
                tenantContent = html`<${DashboardPage} ...${commonProps} />`;
            }
            content = tenantContent;
        } else {
            handleLogout();
        }
    } else {
        if (isRegistrationRoute) content = html`<${RegistrationFlow} navigate=${navigate} />`;
        else if (isAdminToolRoute) content = html`<${AdminToolPage} navigate=${navigate} />`;
        else content = html`<${LoginPage} onLogin=${handleLogin} navigate=${navigate} />`;
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