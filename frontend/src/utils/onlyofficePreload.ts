// Preload OnlyOffice script in background for faster loading
declare global {
    interface Window {
        DocsAPI?: {
            DocEditor: new (elementId: string, config: object) => object;
        };
        _onlyofficeScriptLoading?: Promise<void>;
    }
}

export const preloadOnlyOfficeScript = () => {
    // Get OnlyOffice URL from env
    const onlyofficeUrl = import.meta.env.VITE_ONLYOFFICE_URL || 'https://jtscoffice.duckdns.org/';
    
    // Skip if already loaded or loading
    if (window.DocsAPI || window._onlyofficeScriptLoading) {
        return;
    }
    
    // Use requestIdleCallback to load when browser is idle
    const load = () => {
        // Create link preload first
        const preloadLink = document.createElement('link');
        preloadLink.rel = 'preload';
        preloadLink.as = 'script';
        preloadLink.href = `${onlyofficeUrl}/web-apps/apps/api/documents/api.js`;
        document.head.appendChild(preloadLink);
        
        // Then load the actual script after a short delay
        setTimeout(() => {
            if (window.DocsAPI || window._onlyofficeScriptLoading) return;
            
            window._onlyofficeScriptLoading = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `${onlyofficeUrl}/web-apps/apps/api/documents/api.js`;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => {
                    window._onlyofficeScriptLoading = undefined;
                    reject(new Error('Failed to preload OnlyOffice'));
                };
                document.body.appendChild(script);
            });
        }, 2000); // Wait 2 seconds after page load
    };
    
    if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(load);
    } else {
        setTimeout(load, 3000);
    }
};
