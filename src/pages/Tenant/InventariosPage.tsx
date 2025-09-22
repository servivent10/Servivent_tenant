/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { DashboardLayout } from '../../components/DashboardLayout.js';

export function InventariosPage({ user, onLogout, onProfileUpdate, companyInfo, notifications }) {
    const breadcrumbs = [
        { name: 'Inventarios', href: '#/inventarios' }
    ];

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Inventarios"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <h1 class="text-2xl font-semibold text-gray-900">Inventarios</h1>
        <//>
    `;
}