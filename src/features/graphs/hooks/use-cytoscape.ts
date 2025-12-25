import { useRef, useImperativeHandle, forwardRef } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';

// Register layout extension
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
