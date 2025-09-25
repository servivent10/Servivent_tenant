/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { ICONS } from './Icons.js';

export function CalendarModal({ isOpen, onClose, currentDate, onDateSelect }) {
    const [viewDate, setViewDate] = useState(currentDate || new Date());

    useEffect(() => {
        if (isOpen) {
            // Si currentDate es una fecha válida, úsala; de lo contrario, usa la fecha de hoy.
            // FIX: Explicitly convert Date to number for isNaN check to satisfy TypeScript.
            setViewDate(currentDate instanceof Date && !isNaN(currentDate.getTime()) ? currentDate : new Date());
        }
    }, [isOpen, currentDate]);

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const handleDateClick = (day) => {
        const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        onDateSelect(selected);
    };

    const calendarGrid = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const grid = [];
        const dayOffset = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;

        for (let i = 0; i < dayOffset; i++) {
            grid.push(null);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            grid.push(i);
        }
        return grid;
    }, [viewDate]);

    const today = new Date();
    const selectedDate = currentDate;

    if (!isOpen) return null;

    return html`
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-fade-in" onClick=${onClose}>
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75"></div>
            <div class="relative bg-white rounded-lg shadow-xl p-4 w-full max-w-xs animate-modal-scale-in" onClick=${e => e.stopPropagation()}>
                <div class="flex items-center justify-between mb-4">
                    <button onClick=${handlePrevMonth} class="p-2 rounded-full hover:bg-gray-100">${ICONS.chevron_left}</button>
                    <div class="font-semibold text-gray-800 capitalize">
                        ${viewDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                    </div>
                    <button onClick=${handleNextMonth} class="p-2 rounded-full hover:bg-gray-100">${ICONS.chevron_right}</button>
                </div>
                <div class="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 font-semibold mb-2">
                    ${['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map(day => html`<div key=${day}>${day}</div>`)}
                </div>
                <div class="grid grid-cols-7 gap-1">
                    ${calendarGrid.map((day, index) => {
                        if (day === null) {
                            return html`<div key=${'empty-' + index}></div>`;
                        }
                        const isToday = today.getFullYear() === viewDate.getFullYear() && today.getMonth() === viewDate.getMonth() && today.getDate() === day;
                        const isSelected = selectedDate && selectedDate.getFullYear() === viewDate.getFullYear() && selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getDate() === day;
                        
                        let buttonClasses = 'w-9 h-9 flex items-center justify-center rounded-full transition-colors text-sm ';
                        if (isSelected) {
                            buttonClasses += 'bg-primary text-white font-bold ring-2 ring-primary-dark';
                        } else if (isToday) {
                            buttonClasses += 'bg-primary-light text-primary font-bold';
                        } else {
                            buttonClasses += 'text-gray-700 hover:bg-gray-100';
                        }

                        return html`
                            <div key=${day} class="flex justify-center">
                                <button onClick=${() => handleDateClick(day)} class=${buttonClasses}>
                                    ${day}
                                </button>
                            </div>
                        `;
                    })}
                </div>
            </div>
        </div>
    `;
}