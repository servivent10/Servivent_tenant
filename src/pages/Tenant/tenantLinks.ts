/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { ICONS } from '../../components/Icons.js';

export function getTenantSidebarLinks(role, companyInfo) {
    const links = [
        { name: 'Dashboard', href: '#/dashboard', icon: ICONS.home },
        { name: 'Punto de Venta', href: '#/terminal-venta', icon: ICONS.pos },
        { name: 'Productos', href: '#/productos', icon: ICONS.products },
    ];
    
    links.push({ name: 'Inventarios', href: '#/inventarios', icon: ICONS.inventory });

    if (role === 'Propietario' || role === 'Administrador') {
        links.push({ name: 'Historial de Inventario', href: '#/historial-inventario', icon: ICONS.inventory_history });
    }

    if (role === 'Propietario' || role === 'Administrador') {
        links.push(
            { name: 'Compras', href: '#/compras', icon: ICONS.purchases },
            { name: 'Ventas', href: '#/ventas', icon: ICONS.sales }
        );
        // **DYNAMIC MODULE based on plan features**
        if (companyInfo?.planDetails?.features?.aperturar_cajas) {
            links.push({ name: 'Historial de Cajas', href: '#/historial-cajas', icon: ICONS.history_edu });
        }
    } else if (role === 'Empleado') {
        links.push({ name: 'Ventas', href: '#/ventas', icon: ICONS.sales });
    }
    
    // Add Sucursales link with dynamic name
    const sucursalesLinkName = role === 'Propietario' ? 'Sucursales' : 'Mi Sucursal';
    links.push({ name: sucursalesLinkName, href: '#/sucursales', icon: ICONS.storefront });
    
    if (role === 'Propietario' || role === 'Administrador') {
        links.push(
            { name: 'Proveedores', href: '#/proveedores', icon: ICONS.suppliers },
            { name: 'Clientes', href: '#/clientes', icon: ICONS.clients }
        );

        // **DYNAMIC MODULE based on plan features**
        if (companyInfo?.planDetails?.features?.modulo_traspasos) {
            links.push({ name: 'Traspasos', href: '#/traspasos', icon: ICONS.transfers });
        }

        links.push(
            { name: 'Gastos', href: '#/gastos', icon: ICONS.expenses },
            { name: 'Auditoría', href: '#/auditoria', icon: ICONS.manage_history }
        );
    }
    
    return links;
}


export const TENANT_FOOTER_LINKS = [
    { name: 'Configuración', href: '#/configuracion', icon: ICONS.settings },
];
