/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';

export const ServiVentLogo = ({ className = 'h-10 w-auto', textColor = 'text-slate-900', accentColor = 'text-primary' }) => html`
  <div class=${`flex items-center font-bold text-2xl ${className} ${textColor}`}>
    Servi<span class=${accentColor}>VENT</span>
  </div>
`;