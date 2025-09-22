/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const names = name.trim().split(' ');
  if (names.length === 1) {
    return names[0].substring(0, 2).toUpperCase();
  }
  const firstInitial = names[0][0] || '';
  const lastInitial = names[names.length - 1][0] || '';
  return `${firstInitial}${lastInitial}`.toUpperCase();
};

const DYNAMIC_COLORS = [
    '#f43f5e', // rose-500
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#eab308', // yellow-500
    '#84cc16', // lime-500
    '#22c55e', // green-500
    '#10b981', // emerald-500
    '#14b8a6', // teal-500
    '#06b6d4', // cyan-500
    '#3b82f6', // blue-500
    '#6366f1', // indigo-500
    '#8b5cf6', // violet-500
    '#a855f7', // purple-500
    '#d946ef', // fuchsia-500
    '#ec4899', // pink-500
];

const getColorForName = (name) => {
    if (!name) return DYNAMIC_COLORS[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % DYNAMIC_COLORS.length);
    return DYNAMIC_COLORS[index];
};

export function Avatar({ name, avatarUrl, size = 'h-10 w-10', className = '' }) {
    if (avatarUrl) {
        return html`
            <img 
                class="${size} rounded-full object-cover ${className}" 
                src=${avatarUrl} 
                alt="Avatar de ${name}" 
            />
        `;
    }

    const initials = getInitials(name);
    const bgColor = getColorForName(name);
    
    // Adjust font size based on container size for better scaling
    const sizeNumber = parseInt(size.match(/\d+/)[0] || '10', 10);
    const fontSize = `text-${sizeNumber <= 8 ? 'xs' : (sizeNumber <= 12 ? 'base' : 'lg')}`;

    return html`
        <div 
            class="${size} rounded-full flex items-center justify-center font-semibold text-white ${className}"
            style=${{ backgroundColor: bgColor }}
            title=${name}
        >
            <span class=${fontSize}>${initials}</span>
        </div>
    `;
}
