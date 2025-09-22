/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Este archivo centraliza la definición de los planes de suscripción.
// Edita este archivo para añadir, eliminar o modificar los planes que se muestran
// tanto en la página de registro como en la de configuración.

export interface Plan {
  id: string;
  title: string;
  prices: {
    monthly?: number;
    yearly?: number;
    lifetime?: number;
    custom?: string; // Para "Contactar"
    free?: boolean; // Para el plan gratuito
  };
  limits: {
    maxUsers: number;
    maxBranches: number;
  };
  description: string;
  features: string[];
  recommended?: boolean;
}

// =================================================================
// PLANES PARA LA PÁGINA DE CONFIGURACIÓN Y ACTUALIZACIÓN
// =================================================================
// Estos son los planes que un usuario existente verá para actualizar su suscripción.
// No incluyas la prueba gratuita aquí.
export const UPGRADE_PLANS: Plan[] = [
  {
    id: 'emprendedor',
    title: 'Emprendedor',
    prices: {
      monthly: 100,
      yearly: 1000, // Descuento de 2 meses
      lifetime: 3000,
    },
    limits: {
      maxUsers: 3,
      maxBranches: 1,
    },
    description: 'Ideal para negocios pequeños y startups en crecimiento.',
    features: [
      'Hasta 3 usuarios',
      '1 sucursal',
      'Productos y ventas ilimitadas',
      'Reportes de ventas',
      'Soporte por correo',
      '❌ Catálogo para Clientes',
    ],
  },
  {
    id: 'profesional',
    title: 'Profesional',
    prices: {
      monthly: 200,
      yearly: 2000, // Descuento de 2 meses
      lifetime: 6000,
    },
    limits: {
      maxUsers: 10,
      maxBranches: 3,
    },
    description: 'La solución completa para empresas establecidas con múltiples sucursales.',
    features: [
      'Hasta 10 usuarios',
      'Hasta 3 sucursales',
      'Roles y permisos avanzados',
      'Traspasos entre sucursales',
      'Soporte prioritario',
      '✅ Catálogo para Clientes (Próximamente)',
    ],
    recommended: true,
  },
  {
    id: 'corporativo',
    title: 'Corporativo',
    prices: {
      custom: 'Contactar',
    },
    limits: {
        maxUsers: Infinity,
        maxBranches: Infinity,
    },
    description: 'Para grandes cadenas o empresas con necesidades a medida.',
    features: [
      'Usuarios y sucursales ilimitados',
      'Analítica y reportes a medida',
      'Gestor de cuenta dedicado',
      '✅ Catálogo para Clientes (Próximamente)',
    ],
  },
];


// =================================================================
// PLANES PARA EL FLUJO DE REGISTRO
// =================================================================
// Esta lista incluye la Prueba Gratuita y luego todos los planes de pago.
export const REGISTRATION_PLANS: Plan[] = [
    {
        id: 'trial',
        title: 'Prueba Gratuita',
        prices: {
            free: true,
        },
        // La prueba gratuita tiene los límites del plan Profesional
        limits: {
            maxUsers: 10,
            maxBranches: 3,
        },
        description: 'Prueba las funciones del Plan Profesional durante 30 días.',
        features: [
            'Acceso completo a funciones premium',
            'Sin compromiso de pago',
            'Soporte por correo electrónico'
        ],
    },
    ...UPGRADE_PLANS, // Reutiliza los planes de pago definidos arriba
];
