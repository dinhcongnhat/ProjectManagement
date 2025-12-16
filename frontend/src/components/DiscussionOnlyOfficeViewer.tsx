import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Loader2, FileText, AlertCircle } from 'lucide-react';
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

    return ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col" style={{ isolation: 'isolate', zIndex: 999999 }}>
            {/* Header - with safe area for mobile notch/status bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-lg relative z-[100000]" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
                <div className="flex items-center gap-2">
                    <FileText className="text-blue-600" size={18} />
                    <div className="flex items-center gap-1">
                        <span className="font-medium text-gray-800 text-sm">{fileName}</span>
                        <span className="text-xs text-gray-500">(Chỉ xem)</span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Đóng"
                >
                    <X size={20} className="text-gray-600" />
                </button>
            </div>

            {/* Editor Container */}
            <div className="flex-1 relative bg-gray-100">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                            <p className="text-gray-600 font-medium">Đang tải tài liệu...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white">
                        <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
                            <div className="p-4 bg-red-100 rounded-full">
                                <AlertCircle className="w-12 h-12 text-red-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800">Không thể mở tài liệu</h3>
                            <p className="text-gray-600">{error}</p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                )}

                <div
                    id="discussion-onlyoffice-editor"
                    ref={editorRef}
                    className="w-full h-full"
                    style={{ display: loading || error ? 'none' : 'block' }}
                />
            </div>
        </div>,
        document.body
    );
};

export default DiscussionOnlyOfficeViewer;
