import { useEffect, useRef, useState } from 'react';
import { X, Loader2, FileText, AlertCircle } from 'lucide-react';
import { API_URL } from '../config/api';

interface OnlyOfficeViewerProps {
    projectId: number;
    onClose: () => void;
    token: string;
}

declare global {
    interface Window {
        DocsAPI?: {
            DocEditor: new (elementId: string, config: object) => object;
        };
    }
}

export const OnlyOfficeViewer = ({ projectId, onClose, token }: OnlyOfficeViewerProps) => {
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
                const checkResponse = await fetch(`${API_URL}/onlyoffice/check/${projectId}`, {
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

                // Check if script already loaded
                if (window.DocsAPI) {
                    setScriptLoaded(true);
                    return;
                }

                // Load OnlyOffice script
                const script = document.createElement('script');
                script.src = `${onlyofficeUrl}/web-apps/apps/api/documents/api.js`;
                script.async = true;
                script.onload = () => {
                    setScriptLoaded(true);
                };
                script.onerror = () => {
                    setError('Không thể tải OnlyOffice. Vui lòng kiểm tra kết nối mạng.');
                    setLoading(false);
                };
                document.body.appendChild(script);
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
    }, [projectId, token]);

    // Initialize editor when script is loaded
    useEffect(() => {
        if (!scriptLoaded || !window.DocsAPI) return;

        const initEditor = async () => {
            try {
                // Get OnlyOffice configuration from backend
                const response = await fetch(`${API_URL}/onlyoffice/config/${projectId}`, {
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
                    token: data.token,
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
    }, [scriptLoaded, projectId, token]);

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-white border-b shadow-sm">
                <div className="flex items-center gap-2">
                    <FileText className="text-blue-600" size={12} />
                    <span className="font-medium text-gray-800 text-sm">Xem tài liệu</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Đóng"
                >
                    <X size={15} className="text-gray-600" />
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
                    id="onlyoffice-editor" 
                    ref={editorRef}
                    className="w-full h-full"
                    style={{ display: loading || error ? 'none' : 'block' }}
                />
            </div>
        </div>
    );
};

export default OnlyOfficeViewer;
