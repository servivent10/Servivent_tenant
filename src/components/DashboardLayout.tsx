/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { ICONS } from './Icons.js';
import { ServiVentLogo } from './Logo.js';
import { ConfirmationModal } from './ConfirmationModal.js';
import { useToast } from '../hooks/useToast.js';
import { supabase } from '../lib/supabaseClient.js';
import { ProgressBar } from './ProgressBar.js';
import { Avatar } from './Avatar.js';
import { ProfileModal } from './modals/ProfileModal.js';
import { getTenantSidebarLinks, TENANT_FOOTER_LINKS } from '../pages/Tenant/tenantLinks.js';
import { ConnectivityCenter } from './ConnectivityCenter.js';

const NOTIFICATION_EVENT_ICONS = {
    'NUEVA_VENTA': ICONS.shopping_cart,
    'NUEVA_COMPRA': ICONS.purchases,
    'NUEVO_GASTO': ICONS.expenses,
    'TRASPASO_ENVIADO': ICONS.transfers,
    'TRASPASO_RECIBIDO': ICONS.inventory,
    'NUEVO_PRODUCTO': ICONS.package_2,
    'NUEVO_CLIENTE': ICONS.person_add,
    'PRODUCTO_STOCK_BAJO': ICONS.warning,
    'MULTIPLE_PRODUCTOS_STOCK_BAJO': ICONS.inventory,
    'NUEVO_PEDIDO_RETIRO': ICONS.storefront,
    'NUEVO_PEDIDO_ENVIO': ICONS.suppliers,
    'VENTA_PROXIMA_A_VENCER': ICONS.calendar_month,
    'VENTA_VENCIDA': ICONS.error,
    'SOLICITUD_TRASPASO': ICONS.transfers,
    DEFAULT: ICONS.bolt,
};

const getNotificationLink = (notification) => {
    const { tipo_evento, entidad_id, mensaje } = notification;

    switch (tipo_evento) {
        case 'NUEVA_VENTA':
        case 'NUEVO_PEDIDO_RETIRO':
        case 'NUEVO_PEDIDO_ENVIO':
        case 'VENTA_PROXIMA_A_VENCER':
        case 'VENTA_VENCIDA':
            return entidad_id ? `#/ventas/${entidad_id}` : null;
        case 'NUEVA_COMPRA':
            return entidad_id ? `#/compras/${entidad_id}` : null;
        case 'TRASPASO_ENVIADO':
        case 'TRASPASO_RECIBIDO':
            return entidad_id ? `#/traspasos/${entidad_id}` : null;
        case 'SOLICITUD_TRASPASO':
            return entidad_id ? `#/traspasos/nuevo?solicitud=${entidad_id}` : null;
        case 'NUEVO_PRODUCTO':
            return entidad_id ? `#/productos/${entidad_id}` : null;
        case 'NUEVO_CLIENTE':
            return '#/clientes';
        case 'PRODUCTO_STOCK_BAJO': {
            const skuMatch = mensaje.match(/\(SKU:\s*([^)]+)\)/);
            const sku = skuMatch ? skuMatch[1] : null;
            return sku ? `#/inventarios?search=${encodeURIComponent(sku)}` : '#/inventarios';
        }
        case 'MULTIPLE_PRODUCTOS_STOCK_BAJO':
            return '#/inventarios?status=low_stock';
        default:
            return null;
    }
};

const TimeAgo = ({ date }) => {
    const [timeAgo, setTimeAgo] = useState('');

    useEffect(() => {
        const calculateTimeAgo = () => {
            const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
            if (seconds < 60) return 'Ahora mismo';
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return `Hace ${minutes} min`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `Hace ${hours}h`;
            const days = Math.floor(hours / 24);
            return `Hace ${days}d`;
        };

        setTimeAgo(calculateTimeAgo());
        const interval = setInterval(() => setTimeAgo(calculateTimeAgo()), 60000);
        return () => clearInterval(interval);
    }, [date]);

    return html`<p class="text-xs text-gray-400 mt-1">${timeAgo}</p>`;
};


