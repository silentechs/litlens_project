import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

export function useCytoscape(elements: cytoscape.ElementDefinition[], options: any = {}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<cytoscape.Core | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const cy = cytoscape({
            container: containerRef.current,
            elements,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#1a3320',
                        'label': 'data(label)',
                        'font-family': 'EB Garamond, serif',
                        'font-style': 'italic',
                        'font-size': '12px',
                        'color': '#1a3320',
                        'text-margin-y': 10,
                        'text-valign': 'bottom',
                        'text-halign': 'center',
                        'width': 'data(size)',
                        'height': 'data(size)',
                        'overlay-opacity': 0,
                        'transition-property': 'background-color, line-color, target-arrow-color',
                        'transition-duration': 300
                    }
                },
                {
                    selector: 'node[type="core"]',
                    style: {
                        'background-color': '#0a5c91',
                    }
                },
                {
                    selector: 'node:selected',
                    style: {
                        'background-color': '#0a5c91',
                        'border-width': 4,
                        'border-color': 'rgba(10, 92, 145, 0.2)',
                        'border-opacity': 1
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 1,
                        'line-color': '#d1d1cc',
                        'line-style': 'dashed',
                        'curve-style': 'bezier',
                        'target-arrow-shape': 'vee',
                        'target-arrow-color': '#d1d1cc',
                        'arrow-scale': 0.8
                    }
                },
                {
                    selector: 'edge:hover',
                    style: {
                        'line-color': '#1a3320',
                        'width': 2
                    }
                }
            ],
            layout: {
                name: 'cose',
                animate: true,
                animationDuration: 1000,
                ...options.layout
            },
            ...options
        });

        cyRef.current = cy;

        cy.on('tap', 'node', (evt) => {
            options.onNodeClick?.(evt.target.id(), evt.target.data());
        });

        cy.on('tap', (evt) => {
            if (evt.target === cy) {
                options.onCanvasClick?.();
            }
        });

        return () => {
            cy.destroy();
        };
    }, [elements]); // Re-init on elements change for simple demo

    return { containerRef, cyRef };
}
