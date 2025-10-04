/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { ICONS } from './Icons.js';
import { ServiVentLogo } from './Logo.js';
import { ConfirmationModal } from './ConfirmationModal.js';
import { FormInput } from './FormComponents.js';
import { useToast } from '../hooks/useToast.js';
import { supabase } from '../lib/supabaseClient.js';
import { ProgressBar } from './ProgressBar.js';
import { Avatar } from './Avatar.js';
import { ProfileModal } from './modals/ProfileModal.js';
import { getTenantSidebarLinks, TENANT_FOOTER_LINKS } from '../pages/Tenant/tenantLinks.js';
import { ConnectivityCenter } from './ConnectivityCenter.js';

const NotificationPanel = ({ notifications, title, emptyText, position = 'down' }) => {
    const positionClasses = position === 'up' 
        ? 'absolute right-0 bottom-full mb-2 w-80 origin-bottom-right'
        : 'absolute right-0 mt-2 w-80 origin-top-right';

    return html`
    <div class="${positionClasses} rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50" role="menu" aria-orientation="vertical" tabindex="-1">
        <div class="py-1" role="none">
            <div class="px-4 py-2 text-sm font-semibold text-gray-900 border-b">${title}</div>
            <div class="max-h-80 overflow-y-auto">
                ${notifications && notifications.length > 0 ? notifications.map(n => html`
                    <a href="#" class="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 border-b border-gray-100 ${!n.read ? 'bg-primary-light/50' : ''}" role="menuitem" tabindex="-1">
                        <p class="font-semibold truncate">${n.title}</p>
                        <p class="text-gray-600">${n.text}</p>
                        <p class="text-xs text-gray-400 mt-1">${n.time}</p>
                    </a>
                `) : html`
                    <p class="px-4 py-4 text-sm text-gray-500">${emptyText}</p>
                `}
            </div>
             <a href="#" class="block py-2 text-center text-sm font-medium text-primary hover:text-primary-dark" role="menuitem" tabindex="-1">
                Ver todas
            </a>
        </div>
    </div>
`};

const NotificationBell = ({ icon, notifications = [], onClick }) => {
    const unreadCount = notifications.filter(n => !n.read).length;
    const isSupportIcon = icon === ICONS.support;
    const buttonClasses = isSupportIcon 
        ? "flex-shrink-0 rounded-full p-2 text-gray-400 hover:text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-800"
        : "rounded-full bg-white p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";

    return html`
        <button onClick=${onClick} type="button" class="relative ${buttonClasses}">
            <span class="sr-only">Ver notificaciones</span>
            ${icon}
            ${unreadCount > 0 && html`
                <span class="absolute top-0 right-0 block h-2 w-2 transform translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 ring-2 ring-white"></span>
            `}
        </button>
    `;
};

