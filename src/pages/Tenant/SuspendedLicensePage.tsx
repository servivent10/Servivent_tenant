/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { getTenantSidebarLinks, TENANT_FOOTER_LINKS } from './tenantLinks.js';

export function SuspendedLicensePage({ user, onLogout, onProfileUpdate, companyInfo }) {
    
    const sidebarLinks = getTenantSidebarLinks(user.role);

    const breadcrumbs = [
        { name: 'Cuenta Suspendida', href: '#' }
    ];

    const contactEmail = 'servivent10@gmail.com';

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            sidebarLinks=${sidebarLinks}
            footerLinks=${TENANT_FOOTER_LINKS}
            activeLink=""
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${{ support: [], system: [] }}
            disableNavigation=${true}
        >
            <div class="text-center bg-white p-8 rounded-lg shadow-md border border-red-200">
                <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <div class="text-red-600 text-4xl">${ICONS.suspend}</div>
                </div>
                <h1 class="mt-6 text-2xl font-bold text-gray-900">Cuenta Suspendida</h1>
                <div class="mt-4 text-gray-600">
                    <p>El acceso a la empresa <span class="font-semibold">${companyInfo.name}</span> ha sido suspendido temporalmente.</p>
                    <p class="mt-2">Debido a esto, todas las funcionalidades de la aplicación han sido deshabilitadas.</p>
                    <p class="mt-4">
                        Por favor, contacta con el administrador del sistema para regularizar tu situación y reactivar tu licencia.
                    </p>
                </div>
                <div class="mt-6">
                    <a href="mailto:${contactEmail}" class="inline-flex items-center gap-x-2 rounded-md bg-secondary-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-dark">
                        ${ICONS.support}
                        Contactar a Soporte
                    </a>
                </div>
                 <p class="mt-4 text-xs text-gray-500">
                    Puedes mencionar tu correo (${user.email}) y el NIT de tu empresa para agilizar el proceso.
                </p>
            </div>
        <//>
    `;
}