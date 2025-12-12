import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../components/ui/Dialog';
import { API_URL } from '../config/api';
import {
    FolderPlus,
    Upload,
    Folder,
    FileText,
    Image as ImageIcon,
    File,
    MoreVertical,
    Trash2,
    Download,
    Eye,
    ChevronRight,
    Home,
    ArrowLeft,
    X,
    Loader2,
    Edit2,
    FileSpreadsheet,
    Presentation,
    Grid3X3,
    List,
    Clock
} from 'lucide-react';

interface UserFolder {
    id: number;
    name: string;
    minioPath: string;
    parentId: number | null;
    createdAt: string;
}

interface UserFile {
    id: number;
    name: string;
    minioPath: string;
    fileType: string;
    fileSize: number;
    folderId: number | null;
    createdAt: string;
}

interface Breadcrumb {
    id: number;
    name: string;
}

type ViewMode = 'grid' | 'list';

// Office file extensions
const officeExtensions = [
    'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'fodt', 'ott', 'rtf', 'txt',
    'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'ods', 'fods', 'ots', 'csv',
    'ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'odp', 'fodp', 'otp',
    'pdf', 'mht', 'html', 'htm'
];

// Image extensions
const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];

const isOfficeFile = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return officeExtensions.includes(ext);
};

const isImageFile = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return imageExtensions.includes(ext);
};

const getFileIcon = (fileName: string, size: 'sm' | 'lg' = 'lg') => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const sizeClass = size === 'lg' ? 'w-10 h-10' : 'w-5 h-5';

    if (imageExtensions.includes(ext)) {
        return <ImageIcon className={`${sizeClass} text-green-500`} />;
    }

    if (['doc', 'docx', 'docm', 'odt', 'rtf', 'txt'].includes(ext)) {
        return <FileText className={`${sizeClass} text-blue-500`} />;
    }

    if (['xls', 'xlsx', 'xlsm', 'ods', 'csv'].includes(ext)) {
        return <FileSpreadsheet className={`${sizeClass} text-green-600`} />;
    }

    if (['ppt', 'pptx', 'pptm', 'odp'].includes(ext)) {
        return <Presentation className={`${sizeClass} text-orange-500`} />;
    }

    if (ext === 'pdf') {
        return <FileText className={`${sizeClass} text-red-500`} />;
    }

    return <File className={`${sizeClass} text-gray-400`} />;
};

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// OnlyOffice Viewer Component
interface OnlyOfficeViewerProps {
    fileId: number;
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

const OnlyOfficeViewer = ({ fileId, fileName, onClose, token }: OnlyOfficeViewerProps) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const editorInstanceRef = useRef<object | null>(null);

    useEffect(() => {
        const initEditor = async () => {
            try {
                const checkResponse = await fetch(`${API_URL}/folders/files/${fileId}/onlyoffice-check`, {
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

                if (!window.DocsAPI) {
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = `${onlyofficeUrl}/web-apps/apps/api/documents/api.js`;
                        script.async = true;
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error('Không thể tải OnlyOffice'));
                        document.body.appendChild(script);
                    });
                }

                const configResponse = await fetch(`${API_URL}/folders/files/${fileId}/onlyoffice-config`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!configResponse.ok) {
                    throw new Error('Không thể lấy cấu hình OnlyOffice');
                }

                const { config } = await configResponse.json();

                if (editorRef.current && window.DocsAPI) {
                    editorInstanceRef.current = new window.DocsAPI.DocEditor('folder-onlyoffice-editor', config);
                }

                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
                setLoading(false);
            }
        };

        initEditor();

        return () => {
            if (editorInstanceRef.current) {
                editorInstanceRef.current = null;
            }
        };
    }, [fileId, token]);

    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm">
                <div className="flex items-center gap-2">
                    <FileText className="text-blue-600" size={18} />
                    <span className="font-medium text-gray-800">{fileName}</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                    title="Đóng"
                >
                    <X size={20} className="text-gray-600" />
                </button>
            </div>

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
                            <p className="text-red-600">{error}</p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                )}

                <div
                    id="folder-onlyoffice-editor"
                    ref={editorRef}
                    className="w-full h-full"
                    style={{ display: loading || error ? 'none' : 'block' }}
                />
            </div>
        </div>
    );
};

