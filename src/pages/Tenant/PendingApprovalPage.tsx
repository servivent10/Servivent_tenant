/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { DashboardLayout } from '../../components/DashboardLayout.js';
import { ICONS } from '../../components/Icons.js';
import { getTenantSidebarLinks, TENANT_FOOTER_LINKS } from './tenantLinks.js';

export function PendingApprovalPage({ user, onLogout, onProfileUpdate, companyInfo }) {
    
    // FIX: Pass companyInfo to getTenantSidebarLinks to satisfy function signature and allow dynamic link generation based on plan.
    const sidebarLinks = getTenantSidebarLinks(user.role, companyInfo);

    const breadcrumbs = [
        { name: 'Cuenta Pendiente', href: '#' }
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
            <div class="text-center bg-white p-8 rounded-lg shadow-md border border-blue-200">
                <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                    <div class="text-blue-600 text-4xl">${ICONS.activity}</div>
                </div>
                <h1 class="mt-6 text-2xl font-bold text-gray-900">Cuenta Pendiente de Aprobación</h1>
                <div class="mt-4 text-gray-600">
                    <p>Tu solicitud para la empresa <span class="font-semibold">${companyInfo.name}</span> ha sido recibida y está siendo revisada.</p>
                    <p class="mt-2">Recibirás una notificación por correo electrónico una vez que tu cuenta sea activada por nuestro equipo.</p>
                    <p class="mt-4">
                        Si tienes alguna pregunta, no dudes en contactarnos.
                    </p>
                </div>
                <div class="mt-6">
                    <a href="mailto:${contactEmail}" class="inline-flex items-center gap-x-2 rounded-md bg-secondary-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-dark">
                        ${ICONS.support}
                        Contactar a Soporte
                    </a>
                </div>
                 <p class="mt-4 text-xs text-gray-500">
                    Gracias por tu paciencia.
                </p>
            </div>
        <//>
    `;
}
