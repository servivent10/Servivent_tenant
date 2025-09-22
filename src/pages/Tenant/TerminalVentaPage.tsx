/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { DashboardLayout } from '../../components/DashboardLayout.js';

export function TerminalVentaPage({ user, onLogout, onProfileUpdate, companyInfo, notifications }) {
    const breadcrumbs = [
        { name: 'Terminal de Venta', href: '#/terminal-venta' }
    ];

    return html`
        <${DashboardLayout} 
            user=${user} 
            onLogout=${onLogout}
            onProfileUpdate=${onProfileUpdate}
            activeLink="Terminal de Venta"
            breadcrumbs=${breadcrumbs}
            companyInfo=${companyInfo}
            notifications=${notifications}
        >
            <h1 class="text-2xl font-semibold text-gray-900">Terminal de Venta</h1>
        <//>
    `;
}