const NotificationPanel = ({ notifications, emptyText, onNotificationClick }) => {
    return html`
    <div class="absolute right-0 mt-2 w-80 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-fade-in-down" role="menu" aria-orientation="vertical" tabindex="-1">
        <div class="py-1" role="none">
            <div class="px-4 py-2 text-sm font-semibold text-gray-900 border-b">Notificaciones del Sistema</div>
            <div class="max-h-96 overflow-y-auto">
                ${notifications && notifications.length > 0 ? notifications.map(n => {
                    const icon = NOTIFICATION_EVENT_ICONS[n.tipo_evento] || NOTIFICATION_EVENT_ICONS.DEFAULT;
                    const link = getNotificationLink(n);
                    const Tag = link ? 'a' : 'div';
                    const props = link ? { href: link, onClick: (e) => onNotificationClick(e, link) } : {};

                    return html`
                    <${Tag} ...${props} class="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 border-b border-gray-100 ${!n.is_read ? 'bg-primary-light/30' : ''}" role="menuitem" tabindex="-1">
                        <div class="flex items-start gap-3">
                            <div class="p-1 bg-slate-100 rounded-full mt-0.5 text-slate-500">${icon}</div>
                            <div class="flex-1">
                                <p class="text-gray-800" dangerouslySetInnerHTML=${{ __html: n.mensaje }}></p>
                                <${TimeAgo} date=${n.created_at} />
                            </div>
                            ${!n.is_read && html`<div class="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>`}
                        </div>
                    <//>
                `}) : html`
                    <p class="px-4 py-4 text-sm text-gray-500 text-center">${emptyText}</p>
                `}
            </div>
             <a href="#/notificaciones" onClick=${(e) => onNotificationClick(e, '#/notificaciones')} class="block py-2 text-center text-sm font-medium text-primary hover:text-primary-dark" role="menuitem" tabindex="-1">
                Ver todas
            </a>
        </div>
    </div>
`};


const NotificationBell = ({ icon, count, onClick }) => {
    const badgeAnimationClass = count > 0 ? 'animate-badge-pulse' : '';
    return html`
        <button onClick=${onClick} type="button" class="relative rounded-full bg-white p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
            <span class="sr-only">Ver notificaciones</span>
            ${icon}
            ${count > 0 && html`
                <span class="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full ${badgeAnimationClass}">${count > 9 ? '9+' : count}</span>
            `}
        </button>
    `;
};

const ProfileDropdownPanel = ({ user, companyInfo, onEditProfile, onLogoutRequest, disableNavigation }) => {
    const calculateDaysRemaining = (endDate) => {
        if (!endDate) return null;
        const diff = new Date(endDate).getTime() - new Date().getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return Math.max(0, days);
    };
    const daysRemaining = calculateDaysRemaining(companyInfo.licenseEndDate);
    const licenseStatusColor = companyInfo.licenseStatus === 'Activa' ? 'bg-emerald-500' : 'bg-red-500';

    return html`
        <div class="absolute right-0 mt-2 w-64 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-fade-in-down">
            <div class="py-1">
                <div class="px-4 py-3 border-b">
                    <p class="text-sm font-semibold text-gray-900 truncate">${user.name}</p>
                    <div class="mt-2 space-y-1 text-xs">
                        <div class="flex">
                            <span class="w-16 flex-shrink-0 font-medium text-gray-500">Rol:</span>
                            <span class="truncate text-gray-800">${user.role}</span>
                        </div>
                        <div class="flex">
                            <span class="w-16 flex-shrink-0 font-medium text-gray-500">Empresa:</span>
                            <span class="truncate text-gray-800">${companyInfo.name}</span>
                        </div>
                        <div class="flex">
                            <span class="w-16 flex-shrink-0 font-medium text-gray-500">Sucursal:</span>
                            <span class="truncate text-gray-800">${user.sucursal}</span>
                        </div>
                    </div>
                </div>
                
                ${(user.role === 'Propietario' || user.role === 'Administrador') && html`
                    <a href="#/licencia" onClick=${(e) => { e.preventDefault(); if(!disableNavigation) window.location.hash = '/licencia'; }} class="block w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">
                        <p class="font-medium text-gray-800">Licencia</p>
                        <div class="mt-2 space-y-1 text-xs text-gray-600">
                            <div class="flex items-center justify-between">
                                <span>Estado:</span>
                                <div class="flex items-center gap-1.5">
                                    <div class=${`h-2 w-2 rounded-full ${licenseStatusColor}`}></div>
                                    <span class="font-semibold text-gray-800">${companyInfo.licenseStatus}</span>
                                </div>
                            </div>
                            <div class="flex items-center justify-between">
                                <span>Plan:</span>
                                <span class="font-semibold text-gray-800">${companyInfo.plan}</span>
                            </div>
                            ${daysRemaining !== null && html`
                            <div class="flex items-center justify-between">
                                <span>Vence en:</span>
                                <span class="font-semibold text-gray-800">${daysRemaining} días</span>
                            </div>
                            `}
                        </div>
                    </a>
                `}
                
                <div class="border-t">
                    <button onClick=${onEditProfile} class="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">Mi Perfil</button>
                    <button onClick=${onLogoutRequest} class="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50" role="menuitem">Cerrar Sesión</button>
                </div>
            </div>
        </div>
    `;
};


