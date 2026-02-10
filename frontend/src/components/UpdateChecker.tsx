import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Download } from 'lucide-react';

// Store the version at load time
let INITIAL_VERSION: string | null = null;

const UpdateChecker = () => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updating, setUpdating] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasCheckedRef = useRef(false);

    const checkVersion = useCallback(async () => {
        try {
            // Fetch with cache-busting query param to bypass all caches
            const res = await fetch(`/version.json?_t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
            });
            if (!res.ok) return;

            const data = await res.json();
            const serverVersion = data.version;

            if (!serverVersion) return;

            // On first check, store the initial version
            if (!INITIAL_VERSION) {
                INITIAL_VERSION = serverVersion;
                return;
            }

            // Compare versions
            if (serverVersion !== INITIAL_VERSION) {
                console.log(`[UpdateChecker] New version detected: ${INITIAL_VERSION} → ${serverVersion}`);
                setUpdateAvailable(true);
                // Stop polling once update is detected
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            }
        } catch (err) {
            // Silently ignore fetch errors
        }
    }, []);

    useEffect(() => {
        if (hasCheckedRef.current) return;
        hasCheckedRef.current = true;

        // Initial check after a delay
        const timeout = setTimeout(() => {
            checkVersion();
        }, 3000);

        // Poll every 30 seconds
        intervalRef.current = setInterval(checkVersion, 30000);

        return () => {
            clearTimeout(timeout);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [checkVersion]);

    // Also check when tab becomes visible again
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !updateAvailable) {
                checkVersion();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [checkVersion, updateAvailable]);

    const handleUpdate = async () => {
        setUpdating(true);

        try {
            // 1. Unregister all service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log('[UpdateChecker] Service workers unregistered');
            }

            // 2. Clear all caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const cacheName of cacheNames) {
                    await caches.delete(cacheName);
                }
                console.log('[UpdateChecker] Caches cleared');
            }

            // 3. Clear localStorage version markers
            localStorage.removeItem('app_version');

            // 4. Hard reload - works on both desktop and mobile
            // Using location.replace with cache-busting to force fresh load
            const url = new URL(window.location.href);
            url.searchParams.set('_updated', Date.now().toString());
            window.location.replace(url.toString());
        } catch (err) {
            console.error('[UpdateChecker] Error during update:', err);
            // Fallback: simple reload
            window.location.reload();
        }
    };

    if (!updateAvailable) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-300"
                style={{ animation: 'updateDialogIn 0.3s ease-out' }}
            >
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-center">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
                        <Download size={28} className="text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Cập nhật phần mềm</h2>
                    <p className="text-blue-100 text-sm mt-1">Phiên bản mới đã sẵn sàng</p>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    <p className="text-gray-600 dark:text-gray-300 text-sm text-center leading-relaxed">
                        Hệ thống đã được cập nhật với các tính năng mới và sửa lỗi.
                        Vui lòng nhấn <strong>Cập nhật ngay</strong> để sử dụng phiên bản mới nhất.
                    </p>

                    {/* Update button */}
                    <button
                        onClick={handleUpdate}
                        disabled={updating}
                        className="w-full mt-5 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/30 active:scale-[0.98] disabled:opacity-70"
                    >
                        {updating ? (
                            <>
                                <RefreshCw size={18} className="animate-spin" />
                                Đang cập nhật...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={18} />
                                Cập nhật ngay
                            </>
                        )}
                    </button>

                    {/* Dismiss - subtle */}
                    <button
                        onClick={() => setUpdateAvailable(false)}
                        className="w-full mt-2 py-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        Để sau
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes updateDialogIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9) translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};

export default UpdateChecker;
