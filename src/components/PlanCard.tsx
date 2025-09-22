/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';

export function PlanCard({ plan, onSelect, isCurrentPlan = false }) {
    const { title, prices, description, features, recommended } = plan;

    const availableCycles = Object.keys(prices).filter(c => c !== 'custom' && c !== 'free');
    const defaultCycle = availableCycles.includes('monthly') ? 'monthly' : availableCycles[0] || null;
    const [billingCycle, setBillingCycle] = useState(defaultCycle);

    const cardClass = `relative flex flex-col rounded-2xl border ${isCurrentPlan ? 'border-primary ring-2 ring-primary' : (recommended ? 'border-primary' : 'border-gray-200')} bg-white p-8 shadow-sm`;
    
    const isSelectable = !isCurrentPlan && !prices.custom;
    const buttonClass = `mt-8 block w-full rounded-md px-3.5 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        isCurrentPlan 
            ? 'bg-slate-100 text-slate-500 cursor-not-allowed' 
            : (recommended && isSelectable
                ? 'bg-primary text-white hover:bg-primary-hover'
                : (isSelectable
                    ? 'bg-white text-primary ring-1 ring-inset ring-primary-light hover:ring-primary'
                    : 'bg-primary text-white hover:bg-primary-hover' // For "Contactar" button
                )
            )
    }`;
    
    let priceDisplay;
    if (prices.custom) {
        priceDisplay = html`<span class="text-4xl font-bold tracking-tight text-gray-900">${prices.custom}</span>`;
    } else if (billingCycle && prices[billingCycle] !== undefined) {
        const cycleText = {
            monthly: '/mes',
            yearly: '/año',
            lifetime: 'pago único'
        };
        priceDisplay = html`
            <span class="text-4xl font-bold tracking-tight text-gray-900">Bs ${prices[billingCycle]}</span>
            <span class="text-sm font-semibold leading-6 tracking-wide text-gray-600">${cycleText[billingCycle]}</span>
        `;
    } else {
        priceDisplay = html`<span class="text-4xl font-bold tracking-tight text-gray-900">Gratis</span>`;
    }

    const handleSelect = () => {
        if (prices.custom) {
            onSelect({ title, cycle: 'custom', price: prices.custom });
        } else if (billingCycle) {
            onSelect({ title, cycle: billingCycle, price: prices[billingCycle] });
        } else {
            // Free plan
            onSelect({ title, cycle: 'free', price: 0 });
        }
    };

    const cycleLabels = {
        monthly: 'Mensual',
        yearly: 'Anual',
        lifetime: 'Único'
    };
    
    return html`
      <div class=${cardClass}>
        ${!isCurrentPlan && recommended && html`<div class="absolute top-0 right-0 -mt-3 mr-3"><span class="inline-flex items-center rounded-full bg-primary-light px-3 py-1 text-sm font-medium text-primary-dark">Recomendado</span></div>`}
        ${isCurrentPlan && html`<div class="absolute top-0 right-0 -mt-3 mr-3"><span class="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">Plan Actual</span></div>`}
        <h3 class="text-lg font-semibold leading-8 text-gray-900">${title}</h3>
        <p class="mt-4 text-sm leading-6 text-gray-600">${description}</p>
        
        ${availableCycles.length > 1 && html`
            <div class="mt-6">
                <div class="flex items-center justify-center rounded-full bg-gray-100 p-1">
                    ${availableCycles.map(cycle => html`
                        <button
                            onClick=${() => setBillingCycle(cycle)}
                            class=${`w-full rounded-full px-2 py-1 text-sm font-semibold transition-colors ${billingCycle === cycle ? 'bg-white shadow text-primary' : 'text-gray-500 hover:bg-gray-200/50'}`}
                        >
                            ${cycleLabels[cycle]}
                        </button>
                    `)}
                </div>
            </div>
        `}
        
        <p class="mt-6 flex items-baseline gap-x-1">
            ${priceDisplay}
        </p>
        <ul role="list" class="mt-8 space-y-3 text-sm leading-6 text-gray-600 flex-grow">
          ${features.map(feature => html`
            <li class="flex gap-x-3">
              <svg class="h-6 w-5 flex-none text-primary" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clip-rule="evenodd" />
              </svg>
              ${feature}
            </li>
          `)}
        </ul>
        <button onClick=${handleSelect} disabled=${isCurrentPlan} class=${buttonClass}>
            ${isCurrentPlan ? 'Seleccionado' : (prices.custom ? 'Contactar' : 'Seleccionar Plan')}
        </button>
      </div>
    `;
}