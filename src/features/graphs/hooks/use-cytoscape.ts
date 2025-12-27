import { useRef, useImperativeHandle, forwardRef } from 'react';
import cytoscape from 'cytoscape';
// @ts-ignore
import fcose from 'cytoscape-fcose';

// Register layout extension
// @ts-ignore
cytoscape.use(fcose);

// Export types for the ref
export interface CytoscapeGraphRef {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  getCy: () => cytoscape.Core | null;
}

// Re-export cytoscape for use in components
export { cytoscape };
