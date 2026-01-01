import { useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { API_URL } from '../config/api';

interface ProjectAttachmentViewerProps {
    attachmentId: number;
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

// Singleton script loader
const loadOnlyOfficeScript = (onlyofficeUrl: string): Promise<void> => {
    if (window._onlyofficeScriptLoading) {
        return window._onlyofficeScriptLoading;
    }

    if (window.DocsAPI) {
        return Promise.resolve();
    }

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

export const ProjectAttachmentViewer = ({ attachmentId, fileName, onClose, token }: ProjectAttachmentViewerProps) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const editorInstanceRef = useRef<object | null>(null);
    const initializingRef = useRef(false);

    useEffect(() => {
        const initEditor = async () => {
            if (initializingRef.current || !editorRef.current) return;
            initializingRef.current = true;

            try {
                // Get config from backend
                const response = await fetch(`${API_URL}/projects/attachments/${attachmentId}/presigned-url`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!response.ok) {
                    throw new Error('Không thể lấy cấu hình xem file');
                }

                const data = await response.json();

                // Check if image
                const ext = fileName.split('.').pop()?.toLowerCase() || '';
                const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
                if (imageExtensions.includes(ext)) {
                    setImageUrl(data.url);
                    setLoading(false);
                    return;
                }

                const onlyofficeUrl = data.onlyofficeUrl || 'https://jtsconlyoffice.duckdns.org';

                // Load OnlyOffice script
                await loadOnlyOfficeScript(onlyofficeUrl);

                if (!window.DocsAPI) {
                    throw new Error('OnlyOffice API không sẵn sàng');
                }

                // Determine document type
                let documentType = 'word';
                if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
                    documentType = 'cell';
                } else if (['ppt', 'pptx', 'odp'].includes(ext)) {
                    documentType = 'slide';
                }

                // Create unique editor ID
                const editorId = `attachment-editor-${attachmentId}-${Date.now()}`;
                editorRef.current.id = editorId;

                const config = {
                    document: {
                        fileType: ext,
                        key: `attachment-${attachmentId}-${Date.now()}`,
                        title: fileName,
                        url: data.url,
                        permissions: {
                            download: true,
                            edit: false,
                            print: true,
                            review: false
                        }
                    },
                    documentType,
                    editorConfig: {
                        mode: 'view',
                        lang: 'vi',
                        callbackUrl: '',
                        customization: {
                            forcesave: false,
                            autosave: false,
                            compactHeader: isMobile,
                            toolbarNoTabs: isMobile
                        }
                    },
                    width: '100%',
                    height: '100%',
                    type: isMobile ? 'mobile' : 'desktop',
                    events: {
                        onDocumentReady: () => {
                            setLoading(false);
                        },
                        onError: (event: { data: string }) => {
                            console.error('OnlyOffice error:', event);
                            setError('Lỗi khi tải tài liệu');
                            setLoading(false);
                        }
                    }
                };

                editorInstanceRef.current = new window.DocsAPI.DocEditor(editorId, config);
            } catch (err) {
                console.error('Error initializing OnlyOffice:', err);
                setError(err instanceof Error ? err.message : 'Lỗi không xác định');
                setLoading(false);
            }
        };

        initEditor();

        return () => {
            if (editorInstanceRef.current && typeof (editorInstanceRef.current as any).destroyEditor === 'function') {
                try {
                    (editorInstanceRef.current as any).destroyEditor();
                } catch (e) {
                    console.warn('Error destroying editor:', e);
                }
            }
        };
    }, [attachmentId, fileName, token]);

    return (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
            {/* Close button - floating on top right */}
            <button
                onClick={onClose}
                className="absolute top-2 right-2 z-[10000] p-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg transition-colors shadow-lg"
                title="Đóng (ESC)"
            >
                <X size={20} />
            </button>

            {/* Content Area */}
            <div className="flex-1 relative flex items-center justify-center bg-black/90">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                        <div className="text-center">
                            <Loader2 size={48} className="animate-spin text-blue-500 mx-auto mb-4" />
                            <p className="text-gray-300 font-medium">Đang tải tài liệu...</p>
                            <p className="text-gray-500 text-sm mt-1">{fileName}</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                        <div className="text-center p-6 max-w-md">
                            <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                            <p className="text-red-400 font-medium mb-2">{error}</p>
                            <button
                                onClick={onClose}
                                className="mt-4 px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                )}

                {imageUrl ? (
                    <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                        <img
                            src={imageUrl}
                            alt={fileName}
                            className="max-w-full max-h-full object-contain rounded shadow-lg"
                        />
                    </div>
                ) : (
                    <div
                        ref={editorRef}
                        className="w-full h-full bg-white"
                        style={{ minHeight: '100vh', display: loading || error ? 'none' : 'block' }}
                    />
                )}
            </div>
        </div>
    );
};

export default ProjectAttachmentViewer;