export function DashboardLayout({ user, onLogout, onProfileUpdate, sidebarLinks, children, activeLink, breadcrumbs = [], footerLinks, companyInfo = null, disableNavigation = false, disablePadding = false }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [systemPanelOpen, setSystemPanelOpen] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isProfileModalOpen, setProfileModalOpen] = useState(false);
    
    const [notifications, setNotifications] = useState([]);
    const unreadCount = notifications.filter(n => !n.is_read).length;
    const systemRef = useRef(null);
    const profileMenuRef = useRef(null);
    const { addToast } = useToast();
    
    const safeUser = user || { name: ' ', role: '', sucursal: ' ' };
    const safeCompanyInfo = companyInfo || { name: ' ', licenseStatus: '' };

    const finalSidebarLinks = sidebarLinks || getTenantSidebarLinks(safeUser.role, safeCompanyInfo);
    const finalFooterLinks = footerLinks || TENANT_FOOTER_LINKS;

    const fetchNotifications = async () => {
        if (!user?.id) return;
        try {
            const { data, error } = await supabase.rpc('get_notificaciones');
            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            addToast({ message: 'No se pudo cargar el historial de notificaciones.', type: 'error' });
        }
    };
    
    useEffect(() => {
        fetchNotifications();
    }, [user?.id]);
    
    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase.channel('public:notificaciones')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones' },
            (payload) => {
                const newNotification = { ...payload.new, is_read: false };
                setNotifications(prev => [newNotification, ...prev.slice(0, 19)]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (systemRef.current && !systemRef.current.contains(event.target)) {
                setSystemPanelOpen(false);
            }
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setProfileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogoutConfirm = () => {
        setIsLogoutModalOpen(false);
        onLogout();
    };

    const toggleSystemPanel = async () => {
        setProfileMenuOpen(false);
        const willOpen = !systemPanelOpen;
        setSystemPanelOpen(willOpen);
        
        if (willOpen && unreadCount > 0) {
            try {
                const { error } = await supabase.rpc('mark_notificaciones_as_read');
                if (error) throw error;
                fetchNotifications();
            } catch (error) {
                addToast({ message: 'Error al marcar notificaciones como leídas.', type: 'error' });
            }
        }
    };

    const handleNotificationClick = (e, link) => {
        e.preventDefault();
        window.location.hash = link;
        setSystemPanelOpen(false);
    };

    const renderLink = (link) => {
        const isActive = link.name === activeLink;
        const isDisabled = disableNavigation;
        
        let linkClasses = `group flex items-center rounded-md px-2 py-2 text-sm font-medium border-l-4 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} `;

        if (isActive) {
            linkClasses += 'bg-slate-900 text-white border-primary';
        } else {
            linkClasses += 'text-gray-300 hover:bg-primary-hover hover:text-white border-transparent';
        }

        const iconClasses = `mr-3 h-6 w-6 flex-shrink-0 ${
            isActive ? 'text-gray-200' : 'text-gray-400 group-hover:text-gray-200'
        }`;

        const handleClick = (e) => {
            e.preventDefault();
            if (link.href && link.href !== '#' && !isDisabled) {
                window.location.hash = link.href;
            }
        };

        return html`
            <a href=${link.href} class=${linkClasses} onClick=${handleClick} aria-disabled=${isDisabled}>
                <div class=${iconClasses}>${link.icon}</div>
                <span>${link.name}</span>
            </a>
        `;
    }

    const sidebarContent = html`
        <div class="flex min-h-0 flex-1 flex-col bg-secondary-dark text-gray-200">
            <div class="flex h-16 flex-shrink-0 items-center px-4">
                <${ServiVentLogo} textColor="text-white" accentColor="text-primary-light" />
            </div>
            
            <nav class="flex-1 space-y-1 overflow-y-auto px-2 py-4">
                ${finalSidebarLinks.map(renderLink)}
            </nav>
            
            <div class="mt-auto flex-shrink-0">
                ${finalFooterLinks.length > 0 && html`
                    <nav class="space-y-1 px-2 py-2 border-t border-slate-700/50">
                        ${finalFooterLinks.map(renderLink)}
                    </nav>
                `}
            </div>
        </div>
    `;
    
    return html`
        <div class="flex h-screen bg-gray-100 overflow-hidden">
            <div class=${`fixed inset-0 z-40 flex md:hidden transition-opacity duration-300 ease-linear ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} role="dialog" aria-modal="true">
                <div class=${`fixed inset-0 bg-gray-600 bg-opacity-75`} aria-hidden="true" onClick=${() => setSidebarOpen(false)}></div>
                
                <div class=${`relative flex w-full max-w-xs flex-1 flex-col transform transition duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                   <div class="absolute top-0 right-0 -mr-12 pt-2">
                        <button type="button" class="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white" onClick=${() => setSidebarOpen(false)}>
                            <span class="sr-only">Close sidebar</span>
                            <div class="text-white">${ICONS.close}</div>
                        </button>
                    </div>
                    ${sidebarContent}
                </div>
            </div>

            <div class="hidden md:flex md:w-64 md:flex-shrink-0">
                <div class="flex w-full flex-col">
                    ${sidebarContent}
                </div>
            </div>

            <div class="flex w-0 flex-1 flex-col overflow-hidden">
                <div class="relative z-30 flex h-16 flex-shrink-0 bg-white border-b border-gray-200">
                    <button type="button" class="border-r border-gray-200 px-4 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary md:hidden" onClick=${() => setSidebarOpen(true)}>
                        <span class="sr-only">Open sidebar</span>
                        ${ICONS.menu}
                    </button>
                    <div class="flex flex-1 items-center justify-between px-4">
                        <nav class="flex" aria-label="Breadcrumb">
                            <ol role="list" class="flex items-center space-x-2 text-sm">
                                ${breadcrumbs.map((crumb, index) => html`
                                    <li>
                                        <div class="flex items-center">
                                            ${index !== 0 && html`<div class="text-gray-400 mr-2">${ICONS.chevron_right}</div>`}
                                            <a 
                                                href=${crumb.href} 
                                                onClick=${(e) => {
                                                    if (crumb.href && crumb.href !== '#' && !disableNavigation) {
                                                        e.preventDefault();
                                                        window.location.hash = crumb.href;
                                                    }
                                                }}
                                                class="font-medium ${index === breadcrumbs.length - 1 ? 'text-gray-800' : 'text-gray-500 hover:text-gray-700'} ${disableNavigation ? 'pointer-events-none' : ''}"
                                            >
                                                ${crumb.name}
                                            </a>
                                        </div>
                                    </li>
                                `)}
                            </ol>
                        </nav>
                        
                        <div class="ml-4 flex items-center md:ml-6 space-x-2">
                            <${ConnectivityCenter} />
                            <div class="relative" ref=${systemRef}>
                                <${NotificationBell} icon=${ICONS.notifications} count=${unreadCount} onClick=${toggleSystemPanel} />
                                ${systemPanelOpen && html`<${NotificationPanel} notifications=${notifications} emptyText="No hay notificaciones nuevas." onNotificationClick=${handleNotificationClick} />`}
                            </div>
                            
                            <div class="relative" ref=${profileMenuRef}>
                                <button onClick=${() => { setProfileMenuOpen(p => !p); setSystemPanelOpen(false); }} type="button" class="flex items-center gap-2 rounded-full p-1 pr-2 text-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                                    <${Avatar} name=${safeUser.name} avatarUrl=${safeUser.avatar} size="h-8 w-8" />
                                    <span class="hidden md:inline text-gray-700 font-medium">${safeUser.name}</span>
                                    <div class="text-gray-400">${ICONS.chevron_down}</div>
                                </button>
                                ${profileMenuOpen && html`
                                    <${ProfileDropdownPanel} 
                                        user=${safeUser} 
                                        companyInfo=${safeCompanyInfo} 
                                        onEditProfile=${() => { setProfileModalOpen(true); setProfileMenuOpen(false); }}
                                        onLogoutRequest=${() => { setIsLogoutModalOpen(true); setProfileMenuOpen(false); }}
                                        disableNavigation=${disableNavigation}
                                    />
                                `}
                            </div>
                        </div>
                    </div>
                </div>

                <main class="flex-1 relative focus:outline-none overflow-y-auto">
                    <${ProgressBar} />
                    ${disablePadding ? children : html`
                        <div class="py-6">
                            <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
                                ${children}
                            </div>
                        </div>
                    `}
                </main>
            </div>
        </div>

        <${ConfirmationModal}
            isOpen=${isLogoutModalOpen}
            onClose=${() => setIsLogoutModalOpen(false)}
            onConfirm=${handleLogoutConfirm}
            title="Confirmar Cierre de Sesión"
            confirmText="Cerrar Sesión"
            confirmVariant="danger"
            icon=${ICONS.warning_amber}
        >
            <p class="text-sm text-gray-600">Estás a punto de cerrar tu sesión. ¿Deseas continuar?</p>
        <//>
        
        ${user && html`<${ProfileModal} 
            isOpen=${isProfileModalOpen}
            onClose=${() => setProfileModalOpen(false)}
            user=${user}
            onProfileUpdate=${onProfileUpdate}
        />`}
    `;
}