import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { API_URL } from '../config/api';

interface OnlyOfficeViewerProps {
    attachmentId: number;
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
            reject(new Error('Không thể tải OnlyOffice'));
        };
        document.body.appendChild(script);
    });

    return window._onlyofficeScriptLoading;
};

export const OnlyOfficeViewer = ({ attachmentId, onClose, token }: OnlyOfficeViewerProps) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const editorInstanceRef = useRef<object | null>(null);

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
                // First, check if file is supported and get OnlyOffice URL
                const checkResponse = await fetch(`${API_URL}/onlyoffice/check/${attachmentId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!checkResponse.ok) {
                    throw new Error('Không thể kiểm tra file');
                }

                const checkData = await checkResponse.json();

                if (!checkData.supported) {
                    throw new Error('File này không được hỗ trợ bởi OnlyOffice');
                }

                const onlyofficeUrl = checkData.onlyofficeUrl;

                // Load script (uses singleton pattern - only loads once)
                await loadOnlyOfficeScript(onlyofficeUrl);
                setScriptLoaded(true);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
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
    }, [attachmentId, token]);

    // Initialize editor when script is loaded
    useEffect(() => {
        if (!scriptLoaded || !window.DocsAPI) return;

        const initEditor = async () => {
            try {
                // Get OnlyOffice configuration from backend
                const response = await fetch(`${API_URL}/onlyoffice/config/${attachmentId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Không thể lấy cấu hình OnlyOffice');
                }

                const data = await response.json();

                // Backend already returns fully signed config with token
                // Just add mobile optimizations if needed
                const configWithToken = {
                    ...data.config,
                    // Mobile-specific settings
                    ...(isMobile && {
                        width: '100%',
                        height: '100%',
                        type: 'mobile',
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
                                toolbar: false,
                            },
                            mobile: true,
                        }
                    })
                };

                // Initialize editor
                if (editorRef.current && window.DocsAPI) {
                    editorInstanceRef.current = new window.DocsAPI.DocEditor('onlyoffice-editor', configWithToken);
                }

                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
                setLoading(false);
            }
        };

        initEditor();
    }, [scriptLoaded, attachmentId, token]);

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] bg-black flex flex-col"
            style={{
                /* Ensure full-screen on notched iPhones */
                paddingTop: 0,
                paddingBottom: 0,
            }}
        >
            {/* Header bar for mobile with close button */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    paddingTop: isMobile ? 'max(6px, env(safe-area-inset-top, 6px))' : '6px',
                    background: 'rgba(17,24,39,0.95)',
                    backdropFilter: 'blur(8px)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    flexShrink: 0,
                    zIndex: 10000,
                    minHeight: isMobile ? '40px' : '44px',
                }}
            >
                <span style={{
                    color: '#94a3b8',
                    fontSize: '13px',
                    fontWeight: 500,
                    paddingLeft: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                }}>
                    Xem tài liệu
                </span>
                <button
                    onClick={onClose}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'rgba(255,255,255,0.1)',
                        color: '#e2e8f0',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'background 0.15s',
                    }}
                    title="Đóng (ESC)"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Editor Container - takes remaining space */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                        <div className="text-center">
                            <Loader2 size={40} className="animate-spin text-blue-500 mx-auto mb-3" />
                            <p className="text-gray-300 font-medium text-sm">Đang tải tài liệu...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                        <div className="text-center p-6 max-w-md">
                            <AlertCircle size={40} className="text-red-500 mx-auto mb-3" />
                            <p className="text-red-400 font-medium mb-2 text-sm">{error}</p>
                            <button
                                onClick={onClose}
                                className="mt-3 px-5 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                )}

                <div
                    id="onlyoffice-editor"
                    ref={editorRef}
                    style={{
                        width: '100%',
                        height: '100%',
                        display: loading || error ? 'none' : 'block',
                    }}
                />
            </div>
        </div>,
        document.body
    );
};

export default OnlyOfficeViewer;
