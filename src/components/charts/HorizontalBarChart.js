/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useEffect, useRef } from 'preact/hooks';

const BG_COLOR = '#3b82f6';
const BORDER_COLOR = '#2563eb';

export function HorizontalBarChart({ data, currencySymbol = 'Bs' }) {
    const chartRef = useRef(null);
    const chartInstanceRef = useRef(null);

    if (!data || data.length === 0) {
        return html`<p class="text-sm text-gray-500 text-center py-4">No hay datos de ventas de productos en este período.</p>`;
    }

    const formatCurrency = (value) => `${currencySymbol} ${Number(value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    useEffect(() => {
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }
        if (!chartRef.current) return;

        const ctx = chartRef.current.getContext('2d');
        
        const chartData = {
            labels: data.map(d => d.nombre),
            datasets: [{
                label: 'Total Vendido',
                data: data.map(d => d.total_vendido),
                backgroundColor: BG_COLOR,
                borderColor: BORDER_COLOR,
                borderWidth: 1,
                borderRadius: 4,
            }],
        };

        const chartOptions = {
            indexAxis: 'y', // This makes it a horizontal bar chart
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: '#e5e7eb',
                    },
                    ticks: {
                        color: '#6b7280',
                    }
                },
                y: {
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
                    display: false // Hide legend for single-dataset charts
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.x !== null) {
                                label += formatCurrency(context.parsed.x);
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

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
        };
    }, [data, currencySymbol]);
    
    const chartHeight = data.length * 40 + 40; // Dynamic height

    return html`
        <div class="relative" style=${{ height: `${chartHeight}px` }}>
            <canvas ref=${chartRef}></canvas>
        </div>
    `;
}