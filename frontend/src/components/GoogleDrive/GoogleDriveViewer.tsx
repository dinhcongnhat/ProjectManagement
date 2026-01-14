import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { API_URL } from '../../config/api';
import { GoogleDriveSaveAsDialog } from './GoogleDriveSaveAsDialog';

interface GoogleDriveViewerProps {
    fileId: string;
    fileName: string;
    onClose: () => void;
    token: string;
}

declare global {
    interface Window {
        DocsAPI?: {
            DocEditor: new (elementId: string, config: object) => object;
        };
        _onlyofficeScriptLoading?: Promise<void>;
    }
}

// Check if mobile device
const isMobile = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
);

// Singleton script loader - prevents multiple loads
const loadOnlyOfficeScript = (onlyofficeUrl: string): Promise<void> => {
    // Return existing promise if already loading
    if (window._onlyofficeScriptLoading) {
        return window._onlyofficeScriptLoading;
    }

    // Already loaded
    if (window.DocsAPI) {
        return Promise.resolve();
    }

    // Start loading
    window._onlyofficeScriptLoading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `${onlyofficeUrl}/web-apps/apps/api/documents/api.js`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
            window._onlyofficeScriptLoading = undefined;
            reject(new Error('Failed to load OnlyOffice'));
        };
        document.body.appendChild(script);
    });

    return window._onlyofficeScriptLoading;
};

export const GoogleDriveViewer = ({ fileId, fileName, onClose, token }: GoogleDriveViewerProps) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const editorInstanceRef = useRef<object | null>(null);
    const [saveAsOpen, setSaveAsOpen] = useState(false);
    const [saveAsName, setSaveAsName] = useState('');

    // Handle browser back button
    useEffect(() => {
        // Push a new state when viewer opens
        window.history.pushState({ onlyofficeViewer: true }, '');

        const handlePopState = () => {
            // When user clicks back button, close the viewer
            onClose();
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [onClose]);

    // Load OnlyOffice script
    useEffect(() => {
        const loadScript = async () => {
            try {
                // Get OnlyOffice config and URL
                const response = await fetch(`${API_URL}/onlyoffice/drive/config/${fileId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to get OnlyOffice config');
                }

                const data = await response.json();
                const onlyofficeUrl = data.onlyofficeUrl;

                // Load script (uses singleton pattern - only loads once)
                await loadOnlyOfficeScript(onlyofficeUrl);
                setScriptLoaded(true);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
                setLoading(false);
            }
        };

        loadScript();

        // Cleanup
        return () => {
            if (editorInstanceRef.current) {
                // OnlyOffice doesn't provide a clear destroy method
                editorInstanceRef.current = null;
            }
        };
    }, [fileId, token]);

    // Initialize editor when script is loaded
    useEffect(() => {
        if (!scriptLoaded || !window.DocsAPI) return;

        const initEditor = async () => {
            try {
                // Get OnlyOffice configuration from backend
                const response = await fetch(`${API_URL}/onlyoffice/drive/config/${fileId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to get OnlyOffice config');
                }

                const data = await response.json();

                // Add mobile optimizations
                // Add mobile optimizations and event handlers
                const config = {
                    ...data.config,
                    events: {
                        ...data.config.events,
                        onRequestSaveAs: (event: any) => {
                            console.log('OnlyOffice Save As requested:', event.data);
                            setSaveAsName(event.data.title || fileName);
                            setSaveAsOpen(true);
                        },
                        onError: (event: any) => {
                            // FAST TRACK: Aggressively suppress ANY error to avoid popup
                            console.warn('OnlyOffice Popup Suppressed (Error):', event?.data);
                            return true;
                        },
                        onWarning: (event: any) => {
                            // FAST TRACK: Aggressively suppress ANY warning to avoid popup
                            console.warn('OnlyOffice Popup Suppressed (Warning):', event?.data);
                            return true;
                        }
                    },
                    ...(isMobile && {
                        width: '100%',
                        height: '100%',
                        editorConfig: {
                            ...data.config.editorConfig,
                            customization: {
                                ...data.config.editorConfig?.customization,
                                compactHeader: true,
                                compactToolbar: true,
                                toolbarNoTabs: true,
                                hideRightMenu: true,
                                leftMenu: false,
                                rightMenu: false,
                                statusBar: false,
                            },
                            mobile: true,
                        }
                    })
                };

                // Initialize editor
                if (editorRef.current && window.DocsAPI) {
                    editorInstanceRef.current = new window.DocsAPI.DocEditor('onlyoffice-drive-editor', config);
                }

                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
                setLoading(false);
            }
        };

        initEditor();
    }, [scriptLoaded, fileId, token]);

    return createPortal(
        <div className="fixed inset-0 z-[10000] bg-black flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
                <span className="text-white font-medium truncate">{fileName}</span>
                <button
                    onClick={onClose}
                    className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors shadow-sm ml-4"
                    title="Close (ESC)"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Editor Container - Full screen */}
            <div className="flex-1 relative bg-gray-900">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <Loader2 size={48} className="animate-spin text-blue-500 mx-auto mb-4" />
                            <p className="text-gray-300 font-medium">Loading document...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center p-6 max-w-md">
                            <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                            <p className="text-red-400 font-medium mb-2">{error}</p>
                            <button
                                onClick={onClose}
                                className="mt-4 px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}

                <div
                    id="onlyoffice-drive-editor"
                    ref={editorRef}
                    className="w-full h-full"
                    style={{ display: loading || error ? 'none' : 'block', minHeight: '100%' }}
                />

                {/* CSS Hack to hide OnlyOffice Warnings if remote blocking fails */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    iframe[name^="frameEditor"] .toast {
                         display: none !important;
                         visibility: hidden !important;
                         opacity: 0 !important;
                    }
                `}} />
            </div>

            {saveAsOpen && (
                <GoogleDriveSaveAsDialog
                    fileId={fileId}
                    fileName={saveAsName}
                    token={token}
                    onClose={() => setSaveAsOpen(false)}
                    onSuccess={() => {
                        // Optional: Show success toast or refresh
                    }}
                />
            )}
        </div>,
        document.body
    );
};
