/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useEffect, useRef } from 'preact/hooks';

const COLORS = ['#3b82f6', '#10b981', '#f97316', '#ec4899'];
const BORDER_COLORS = ['#2563eb', '#059669', '#ea580c', '#db2777'];

export function ComparativeBarChart({ data, keys, currencySymbol = 'Bs' }) {
    const chartRef = useRef(null);
    const chartInstanceRef = useRef(null);

    if (!data || data.length === 0) {
        return html`<div class="flex items-center justify-center h-72 text-gray-500">No hay datos para mostrar en este período.</div>`;
    }
    
    const formatCurrency = (value) => `${currencySymbol} ${Number(value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    useEffect(() => {
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }
        if (!chartRef.current) return;

        const ctx = chartRef.current.getContext('2d');
        
        const chartData = {
            labels: data.map(d => d.label),
            datasets: keys.map((keyInfo, index) => ({
                label: keyInfo.label,
                data: data.map(d => d[keyInfo.key]),
                backgroundColor: COLORS[index % COLORS.length],
                borderColor: BORDER_COLORS[index % BORDER_COLORS.length],
                borderWidth: 1,
                borderRadius: 4,
            })),
        };

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#e5e7eb',
                    },
                    ticks: {
                        color: '#6b7280',
                    }
                },
                x: {
                    grid: {
                        display: false,
                    },
                    ticks: {
                        color: '#4b5563',
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#4b5563',
                        usePointStyle: true,
                        boxWidth: 8,
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatCurrency(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        };

        chartInstanceRef.current = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: chartOptions
        });

        // Cleanup function to destroy the chart instance on component unmount
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
        };
    }, [data, keys, currencySymbol]);

    return html`
        <div class="relative h-80">
            <canvas ref=${chartRef}></canvas>
        </div>
    `;
}