import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 1024;

export function useIsMobile() {
    const [isMobile, setIsMobile] = useState<boolean>(false);

    useEffect(() => {
        const check = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        // Initial check
        check();

        // Debounce resize handler
        let timeoutId: NodeJS.Timeout;
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(check, 150); // 150ms debounce
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, []);

    return isMobile;
}
