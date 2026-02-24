import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { API_URL } from '../config/api';

interface DiscussionOnlyOfficeViewerProps {
    messageId: number;
    fileName: string;
    onClose: () => void;
    token: string;
    onOpenChange?: (isOpen: boolean) => void; // Callback to notify parent about open/close state
    type?: 'discussion' | 'chat'; // Type of message (default: discussion)
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

export const DiscussionOnlyOfficeViewer = ({ messageId, fileName, onClose, token, onOpenChange, type = 'discussion' }: DiscussionOnlyOfficeViewerProps) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const editorInstanceRef = useRef<object | null>(null);

    // Build API path based on type
    const apiPath = type === 'chat' ? 'onlyoffice/chat' : 'onlyoffice/discussion';

    // Hide sidebar when viewer opens (add class to body)
    useEffect(() => {
        document.body.classList.add('onlyoffice-viewer-open');
        return () => {
            document.body.classList.remove('onlyoffice-viewer-open');
        };
    }, []);

    // Notify parent when viewer opens/closes
    useEffect(() => {
        onOpenChange?.(true);
        return () => {
            onOpenChange?.(false);
        };
    }, [onOpenChange]);

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
                // Get OnlyOffice URL from env
                const onlyofficeUrl = import.meta.env.VITE_ONLYOFFICE_URL || 'https://jtsconlyoffice.duckdns.org/';

                // Start loading script and checking file in parallel
                const scriptPromise = loadOnlyOfficeScript(onlyofficeUrl);
                const checkPromise = fetch(`${API_URL}/${apiPath}/check/${messageId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                // Wait for check response first
                const checkResponse = await checkPromise;

                if (!checkResponse.ok) {
                    throw new Error('Không thể kiểm tra file');
                }

                const checkData = await checkResponse.json();

                if (!checkData.supported) {
                    throw new Error('File này không được hỗ trợ bởi OnlyOffice');
                }

                // Wait for script to finish loading
                await scriptPromise;
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
                editorInstanceRef.current = null;
            }
        };
    }, [messageId, token, apiPath]);

    // Initialize editor when script is loaded
    useEffect(() => {
        if (!scriptLoaded || !window.DocsAPI) return;

        const initEditor = async () => {
            try {
                // Get OnlyOffice configuration from backend (view only for discussions/chat)
                const response = await fetch(`${API_URL}/${apiPath}/config/${messageId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Không thể lấy cấu hình OnlyOffice');
                }

                const data = await response.json();

                // Add token to config
                const configWithToken = {
                    ...data.config,
                    token: data.config.token,
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
                                autosave: false,
                                forcesave: false,
                            },
                            mobile: true,
                        }
                    })
                };

                // Initialize editor
                if (editorRef.current && window.DocsAPI) {
                    editorInstanceRef.current = new window.DocsAPI.DocEditor('discussion-onlyoffice-editor', configWithToken);
                }

                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
                setLoading(false);
            }
        };

        initEditor();
    }, [scriptLoaded, messageId, token, apiPath]);

    // Truncate filename for mobile display
    const displayName = fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName;

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 bg-black flex flex-col"
            style={{
                isolation: 'isolate',
                zIndex: 999999,
                paddingTop: 0,
                paddingBottom: 0,
            }}
        >
            {/* Header bar with filename and close button */}
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
                    zIndex: 1000000,
                    minHeight: isMobile ? '40px' : '44px',
                    gap: '8px',
                }}
            >
                <span style={{
                    color: '#94a3b8',
                    fontSize: '12px',
                    fontWeight: 500,
                    paddingLeft: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                    minWidth: 0,
                }}>
                    {displayName}
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

            {/* Editor Container - Full remaining space */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                        <div className="text-center">
                            <Loader2 size={40} className="animate-spin text-blue-500 mx-auto mb-3" />
                            <p className="text-gray-300 font-medium text-sm">Đang tải tài liệu...</p>
                            <p className="text-gray-500 text-xs mt-1">{fileName}</p>
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
                    id="discussion-onlyoffice-editor"
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

export default DiscussionOnlyOfficeViewer;
