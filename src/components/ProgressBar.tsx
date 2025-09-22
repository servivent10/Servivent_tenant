/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { useLoading } from '../hooks/useLoading.js';

export function ProgressBar() {
    const { isLoading } = useLoading();
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isLoading) {
            setVisible(true);
            setProgress(10); // Start with a small jump for immediate feedback
            const timeout = setTimeout(() => {
                setProgress(90);
            }, 150);
            return () => clearTimeout(timeout);
        } else {
            // If it was visible, complete the animation
            if (visible) {
                setProgress(100);
                const timeout = setTimeout(() => {
                    setVisible(false);
                    // Reset progress after fade out for next time
                    setTimeout(() => setProgress(0), 400); 
                }, 400); // Should match opacity transition duration
                return () => clearTimeout(timeout);
            }
        }
    }, [isLoading, visible]);

    const progressBarStyle = {
        width: `${progress}%`,
        transition: `width ${progress === 100 ? '0.3s' : '8s'} cubic-bezier(0.1, 0.9, 0.2, 1)`,
    };

    const containerStyle = {
        opacity: visible && progress < 100 ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out',
    };

    return html`
        <div style=${containerStyle} class="absolute top-0 left-0 w-full h-0.5 bg-slate-200 z-50 pointer-events-none">
            <div class="h-full bg-secondary-dark" style=${progressBarStyle}></div>
        </div>
    `;
}