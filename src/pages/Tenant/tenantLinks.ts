/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { ICONS } from '../../components/Icons.js';

export function getTenantSidebarLinks(role) {
    const links = [
        { name: 'Dashboard', href: '#/dashboard', icon: ICONS.home },
        { name: 'Punto de Venta', href: '#/terminal-venta', icon: ICONS.pos },
        { name: 'Productos', href: '#/productos', icon: ICONS.products },
    ];
    
    links.push({ name: 'Inventarios', href: '#/inventarios', icon: ICONS.inventory });

    if (role === 'Propietario' || role === 'Administrador') {
        links.push(
            { name: 'Compras', href: '#/compras', icon: ICONS.purchases },
            { name: 'Ventas', href: '#/ventas', icon: ICONS.sales },
            { name: 'Historial de Cajas', href: '#/historial-cajas', icon: ICONS.history_edu }
        );
    } else if (role === 'Empleado') {
        links.push({ name: 'Ventas', href: '#/ventas', icon: ICONS.sales });
    }
    
    // Add Sucursales link with dynamic name
    const sucursalesLinkName = role === 'Propietario' ? 'Sucursales' : 'Mi Sucursal';
    links.push({ name: sucursalesLinkName, href: '#/sucursales', icon: ICONS.storefront });
    
    if (role === 'Propietario' || role === 'Administrador') {
        links.push(
            { name: 'Proveedores', href: '#/proveedores', icon: ICONS.suppliers },
            { name: 'Clientes', href: '#/clientes', icon: ICONS.clients },
            { name: 'Traspasos', href: '#/traspasos', icon: ICONS.transfers },
            { name: 'Gastos', href: '#/gastos', icon: ICONS.expenses }
        );
    }
    
    return links;
}


export const TENANT_FOOTER_LINKS = [
    { name: 'Configuración', href: '#/configuracion', icon: ICONS.settings },
];