export function DashboardLayout({ user, onLogout, onProfileUpdate, sidebarLinks, children, activeLink, breadcrumbs = [], footerLinks, companyInfo = null, notifications = { support: [], system: [] }, disableNavigation = false, disablePadding = false }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [supportPanelOpen, setSupportPanelOpen] = useState(false);
    const [systemPanelOpen, setSystemPanelOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isProfileModalOpen, setProfileModalOpen] = useState(false);
    
    const supportRef = useRef(null);
    const systemRef = useRef(null);
    
    // Fallback for shell rendering during initial load
    const safeUser = user || { name: ' ', role: '', sucursal: ' ' };
    const safeCompanyInfo = companyInfo || { name: ' ', licenseStatus: '' };

    const finalSidebarLinks = sidebarLinks || getTenantSidebarLinks(safeUser.role);
    const finalFooterLinks = footerLinks || TENANT_FOOTER_LINKS;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (supportRef.current && !supportRef.current.contains(event.target)) {
                setSupportPanelOpen(false);
            }
            if (systemRef.current && !systemRef.current.contains(event.target)) {
                setSystemPanelOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogoutConfirm = () => {
        setIsLogoutModalOpen(false);
        onLogout();
    };

    const toggleSupportPanel = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setSupportPanelOpen(prev => !prev);
        setSystemPanelOpen(false);
    };

    const toggleSystemPanel = () => {
        setSystemPanelOpen(prev => !prev);
        setSupportPanelOpen(false);
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

                ${companyInfo && (safeUser.role === 'Propietario' || safeUser.role === 'Administrador') && html`
                    <div class="flex-shrink-0 border-t border-slate-700/50 p-4">
                        <a href="#/licencia" onClick=${(e) => { e.preventDefault(); if(!disableNavigation) window.location.hash = '/licencia'; }} class="block w-full rounded-md p-2 -m-2 ${!disableNavigation ? 'hover:bg-slate-700/50' : 'cursor-not-allowed'} transition-colors" aria-label="Ir a Licencia y Facturación" role="button">
                            <div class="flex items-center">
                                <div class="flex-shrink-0 h-10 w-10 rounded-md bg-slate-600 flex items-center justify-center">
                                    ${safeCompanyInfo.logo ? html`
                                        <img class="h-10 w-10 rounded-md object-cover" src=${safeCompanyInfo.logo} alt="Logo de la empresa" />
                                    ` : html`
                                        <div class="text-white text-2xl">${ICONS.business}</div>
                                    `}
                                </div>
                                <div class="ml-3 flex-1 min-w-0">
                                    <p class="text-sm font-semibold text-white truncate group-hover:underline" title=${safeCompanyInfo.name}>${safeCompanyInfo.name}</p>
                                    <div class="flex items-center mt-1">
                                        <div class=${`h-2 w-2 rounded-full ${safeCompanyInfo.licenseStatus === 'Activa' ? 'bg-emerald-400' : 'bg-red-500'}`}></div>
                                        <p class="ml-1.5 text-xs text-gray-300">${safeCompanyInfo.licenseStatus}</p>
                                    </div>
                                </div>
                                <div class="ml-2 flex-shrink-0 relative" ref=${supportRef}>
                                    <${NotificationBell} icon=${ICONS.support} notifications=${notifications.support} onClick=${toggleSupportPanel} />
                                    ${supportPanelOpen && html`<${NotificationPanel} position="up" title="Notificaciones de Soporte" notifications=${notifications.support} emptyText="No hay mensajes de soporte." />`}
                                </div>
                            </div>
                        </a>
                    </div>
                `}
            </div>

            <div class="flex-shrink-0 border-t border-slate-700 p-4">
                <div class="flex w-full items-center justify-between">
                    <button onClick=${() => user && setProfileModalOpen(true)} class="flex flex-1 items-center min-w-0 group rounded-md p-2 -m-2 text-left ${!disableNavigation ? 'hover:bg-slate-700/50' : 'cursor-not-allowed'} transition-colors" aria-label="Abrir perfil de usuario" role="button">
                        <div class="flex-shrink-0">
                            <${Avatar} name=${safeUser.name} avatarUrl=${safeUser.avatar} />
                        </div>
                        <div class="ml-3 flex-1 min-w-0">
                            <p class="text-sm font-medium text-white truncate group-hover:underline" title=${safeUser.name}>${safeUser.name}</p>
                            <p class="text-xs text-gray-400 truncate" title=${`${safeUser.sucursal} - ${safeUser.role}`}>
                                ${safeUser.sucursal} - ${safeUser.role}
                            </p>
                        </div>
                    </button>
                    <div class="ml-2 flex-shrink-0 flex items-center space-x-1">
                        <button onClick=${() => setIsLogoutModalOpen(true)} title="Cerrar Sesión" class="rounded-full p-2 text-gray-400 hover:text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-800">
                            ${ICONS.logout}
                        </button>
                    </div>
                </div>
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
                <div class="relative z-10 flex h-16 flex-shrink-0 bg-white border-b border-gray-200">
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
                        
                        <div class="ml-4 flex items-center md:ml-6 space-x-4">
                            <${ConnectivityCenter} />
                            <div class="relative" ref=${systemRef}>
                                <${NotificationBell} icon=${ICONS.notifications} notifications=${notifications.system} onClick=${toggleSystemPanel} />
                                ${systemPanelOpen && html`<${NotificationPanel} title="Notificaciones del Sistema" notifications=${notifications.system} emptyText="No hay notificaciones nuevas." />`}
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