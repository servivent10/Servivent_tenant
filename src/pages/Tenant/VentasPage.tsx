/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { DashboardLayout } from '../../components/DashboardLayout.js';

export function VentasPage({ user, onLogout, onProfileUpdate, companyInfo, notifications }) {
    const breadcrumbs = [
        { name: 'Ventas', href: '#/ventas' }
    ];

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Ventas"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <h1 class="text-2xl font-semibold text-gray-900">Ventas</h1>
        <//>
    `;
}