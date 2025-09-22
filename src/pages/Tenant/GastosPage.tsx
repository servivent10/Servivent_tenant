/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { DashboardLayout } from '../../components/DashboardLayout.js';

export function GastosPage({ user, onLogout, onProfileUpdate, companyInfo, notifications }) {
    const breadcrumbs = [
        { name: 'Gastos', href: '#/gastos' }
    ];

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Gastos"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <h1 class="text-2xl font-semibold text-gray-900">Gastos</h1>
        <//>
    `;
}