// Image Viewer Component
interface ImageViewerProps {
    imageUrl: string;
    fileName: string;
    onClose: () => void;
}

const ImageViewer = ({ imageUrl, fileName, onClose }: ImageViewerProps) => {
    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-black/50">
                <span className="text-white font-medium">{fileName}</span>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded transition-colors"
                >
                    <X size={24} className="text-white" />
                </button>
            </div>

            <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                <img
                    src={imageUrl}
                    alt={fileName}
                    className="max-w-full max-h-full object-contain"
                />
            </div>
        </div>
    );
};

const UserFolders = () => {
    const { token } = useAuth();
    const dialog = useDialog();
    const [folders, setFolders] = useState<UserFolder[]>([]);
    const [files, setFiles] = useState<UserFile[]>([]);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
    const [currentParentId, setCurrentParentId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [contextMenu, setContextMenu] = useState<{
        type: 'folder' | 'file';
        id: number;
        name: string;
        x: number;
        y: number;
    } | null>(null);
    const [viewingImage, setViewingImage] = useState<{ url: string; name: string } | null>(null);
    const [viewingOffice, setViewingOffice] = useState<{ id: number; name: string } | null>(null);
    const [renameDialog, setRenameDialog] = useState<{
        type: 'folder' | 'file';
        id: number;
        name: string;
    } | null>(null);
    const [newName, setNewName] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const url = currentParentId
                ? `${API_URL}/folders?parentId=${currentParentId}`
                : `${API_URL}/folders`;

            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch');

            const data = await response.json();
            setFolders(data.folders);
            setFiles(data.files);
            setBreadcrumbs(data.breadcrumbs);
        } catch (error) {
            console.error('Error fetching folders:', error);
        } finally {
            setLoading(false);
        }
    }, [token, currentParentId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        try {
            const response = await fetch(`${API_URL}/folders/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: newFolderName.trim(),
                    parentId: currentParentId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create folder');
            }

            setNewFolderName('');
            setShowCreateFolder(false);
            dialog.showSuccess('Đã tạo thư mục thành công!', { title: 'Thành công' });
            fetchData();
        } catch (error: any) {
            dialog.showError(error.message || 'Lỗi khi tạo thư mục', { title: 'Lỗi' });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        setUploading(true);

        try {
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                const formData = new FormData();
                formData.append('file', file);
                if (currentParentId) {
                    formData.append('folderId', String(currentParentId));
                }

                const response = await fetch(`${API_URL}/folders/upload`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to upload file');
                }
            }

            dialog.showSuccess(`Đã upload ${selectedFiles.length} file thành công!`, { title: 'Thành công' });
            fetchData();
        } catch (error: any) {
            dialog.showError(error.message || 'Lỗi khi upload file', { title: 'Lỗi' });
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDeleteFolder = async (folderId: number, folderName: string) => {
        const confirmed = await dialog.showConfirm(
            `Bạn có chắc muốn xóa thư mục "${folderName}"? Tất cả file và thư mục con sẽ bị xóa vĩnh viễn.`,
            { title: 'Xác nhận xóa thư mục', confirmText: 'Xóa', cancelText: 'Hủy' }
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/folders/folders/${folderId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to delete folder');

            dialog.showSuccess('Đã xóa thư mục thành công!', { title: 'Thành công' });
            fetchData();
        } catch (error) {
            dialog.showError('Lỗi khi xóa thư mục', { title: 'Lỗi' });
        }
    };

    const handleDeleteFile = async (fileId: number, fileName: string) => {
        const confirmed = await dialog.showConfirm(
            `Bạn có chắc muốn xóa file "${fileName}"?`,
            { title: 'Xác nhận xóa file', confirmText: 'Xóa', cancelText: 'Hủy' }
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/folders/files/${fileId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to delete file');

            dialog.showSuccess('Đã xóa file thành công!', { title: 'Thành công' });
            fetchData();
        } catch (error) {
            dialog.showError('Lỗi khi xóa file', { title: 'Lỗi' });
        }
    };

    const handleDownloadFile = async (fileId: number, fileName: string) => {
        try {
            const response = await fetch(`${API_URL}/folders/files/${fileId}/url`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to get download URL');

            const { url } = await response.json();

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            dialog.showError('Lỗi khi tải file', { title: 'Lỗi' });
        }
    };

    const handleViewFile = async (file: UserFile) => {
        if (isImageFile(file.name)) {
            try {
                const response = await fetch(`${API_URL}/folders/files/${file.id}/url`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!response.ok) throw new Error('Failed to get file URL');

                const { url } = await response.json();
                setViewingImage({ url, name: file.name });
            } catch (error) {
                dialog.showError('Lỗi khi mở ảnh', { title: 'Lỗi' });
            }
        } else if (isOfficeFile(file.name)) {
            setViewingOffice({ id: file.id, name: file.name });
        } else {
            handleDownloadFile(file.id, file.name);
        }
    };

    const handleRename = async () => {
        if (!renameDialog || !newName.trim()) return;

        try {
            const endpoint = renameDialog.type === 'folder'
                ? `${API_URL}/folders/folders/${renameDialog.id}/rename`
                : `${API_URL}/folders/files/${renameDialog.id}/rename`;

            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name: newName.trim() })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to rename');
            }

            setRenameDialog(null);
            setNewName('');
            dialog.showSuccess('Đã đổi tên thành công!', { title: 'Thành công' });
            fetchData();
        } catch (error: any) {
            dialog.showError(error.message || 'Lỗi khi đổi tên', { title: 'Lỗi' });
        }
    };

    const handleContextMenu = (
        e: React.MouseEvent,
        type: 'folder' | 'file',
        id: number,
        name: string
    ) => {
        e.preventDefault();
        e.stopPropagation();

        // Calculate position to avoid menu going off-screen
        const menuWidth = 180;
        const menuHeight = type === 'file' ? 180 : 100;

        let x = e.clientX;
        let y = e.clientY;

        // Check right edge
        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 10;
        }

        // Check bottom edge
        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight - 10;
        }

        setContextMenu({ type, id, name, x, y });
    };

    const navigateToFolder = (folderId: number | null) => {
        setCurrentParentId(folderId);
    };

    const navigateToRoot = () => {
        setCurrentParentId(null);
    };

    const navigateBack = () => {
        if (breadcrumbs.length > 1) {
            const parentBreadcrumb = breadcrumbs[breadcrumbs.length - 2];
            setCurrentParentId(parentBreadcrumb.id);
        } else {
            setCurrentParentId(null);
        }
    };

    // Grid View Item for Folder
    const FolderGridItem = ({ folder }: { folder: UserFolder }) => (
        <div
            className="group relative bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
            onClick={() => navigateToFolder(folder.id)}
            onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id, folder.name)}
        >
            <div className="flex flex-col items-center">
                <Folder className="w-16 h-16 text-yellow-500 mb-2" />
                <span className="text-sm font-medium text-gray-700 text-center line-clamp-2">
                    {folder.name}
                </span>
                <span className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock size={10} />
                    {formatDate(folder.createdAt)}
                </span>
            </div>

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, 'folder', folder.id, folder.name);
                }}
                className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 rounded transition-all"
            >
                <MoreVertical size={16} className="text-gray-500" />
            </button>
        </div>
    );

    // Grid View Item for File
    const FileGridItem = ({ file }: { file: UserFile }) => (
        <div
            className="group relative bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
            onDoubleClick={() => handleViewFile(file)}
            onContextMenu={(e) => handleContextMenu(e, 'file', file.id, file.name)}
        >
            <div className="flex flex-col items-center">
                {getFileIcon(file.name)}
                <span className="mt-2 text-sm font-medium text-gray-700 text-center line-clamp-2">
                    {file.name}
                </span>
                <span className="text-xs text-gray-400 mt-1">
                    {formatFileSize(file.fileSize)}
                </span>
                <span className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Clock size={10} />
                    {formatDate(file.createdAt)}
                </span>
            </div>

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, 'file', file.id, file.name);
                }}
                className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 rounded transition-all"
            >
                <MoreVertical size={16} className="text-gray-500" />
            </button>
        </div>
    );

    // List View Item for Folder
    const FolderListItem = ({ folder }: { folder: UserFolder }) => (
        <div
            className="group flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
            onClick={() => navigateToFolder(folder.id)}
            onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id, folder.name)}
        >
            <Folder className="w-8 h-8 text-yellow-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-700 block truncate">
                    {folder.name}
                </span>
                <span className="text-xs text-gray-400">Thư mục</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                <Clock size={12} />
                {formatDate(folder.createdAt)}
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, 'folder', folder.id, folder.name);
                }}
                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 rounded transition-all"
            >
                <MoreVertical size={16} className="text-gray-500" />
            </button>
        </div>
    );

    // List View Item for File
    const FileListItem = ({ file }: { file: UserFile }) => (
        <div
            className="group flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
            onDoubleClick={() => handleViewFile(file)}
            onContextMenu={(e) => handleContextMenu(e, 'file', file.id, file.name)}
        >
            {getFileIcon(file.name, 'sm')}
            <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-700 block truncate">
                    {file.name}
                </span>
                <span className="text-xs text-gray-400">{formatFileSize(file.fileSize)}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                <Clock size={12} />
                {formatDate(file.createdAt)}
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, 'file', file.id, file.name);
                }}
                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 rounded transition-all"
            >
                <MoreVertical size={16} className="text-gray-500" />
            </button>
        </div>
    );

    return (
        <div className="p-4 lg:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                    Thư mục của tôi
                </h1>
                <p className="text-gray-600">
                    Quản lý và lưu trữ các file của bạn
                </p>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowCreateFolder(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <FolderPlus size={20} />
                        <span>Tạo thư mục</span>
                    </button>

                    <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
                        <Upload size={20} />
                        <span>{uploading ? 'Đang upload...' : 'Tải file lên'}</span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                    </label>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-md transition-colors ${viewMode === 'grid'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                        title="Xem dạng lưới"
                    >
                        <Grid3X3 size={18} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-md transition-colors ${viewMode === 'list'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                        title="Xem dạng danh sách"
                    >
                        <List size={18} />
                    </button>
                </div>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-6 p-3 bg-gray-50 rounded-lg overflow-x-auto">
                <button
                    onClick={navigateToRoot}
                    className="flex items-center gap-1 text-gray-600 hover:text-blue-600 whitespace-nowrap"
                >
                    <Home size={18} />
                    <span>Thư mục gốc</span>
                </button>

                {breadcrumbs.map((crumb, index) => (
                    <div key={crumb.id} className="flex items-center gap-2">
                        <ChevronRight size={16} className="text-gray-400" />
                        <button
                            onClick={() => navigateToFolder(crumb.id)}
                            className={`whitespace-nowrap ${index === breadcrumbs.length - 1
                                ? 'text-blue-600 font-medium'
                                : 'text-gray-600 hover:text-blue-600'
                                }`}
                        >
                            {crumb.name}
                        </button>
                    </div>
                ))}
            </div>

            {/* Back button */}
            {currentParentId && (
                <button
                    onClick={navigateBack}
                    className="flex items-center gap-2 mb-4 text-gray-600 hover:text-blue-600"
                >
                    <ArrowLeft size={20} />
                    <span>Quay lại</span>
                </button>
            )}

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {folders.map((folder) => (
                        <FolderGridItem key={`folder-${folder.id}`} folder={folder} />
                    ))}
                    {files.map((file) => (
                        <FileGridItem key={`file-${file.id}`} file={file} />
                    ))}

                    {folders.length === 0 && files.length === 0 && (
                        <div className="col-span-full text-center py-20 text-gray-500">
                            <Folder className="w-20 h-20 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg">Thư mục trống</p>
                            <p className="text-sm mt-2">Tạo thư mục mới hoặc tải file lên để bắt đầu</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {folders.map((folder) => (
                        <FolderListItem key={`folder-${folder.id}`} folder={folder} />
                    ))}
                    {files.map((file) => (
                        <FileListItem key={`file-${file.id}`} file={file} />
                    ))}

                    {folders.length === 0 && files.length === 0 && (
                        <div className="text-center py-20 text-gray-500">
                            <Folder className="w-20 h-20 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg">Thư mục trống</p>
                            <p className="text-sm mt-2">Tạo thư mục mới hoặc tải file lên để bắt đầu</p>
                        </div>
                    )}
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 min-w-[160px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.type === 'file' && (
                        <>
                            <button
                                onClick={() => {
                                    const file = files.find(f => f.id === contextMenu.id);
                                    if (file) handleViewFile(file);
                                    setContextMenu(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-gray-100"
                            >
                                <Eye size={16} />
                                <span>Xem</span>
                            </button>
                            <button
                                onClick={() => {
                                    handleDownloadFile(contextMenu.id, contextMenu.name);
                                    setContextMenu(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-gray-100"
                            >
                                <Download size={16} />
                                <span>Tải xuống</span>
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => {
                            setRenameDialog({
                                type: contextMenu.type,
                                id: contextMenu.id,
                                name: contextMenu.name
                            });
                            setNewName(contextMenu.name);
                            setContextMenu(null);
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-gray-100"
                    >
                        <Edit2 size={16} />
                        <span>Đổi tên</span>
                    </button>

                    <button
                        onClick={() => {
                            if (contextMenu.type === 'folder') {
                                handleDeleteFolder(contextMenu.id, contextMenu.name);
                            } else {
                                handleDeleteFile(contextMenu.id, contextMenu.name);
                            }
                            setContextMenu(null);
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-left text-red-600 hover:bg-red-50"
                    >
                        <Trash2 size={16} />
                        <span>Xóa</span>
                    </button>
                </div>
            )}

            {/* Create Folder Dialog */}
            {showCreateFolder && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-blue-100 rounded-full">
                                <FolderPlus className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Tạo thư mục mới</h3>
                        </div>
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Nhập tên thư mục"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateFolder();
                                if (e.key === 'Escape') setShowCreateFolder(false);
                            }}
                        />
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateFolder(false)}
                                className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleCreateFolder}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                            >
                                Tạo thư mục
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Dialog */}
            {renameDialog && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-amber-100 rounded-full">
                                <Edit2 className="w-6 h-6 text-amber-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                Đổi tên {renameDialog.type === 'folder' ? 'thư mục' : 'file'}
                            </h3>
                        </div>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Nhập tên mới"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename();
                                if (e.key === 'Escape') setRenameDialog(null);
                            }}
                        />
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setRenameDialog(null)}
                                className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleRename}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                            >
                                Đổi tên
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Viewer */}
            {viewingImage && (
                <ImageViewer
                    imageUrl={viewingImage.url}
                    fileName={viewingImage.name}
                    onClose={() => setViewingImage(null)}
                />
            )}

            {/* OnlyOffice Viewer */}
            {viewingOffice && (
                <OnlyOfficeViewer
                    fileId={viewingOffice.id}
                    fileName={viewingOffice.name}
                    onClose={() => setViewingOffice(null)}
                    token={token || ''}
                />
            )}
        </div>
    );
};

export default UserFolders;
