import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../components/ui/Dialog';
import { API_URL } from '../config/api';
import { GoogleDriveBrowser } from '../components/GoogleDrive/GoogleDriveBrowser';
import { GoogleDriveIcon } from '../components/ui/AttachmentPicker';
import {
    FolderPlus,
    Upload,
    Folder,
    FileText,
    Image as ImageIcon,
    File as FileIcon,
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
    Clock,
    Search,
    User,
    Check,
    Plus,
    Move
} from 'lucide-react';

interface UserFolder {
    id: number;
    name: string;
    minioPath: string;
    parentId: number | null;
    createdAt: string;
    userId: number;
    permission?: 'VIEW' | 'EDIT';
    ownerName?: string;
}

interface UserFile {
    id: number;
    name: string;
    minioPath: string;
    fileType: string;
    fileSize: number;
    folderId: number | null;
    createdAt: string;
    userId: number;
    permission?: 'VIEW' | 'EDIT';
    ownerName?: string;
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

const getFileIcon = (fileName: string, size: 'xs' | 'sm' | 'lg' = 'lg') => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const sizeClass = size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-5 h-5' : 'w-4 h-4';

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

    return <FileIcon className={`${sizeClass} text-gray-400`} />;
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

// Share Dialog Component
interface ShareDialogProps {
    type: 'folder' | 'file';
    id: number;
    name: string;
    onClose: () => void;
    token: string;
}

const ShareDialog = ({ type, id, name, onClose, token }: ShareDialogProps) => {
    const [query, setQuery] = useState('');
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [permission, setPermission] = useState<'VIEW' | 'EDIT'>('VIEW');
    const [loading, setLoading] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const dialog = useDialog();

    // Load all users on mount
    useEffect(() => {
        const fetchAllUsers = async () => {
            setLoadingUsers(true);
            try {
                const res = await fetch(`${API_URL}/users`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    setAllUsers(await res.json());
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingUsers(false);
            }
        };
        fetchAllUsers();
    }, [token]);

    // Filter users based on search query
    const filteredUsers = allUsers.filter(u => {
        if (!query.trim()) return true;
        const searchLower = query.toLowerCase();
        return (
            u.name?.toLowerCase().includes(searchLower) ||
            u.username?.toLowerCase().includes(searchLower) ||
            u.email?.toLowerCase().includes(searchLower)
        );
    });

    const handleShare = async () => {
        if (selectedUsers.length === 0) return;
        setLoading(true);
        try {
            const endpoint = type === 'folder' ? `/folders/${id}/share` : `/folders/files/${id}/share`;
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    userIds: selectedUsers,
                    permission
                })
            });

            if (!res.ok) throw new Error();

            dialog.showSuccess('Đã chia sẻ thành công!');
            onClose();
        } catch (e) {
            dialog.showError('Lỗi khi chia sẻ');
        } finally {
            setLoading(false);
        }
    };

    const toggleUser = (userId: number) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-semibold">Chia sẻ "{name}"</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 flex flex-col gap-4 flex-1 overflow-hidden">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm người dùng (tên, email)..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Permissions */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPermission('VIEW')}
                            className={`flex-1 py-2 rounded-lg border ${permission === 'VIEW' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-50'}`}
                        >
                            Chỉ xem
                        </button>
                        <button
                            onClick={() => setPermission('EDIT')}
                            className={`flex-1 py-2 rounded-lg border ${permission === 'EDIT' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-50'}`}
                        >
                            Cho phép sửa
                        </button>
                    </div>

                    {/* User List */}
                    <div className="flex-1 overflow-y-auto border rounded-lg divide-y min-h-[200px]">
                        {loadingUsers ? (
                            <div className="p-4 text-center text-gray-500 flex items-center justify-center gap-2">
                                <Loader2 size={18} className="animate-spin" />
                                Đang tải danh sách...
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                {query ? 'Không tìm thấy kết quả' : 'Không có người dùng nào'}
                            </div>
                        ) : (
                            filteredUsers.map(u => (
                                <div
                                    key={u.id}
                                    onClick={() => toggleUser(u.id)}
                                    className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors ${selectedUsers.includes(u.id) ? 'bg-blue-50' : ''
                                        }`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                                        {u.avatar ? <img src={`${API_URL}/users/${u.id}/avatar`} className="w-8 h-8 rounded-full object-cover" alt={u.name} /> : (u.name?.[0] || 'U')}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium">{u.name}</div>
                                        <div className="text-xs text-gray-500">{u.username}</div>
                                    </div>
                                    {selectedUsers.includes(u.id) && <Check size={18} className="text-blue-600" />}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Selected count */}
                    {selectedUsers.length > 0 && (
                        <div className="text-sm text-gray-600">
                            Đã chọn: <span className="font-medium text-blue-600">{selectedUsers.length} người dùng</span>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                        Hủy
                    </button>
                    <button
                        onClick={handleShare}
                        disabled={loading || selectedUsers.length === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        Chia sẻ
                    </button>
                </div>
            </div>
        </div>
    );
};

// Move Dialog Component
interface MoveDialogProps {
    type: 'folder' | 'file';
    id: number;
    name: string;
    currentFolderId: number | null;
    onClose: () => void;
    onSuccess: () => void;
    token: string;
}

const MoveDialog = ({ type, id, name, currentFolderId, onClose, onSuccess, token }: MoveDialogProps) => {
    const [folders, setFolders] = useState<UserFolder[]>([]);
    const [targetFolderId, setTargetFolderId] = useState<number | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
    const [loading, setLoading] = useState(true);
    const [moving, setMoving] = useState(false);
    const dialog = useDialog();

    const fetchFolders = useCallback(async (parentId: number | null) => {
        setLoading(true);
        try {
            const url = parentId
                ? `${API_URL}/folders?parentId=${parentId}`
                : `${API_URL}/folders`;

            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                // Filter out the folder being moved (for folder type)
                let filteredFolders = data.folders.filter((f: UserFolder) => f.id > 0);
                if (type === 'folder') {
                    filteredFolders = filteredFolders.filter((f: UserFolder) => f.id !== id);
                }
                setFolders(filteredFolders);
                setBreadcrumbs(data.breadcrumbs || []);
            }
        } catch (error) {
            console.error('Error fetching folders:', error);
        } finally {
            setLoading(false);
        }
    }, [token, type, id]);

    useEffect(() => {
        fetchFolders(targetFolderId);
    }, [fetchFolders, targetFolderId]);

    const handleMove = async () => {
        // Can't move to same location
        if (targetFolderId === currentFolderId) {
            dialog.showError('Đây là vị trí hiện tại');
            return;
        }

        setMoving(true);
        try {
            const endpoint = type === 'folder'
                ? `${API_URL}/folders/folders/${id}/move`
                : `${API_URL}/folders/files/${id}/move`;

            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ targetFolderId })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to move');
            }

            dialog.showSuccess('Đã di chuyển thành công!');
            onSuccess();
            onClose();
        } catch (error: any) {
            dialog.showError(error.message || 'Lỗi khi di chuyển');
        } finally {
            setMoving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-semibold">Di chuyển "{name}"</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 p-3 bg-gray-50 border-b overflow-x-auto">
                        <button
                            onClick={() => setTargetFolderId(null)}
                            className={`flex items-center gap-1 whitespace-nowrap ${targetFolderId === null ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-blue-600'}`}
                        >
                            <Home size={16} />
                            <span>Thư mục gốc</span>
                        </button>
                        {breadcrumbs.map(crumb => (
                            <div key={crumb.id} className="flex items-center gap-1">
                                <ChevronRight size={14} className="text-gray-400" />
                                <button
                                    onClick={() => setTargetFolderId(crumb.id)}
                                    className={`whitespace-nowrap ${targetFolderId === crumb.id ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-blue-600'}`}
                                >
                                    {crumb.name}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Folder List */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            </div>
                        ) : folders.length === 0 ? (
                            <div className="text-center py-10 text-gray-500">
                                <Folder className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                <p>Không có thư mục con</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {folders.map(folder => (
                                    <div
                                        key={folder.id}
                                        onClick={() => setTargetFolderId(folder.id)}
                                        className="flex flex-col items-center p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
                                    >
                                        <Folder className="w-10 h-10 text-yellow-500 mb-2" />
                                        <span className="text-sm text-center line-clamp-2">{folder.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t bg-gray-50">
                        <div className="text-sm text-gray-600 mb-3">
                            Vị trí đích: <span className="font-medium text-blue-600">
                                {targetFolderId === null ? 'Thư mục gốc' : breadcrumbs.find(b => b.id === targetFolderId)?.name || 'Thư mục đã chọn'}
                            </span>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                disabled={moving}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleMove}
                                disabled={moving || targetFolderId === currentFolderId}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {moving && <Loader2 size={16} className="animate-spin" />}
                                <Move size={16} />
                                Di chuyển đến đây
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

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

// Save As Dialog Component
interface SaveAsDialogProps {
    onClose: () => void;
    onSave: (folderId: number | null, name: string) => Promise<void>;
    token: string;
    originalFileName?: string;
    targetFormat?: string; // Format selected from OnlyOffice Save Copy As menu
}

const SaveAsDialog = ({ onClose, onSave, token, originalFileName, targetFormat }: SaveAsDialogProps) => {
    const [folders, setFolders] = useState<UserFolder[]>([]);
    const [currentParentId, setCurrentParentId] = useState<number | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
    const [loading, setLoading] = useState(true);
    const [fileName, setFileName] = useState('');
    const [saving, setSaving] = useState(false);
    const [format, setFormat] = useState<string>('');

    // Determine available formats based on original extension
    const originalExt = originalFileName?.split('.').pop()?.toLowerCase() || '';

    const getAvailableFormats = (ext: string) => {
        const formats = [ext]; // Original is always available

        const documentFormats = ['docx', 'pdf', 'txt', 'rtf', 'odt'];
        const spreadsheetFormats = ['xlsx', 'pdf', 'csv', 'ods'];
        const presentationFormats = ['pptx', 'pdf', 'odp'];

        if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(ext)) {
            return documentFormats;
        }
        if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) {
            return spreadsheetFormats;
        }
        if (['ppt', 'pptx', 'odp'].includes(ext)) {
            return presentationFormats;
        }

        // Always offer PDF if not already added
        if (!formats.includes('pdf')) formats.push('pdf');

        return [...new Set(formats)];
    };

    const availableFormats = getAvailableFormats(originalExt);

    useEffect(() => {
        if (originalFileName) {
            // Remove extension for initial name display
            setFileName(originalFileName.replace(/\.[^/.]+$/, ""));
            // Use targetFormat if provided (from OnlyOffice menu selection), otherwise use original extension
            setFormat(targetFormat || originalExt);
        }
    }, [originalFileName, originalExt, targetFormat]);

    const fetchFolders = useCallback(async (parentId: number | null) => {
        try {
            setLoading(true);
            const url = parentId
                ? `${API_URL}/folders?parentId=${parentId}`
                : `${API_URL}/folders`;

            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setFolders(data.folders);
                setBreadcrumbs(data.breadcrumbs);
            }
        } catch (error) {
            console.error('Error fetching folders:', error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchFolders(currentParentId);
    }, [fetchFolders, currentParentId]);

    const handleSave = async () => {
        if (!fileName.trim()) return;
        setSaving(true);
        try {
            // Append selected format
            const finalName = `${fileName.trim()}.${format}`;
            await onSave(currentParentId, finalName);
            onClose();
        } catch (error) {
            console.error('Error saving file:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-semibold">Lưu bản sao</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 p-3 bg-gray-50 border-b overflow-x-auto">
                        <button
                            onClick={() => setCurrentParentId(null)}
                            className="flex items-center gap-1 text-gray-600 hover:text-blue-600 whitespace-nowrap"
                        >
                            <Home size={16} />
                            <span>Thư mục gốc</span>
                        </button>
                        {breadcrumbs.map(crumb => (
                            <div key={crumb.id} className="flex items-center gap-1">
                                <ChevronRight size={14} className="text-gray-400" />
                                <button
                                    onClick={() => setCurrentParentId(crumb.id)}
                                    className="text-gray-600 hover:text-blue-600 whitespace-nowrap"
                                >
                                    {crumb.name}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Folder List */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            </div>
                        ) : folders.length === 0 ? (
                            <div className="text-center py-10 text-gray-500">
                                <Folder className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                <p>Không có thư mục con</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {folders.map(folder => (
                                    <div
                                        key={folder.id}
                                        onClick={() => setCurrentParentId(folder.id)}
                                        className="flex flex-col items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <Folder className="w-10 h-10 text-yellow-500 mb-2" />
                                        <span className="text-sm text-center line-clamp-2">{folder.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t flex flex-col gap-4">
                        <div className="flex gap-4">
                            <div className="flex-1 flex flex-col gap-1">
                                <label className="text-sm font-medium text-gray-700">Tên file mới</label>
                                <input
                                    type="text"
                                    value={fileName}
                                    onChange={(e) => setFileName(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Nhập tên file..."
                                />
                            </div>
                            <div className="w-32 flex flex-col gap-1">
                                <label className="text-sm font-medium text-gray-700">Định dạng</label>
                                <select
                                    value={format}
                                    onChange={(e) => setFormat(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {availableFormats.map(fmt => (
                                        <option key={fmt} value={fmt}>.{fmt}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                disabled={saving}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!fileName.trim() || saving}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving && <Loader2 size={16} className="animate-spin" />}
                                Lưu
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const OnlyOfficeViewer = ({ fileId, fileName, onClose, token }: OnlyOfficeViewerProps) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const editorInstanceRef = useRef<any>(null); // Use any to access OnlyOffice methods
    const [showSaveAs, setShowSaveAs] = useState(false);
    const [saveAsFormat, setSaveAsFormat] = useState<string | undefined>(undefined);
    const dialog = useDialog();

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

                // Inject saveAs handler - OnlyOffice passes event data with fileType
                config.events = {
                    ...config.events,
                    onRequestSaveAs: (event: any) => {
                        // event.data contains: { fileType: 'pdf', title: 'filename.pdf', url: '...' }
                        const targetFileType = event?.data?.fileType?.toLowerCase();
                        console.log('[OnlyOffice] onRequestSaveAs event:', event?.data);
                        setSaveAsFormat(targetFileType);
                        setShowSaveAs(true);
                    }
                };

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
                    title="Đóng (ESC)"
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

            {showSaveAs && (
                <SaveAsDialog
                    onClose={() => {
                        setShowSaveAs(false);
                        setSaveAsFormat(undefined); // Reset format when closing
                    }}
                    token={token}
                    originalFileName={fileName}
                    targetFormat={saveAsFormat}
                    onSave={async (folderId, name) => {
                        // For MVP: We assume the user has saved or autosave is working (we enabled forceSave).
                        // We will copy the file on the backend.
                        // We need `saveFileFromUrl` to support `sourceFileId` or use `getFileUrl` here.

                        // Let's fetch the current file URL (presigned) from backend, then send it to `saveFileFromUrl`.
                        // This effectively copies the file.

                        try {
                            const urlRes = await fetch(`${API_URL}/folders/files/${fileId}/url`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            const { url } = await urlRes.json();

                            // Determine source type from filename
                            const sourceFileType = fileName.split('.').pop()?.toLowerCase();

                            const saveRes = await fetch(`${API_URL}/folders/files/save-from-url`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    url,
                                    name,
                                    folderId,
                                    sourceFileType,
                                    sourceFileId: fileId
                                })
                            });

                            if (!saveRes.ok) {
                                const errData = await saveRes.json();
                                throw new Error(errData.message || 'Failed to save copy');
                            }

                            dialog.showSuccess('Đã lưu bản sao thành công');
                        } catch (e: any) {
                            dialog.showError(e.message || 'Lỗi khi lưu bản sao');
                            throw e;
                        }
                    }}
                />
            )}
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
    // Cleanup blob URL when component unmounts
    useEffect(() => {
        return () => {
            if (imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [imageUrl]);

    const handleClose = () => {
        if (imageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(imageUrl);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-black/50">
                <span className="text-white font-medium">{fileName}</span>
                <button
                    onClick={handleClose}
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
    const { token, user } = useAuth();
    const dialog = useDialog();
    const SHARED_FOLDER_ID = -999;
    const [folders, setFolders] = useState<UserFolder[]>([]);
    const [files, setFiles] = useState<UserFile[]>([]);
    const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
    const [currentParentId, setCurrentParentId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{
        currentFile: string;
        currentIndex: number;
        totalFiles: number;
        percentage: number;
    } | null>(null);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [createFileDialog, setCreateFileDialog] = useState<{
        open: boolean;
        type: 'word' | 'excel' | 'powerpoint';
        ext: string;
        mime: string;
    } | null>(null);
    const [newFileNameInput, setNewFileNameInput] = useState('');
    const [newFolderName, setNewFolderName] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [contextMenu, setContextMenu] = useState<{
        type: 'folder' | 'file';
        id: number;
        name: string;
        userId?: number; // Add userId to check ownership
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
    const [shareDialog, setShareDialog] = useState<{
        type: 'folder' | 'file';
        id: number;
        name: string;
    } | null>(null);
    const [newName, setNewName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [showActionDropdown, setShowActionDropdown] = useState(false);
    const [showDriveBrowser, setShowDriveBrowser] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedItems, setSelectedItems] = useState<{ folders: number[]; files: number[] }>({ folders: [], files: [] });
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [moveDialog, setMoveDialog] = useState<{
        type: 'folder' | 'file';
        id: number;
        name: string;
    } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const dragCounter = useRef(0);
    const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1024MB

    // Search results from API (deep search)
    const [searchResults, setSearchResults] = useState<{
        folders: (UserFolder & { path?: string })[];
        files: (UserFile & { path?: string })[];
    }>({ folders: [], files: [] });
    const [searchLoading, setSearchLoading] = useState(false);

    // Reset view when navigating to shared folder root logic handled in fetchData but we might want to clear breadcrumbs in other cases?
    // Actually we don't need the activeTab effect anymore.


    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            let url = '';

            if (currentParentId === SHARED_FOLDER_ID) {
                url = `${API_URL}/folders/shared`;
            } else {
                url = currentParentId
                    ? `${API_URL}/folders?parentId=${currentParentId}`
                    : `${API_URL}/folders`;
            }

            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch');

            const data = await response.json();

            if (currentParentId === SHARED_FOLDER_ID) {
                setFolders(data.folders);
                setFiles(data.files);
                setBreadcrumbs([{ id: SHARED_FOLDER_ID, name: 'Được chia sẻ' }]);
            } else {
                let fetchedFolders = data.folders;
                // Add virtual folders at root: Shared and Google Drive
                if (!currentParentId) {
                    fetchedFolders = [
                        {
                            id: SHARED_FOLDER_ID,
                            name: 'Được chia sẻ',
                            minioPath: '',
                            parentId: null,
                            createdAt: new Date().toISOString(),
                            userId: -1 // System/Virtual ID
                        },
                        {
                            id: -998, // Google Drive virtual ID
                            name: 'Google Drive',
                            minioPath: '',
                            parentId: null,
                            createdAt: new Date().toISOString(),
                            userId: -1 // System/Virtual ID
                        },
                        ...fetchedFolders
                    ];
                }
                setFolders(fetchedFolders);
                setFiles(data.files);
                setBreadcrumbs(data.breadcrumbs);
            }

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
        const handleClick = (e: MouseEvent) => {
            setContextMenu(null);
            // Check action dropdown
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowActionDropdown(false);
            }
            // Check search results dropdown separately
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    // Deep search using API
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!searchQuery || searchQuery.length < 2) {
            setSearchResults({ folders: [], files: [] });
            setSearchLoading(false);
            return;
        }

        setSearchLoading(true);
        setShowSearchResults(true);

        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const url = currentParentId && currentParentId > 0
                    ? `${API_URL}/folders/search?q=${encodeURIComponent(searchQuery)}&parentId=${currentParentId}`
                    : `${API_URL}/folders/search?q=${encodeURIComponent(searchQuery)}`;

                const response = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setSearchResults({
                        folders: data.folders || [],
                        files: data.files || []
                    });
                }
            } catch (error) {
                console.error('Error searching:', error);
            } finally {
                setSearchLoading(false);
            }
        }, 300); // Debounce 300ms

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, currentParentId, token]);

    // Clear search when navigating
    useEffect(() => {
        setSearchQuery('');
        setSearchResults({ folders: [], files: [] });
        setShowSearchResults(false);
    }, [currentParentId]);

    const createOfficeFile = (type: 'word' | 'excel' | 'powerpoint') => {
        const config = {
            word: {
                name: 'Tài liệu mới',
                mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                ext: '.docx'
            },
            excel: {
                name: 'Bảng tính mới',
                mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                ext: '.xlsx'
            },
            powerpoint: {
                name: 'Bài trình bày mới',
                mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                ext: '.pptx'
            }
        };

        const { name, mime, ext } = config[type];
        setNewFileNameInput(name);
        setCreateFileDialog({ open: true, type, ext, mime });
        setShowActionDropdown(false);
    };

    const handleConfirmCreateFile = async () => {
        if (!createFileDialog || !newFileNameInput.trim()) return;

        const { ext, mime, type } = createFileDialog;
        let fileName = newFileNameInput.trim();
        if (!fileName.toLowerCase().endsWith(ext.toLowerCase())) {
            fileName += ext;
        }

        setUploading(true);
        try {
            // Use minimal content to create a valid non-empty file
            // For Office files, we can't easily generate valid zip structures on frontend without a heavy library.
            // We create a text file with clear content. The user should use opening logic to handle it or backend should provide templates.
            // However, to fix "Upload failed", we ensure size > 0.
            const content = type === 'word' ? 'New Word Document' :
                type === 'excel' ? 'New Excel Spreadsheet' :
                    'New PowerPoint Presentation';

            const blob = new Blob([content], { type: mime });
            const file = new File([blob], fileName, { type: mime });

            const formData = new FormData();
            formData.append('file', file);
            if (currentParentId && currentParentId !== GOOGLE_DRIVE_FOLDER_ID) {
                formData.append('folderId', String(currentParentId));
            }

            const response = await fetch(`${API_URL}/folders/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to create file');
            }

            dialog.showSuccess('Đã tạo file thành công!');
            setCreateFileDialog(null);
            fetchData();
        } catch (error: any) {
            console.error('Create file error:', error);
            dialog.showError(error.message || 'Lỗi khi tạo file');
        } finally {
            setUploading(false);
        }
    };

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

        const totalFiles = selectedFiles.length;
        const hasRelativePath = selectedFiles[0]?.webkitRelativePath;

        setUploading(true);

        // Helper function to upload a single file with retry
        const uploadSingleFile = async (file: File, targetFolderId: number | null, retries = 3): Promise<boolean> => {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    if (targetFolderId) {
                        formData.append('folderId', String(targetFolderId));
                    }

                    const response = await fetch(`${API_URL}/folders/upload`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData
                    });

                    if (response.ok) {
                        return true;
                    }

                    // If server error, retry
                    if (attempt < retries && response.status >= 500) {
                        console.log(`Retry ${attempt}/${retries} for ${file.name}`);
                        await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
                        continue;
                    }

                    console.error(`Upload failed for ${file.name}: ${response.status}`);
                    return false;
                } catch (error) {
                    console.error(`Upload error for ${file.name}:`, error);
                    if (attempt < retries) {
                        await new Promise(r => setTimeout(r, 1000 * attempt));
                        continue;
                    }
                    return false;
                }
            }
            return false;
        };

        // Helper to upload files in parallel batches
        const uploadInBatches = async (
            files: { file: File; folderId: number | null }[],
            batchSize: number = 3
        ): Promise<{ success: number; failed: number }> => {
            let successCount = 0;
            let failedCount = 0;
            let uploadedCount = 0;

            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);

                const results = await Promise.all(
                    batch.map(async ({ file, folderId }) => {
                        const success = await uploadSingleFile(file, folderId);
                        uploadedCount++;
                        setUploadProgress({
                            currentFile: file.name,
                            currentIndex: uploadedCount,
                            totalFiles: files.length,
                            percentage: Math.round((uploadedCount / files.length) * 100)
                        });
                        return success;
                    })
                );

                successCount += results.filter(r => r).length;
                failedCount += results.filter(r => !r).length;
            }

            return { success: successCount, failed: failedCount };
        };

        try {
            if (hasRelativePath) {
                // Folder upload - need to preserve structure
                const folderPaths = new Set<string>();
                const fileInfos: { file: File; folderPath: string }[] = [];

                for (let i = 0; i < selectedFiles.length; i++) {
                    const file = selectedFiles[i];
                    const relativePath = file.webkitRelativePath;
                    const pathParts = relativePath.split('/');

                    // Build folder paths
                    let currentPath = '';
                    for (let j = 0; j < pathParts.length - 1; j++) {
                        currentPath = currentPath ? `${currentPath}/${pathParts[j]}` : pathParts[j];
                        folderPaths.add(currentPath);
                    }

                    const parentPath = pathParts.slice(0, -1).join('/');
                    fileInfos.push({ file, folderPath: parentPath });
                }

                // Create folder structure
                const sortedPaths = Array.from(folderPaths).sort((a, b) => a.split('/').length - b.split('/').length);

                setUploadProgress({
                    currentFile: 'Đang tạo cấu trúc thư mục...',
                    currentIndex: 0,
                    totalFiles,
                    percentage: 0
                });

                const structureResponse = await fetch(`${API_URL}/folders/ensure-structure`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        paths: sortedPaths,
                        parentId: currentParentId
                    })
                });

                if (!structureResponse.ok) {
                    throw new Error('Failed to create folder structure');
                }

                const { pathMap } = await structureResponse.json();
                const folderIdMap = new Map<string, number>(Object.entries(pathMap).map(([k, v]) => [k, v as number]));

                // Prepare files with their target folder IDs
                const filesToUpload = fileInfos.map(({ file, folderPath }) => ({
                    file,
                    folderId: folderPath ? folderIdMap.get(folderPath) ?? currentParentId : currentParentId
                }));

                // Upload in parallel batches (3 at a time)
                const { success, failed } = await uploadInBatches(filesToUpload, 3);

                if (failed > 0) {
                    dialog.showError(`Đã upload ${success} file. ${failed} file thất bại.`, { title: 'Upload hoàn tất (có lỗi)' });
                } else {
                    dialog.showSuccess(`Đã upload ${success} file thành công!`, { title: 'Thành công' });
                }
            } else {
                // Regular file upload
                const filesToUpload = Array.from(selectedFiles).map(file => ({
                    file,
                    folderId: currentParentId
                }));

                const { success, failed } = await uploadInBatches(filesToUpload, 3);

                if (failed > 0) {
                    dialog.showError(`Đã upload ${success} file. ${failed} file thất bại.`, { title: 'Upload hoàn tất (có lỗi)' });
                } else {
                    dialog.showSuccess(`Đã upload ${success} file thành công!`, { title: 'Thành công' });
                }
            }

            fetchData();
        } catch (error: any) {
            dialog.showError(error.message || 'Lỗi khi upload file', { title: 'Lỗi' });
        } finally {
            setUploading(false);
            setUploadProgress(null);
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
            // Fetch file directly with auth token as blob
            const response = await fetch(`${API_URL}/folders/files/${fileId}/download`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to download file');

            const blob = await response.blob();

            // Create blob URL and trigger download
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Cleanup blob URL
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        } catch (error) {
            console.error('Error downloading file:', error);
            dialog.showError('Lỗi khi tải file', { title: 'Lỗi' });
        }
    };

    const handleViewFile = async (file: UserFile) => {
        if (isImageFile(file.name)) {
            try {
                // Fetch image with auth token and create blob URL
                const response = await fetch(`${API_URL}/folders/files/${file.id}/stream`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!response.ok) throw new Error('Failed to get file');

                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                setViewingImage({ url: blobUrl, name: file.name });
            } catch (error) {
                console.error('Error viewing image:', error);
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
        name: string,
        userId: number
    ) => {
        e.preventDefault();
        e.stopPropagation();

        // Prevent context menu for virtual Shared folder
        if (id === SHARED_FOLDER_ID) return;

        // Calculate position to avoid menu going off-screen
        const menuWidth = 180;
        const menuHeight = type === 'file' ? 220 : 140; // Increased height for Share option

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

        setContextMenu({ type, id, name, userId, x, y });
    };

    // Drag & Drop handlers
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.types.includes('Files')) {
            setIsDragging(true);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        // Only hide overlay when fully leaving the drop zone
        if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setIsDragging(false);
        }
    };

    // ESC key to close drag overlay
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isDragging) {
                dragCounter.current = 0;
                setIsDragging(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDragging]);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsDragging(false);

        const items = e.dataTransfer.items;
        if (!items || items.length === 0) return;

        setUploading(true);

        const filesToUpload: { file: File; relativePath: string }[] = [];
        const foldersToCreate: Set<string> = new Set();

        const processEntry = async (entry: FileSystemEntry | null, path: string): Promise<void> => {
            if (!entry) return;

            if (entry.isFile) {
                const fileEntry = entry as FileSystemFileEntry;
                return new Promise((resolve) => {
                    fileEntry.file((file) => {
                        if (file.size > MAX_FILE_SIZE) {
                            dialog.showError(`File "${file.name}" vượt quá giới hạn 1024MB`);
                            resolve();
                            return;
                        }
                        const parts = path.split('/');
                        parts.pop();
                        const folderPath = parts.join('/');
                        if (folderPath) foldersToCreate.add(folderPath);
                        filesToUpload.push({ file, relativePath: path });
                        resolve();
                    }, () => resolve());
                });
            } else if (entry.isDirectory) {
                const dirEntry = entry as FileSystemDirectoryEntry;
                foldersToCreate.add(path);
                const reader = dirEntry.createReader();
                return new Promise((resolve) => {
                    const readEntries = () => {
                        reader.readEntries(async (entries) => {
                            if (entries.length === 0) {
                                resolve();
                            } else {
                                for (const subEntry of entries) {
                                    await processEntry(subEntry, `${path}/${subEntry.name}`);
                                }
                                readEntries();
                            }
                        }, () => resolve());
                    };
                    readEntries();
                });
            }
        };

        try {
            const firstItem = items[0];
            const hasWebkitEntry = firstItem && typeof firstItem.webkitGetAsEntry === 'function';

            if (hasWebkitEntry) {
                for (let i = 0; i < items.length; i++) {
                    const entry = items[i].webkitGetAsEntry();
                    if (entry) {
                        await processEntry(entry, entry.name);
                    }
                }
            } else {
                const droppedFiles = e.dataTransfer.files;
                for (let i = 0; i < droppedFiles.length; i++) {
                    const file = droppedFiles[i];
                    if (file.size > MAX_FILE_SIZE) continue;
                    filesToUpload.push({ file, relativePath: file.name });
                }
            }

            if (filesToUpload.length === 0) {
                setUploading(false);
                return;
            }

            // Create folder structure using API ensure-structure
            const sortedPaths = Array.from(foldersToCreate).sort((a, b) =>
                a.split('/').length - b.split('/').length
            );

            const folderIdMap = new Map<string, number>();

            if (sortedPaths.length > 0) {
                setUploadProgress({
                    currentFile: 'Đang tạo cấu trúc thư mục...',
                    currentIndex: 0,
                    totalFiles: filesToUpload.length,
                    percentage: 0
                });

                const structureResponse = await fetch(`${API_URL}/folders/ensure-structure`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        paths: sortedPaths,
                        parentId: currentParentId
                    })
                });

                if (!structureResponse.ok) {
                    throw new Error('Failed to create folder structure');
                }

                const { pathMap } = await structureResponse.json();
                Object.entries(pathMap).forEach(([k, v]) => folderIdMap.set(k, v as number));
            }

            // Upload files
            let success = 0;
            let failed = 0;
            const total = filesToUpload.length;

            for (let i = 0; i < total; i++) {
                const { file, relativePath } = filesToUpload[i];
                const parts = relativePath.split('/');
                parts.pop();
                const folderPath = parts.join('/');
                const folderId = folderPath ? (folderIdMap.get(folderPath) ?? currentParentId) : currentParentId;

                setUploadProgress({
                    currentFile: file.name,
                    currentIndex: i + 1,
                    totalFiles: total,
                    percentage: Math.round(((i + 1) / total) * 100)
                });

                // Simple retry logic
                let uploaded = false;
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        const formData = new FormData();
                        formData.append('file', file);
                        if (folderId) {
                            formData.append('folderId', String(folderId));
                        }

                        const response = await fetch(`${API_URL}/folders/upload`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` },
                            body: formData
                        });

                        if (response.ok) {
                            uploaded = true;
                            break;
                        }
                        await new Promise(r => setTimeout(r, 1000));
                    } catch (err) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }

                if (uploaded) success++;
                else failed++;
            }

            if (failed > 0) {
                dialog.showError(`Đã upload ${success} file. ${failed} file thất bại.`);
            } else {
                dialog.showSuccess(`Đã upload ${success} file thành công!`);
            }

            fetchData();
        } catch (error) {
            console.error('Drop error:', error);
            dialog.showError('Lỗi khi upload file');
        } finally {
            setUploading(false);
            setUploadProgress(null);
        }
    };

    // Multi-select handlers
    const toggleSelectItem = (type: 'folder' | 'file', id: number) => {
        setSelectedItems(prev => {
            if (type === 'folder') {
                const exists = prev.folders.includes(id);
                return {
                    ...prev,
                    folders: exists ? prev.folders.filter(x => x !== id) : [...prev.folders, id]
                };
            } else {
                const exists = prev.files.includes(id);
                return {
                    ...prev,
                    files: exists ? prev.files.filter(x => x !== id) : [...prev.files, id]
                };
            }
        });
    };

    const toggleSelectionMode = () => {
        setIsSelectionMode(prev => !prev);
        setSelectedItems({ folders: [], files: [] });
    };

    const selectAll = () => {
        setSelectedItems({
            folders: folders.filter(f => f.id > 0 && f.userId === user?.id).map(f => f.id),
            files: files.filter(f => f.userId === user?.id).map(f => f.id)
        });
    };

    const clearSelection = () => {
        setSelectedItems({ folders: [], files: [] });
    };

    const handleBulkDelete = async () => {
        const totalSelected = selectedItems.folders.length + selectedItems.files.length;
        if (totalSelected === 0) return;

        const confirmed = await dialog.showConfirm(
            `Bạn có chắc muốn xóa ${totalSelected} mục đã chọn? Hành động này không thể hoàn tác.`,
            { title: 'Xác nhận xóa', confirmText: 'Xóa', cancelText: 'Hủy' }
        );

        if (!confirmed) return;

        let deleted = 0;
        let failed = 0;

        // Delete folders
        for (const folderId of selectedItems.folders) {
            try {
                const response = await fetch(`${API_URL}/folders/folders/${folderId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.ok) deleted++;
                else failed++;
            } catch {
                failed++;
            }
        }

        // Delete files
        for (const fileId of selectedItems.files) {
            try {
                const response = await fetch(`${API_URL}/folders/files/${fileId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.ok) deleted++;
                else failed++;
            } catch {
                failed++;
            }
        }

        if (failed > 0) {
            dialog.showError(`Đã xóa ${deleted} mục. ${failed} mục thất bại.`);
        } else {
            dialog.showSuccess(`Đã xóa ${deleted} mục thành công!`);
        }

        setSelectedItems({ folders: [], files: [] });
        setIsSelectionMode(false);
        fetchData();
    };

    const navigateToFolder = (folderId: number | null) => {
        // Optimistic update - immediately show loading state and clear old data
        setLoading(true);
        setFolders([]);
        setFiles([]);
        setCurrentParentId(folderId);
    };

    const navigateToRoot = () => {
        // Optimistic update
        setLoading(true);
        setFolders([]);
        setFiles([]);
        setCurrentParentId(null);
    };

    const navigateBack = () => {
        // Optimistic update
        setLoading(true);
        setFolders([]);
        setFiles([]);
        if (breadcrumbs.length > 1) {
            const parentBreadcrumb = breadcrumbs[breadcrumbs.length - 2];
            setCurrentParentId(parentBreadcrumb.id);
        } else {
            setCurrentParentId(null);
        }
    };

    // Google Drive virtual folder ID
    const GOOGLE_DRIVE_FOLDER_ID = -998;

    // Grid View Item for Folder
    const FolderGridItem = ({ folder }: { folder: UserFolder }) => {
        const isSelected = selectedItems.folders.includes(folder.id);
        const canSelect = folder.id > 0 && folder.userId === user?.id;

        return (
            <div
                className={`group relative bg-white border rounded-xl p-3 sm:p-4 hover:shadow-lg transition-all cursor-pointer active:scale-98 touch-manipulation ${isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'
                    }`}
                onClick={() => {
                    if (isSelectionMode && canSelect) {
                        toggleSelectItem('folder', folder.id);
                    } else if (folder.id === GOOGLE_DRIVE_FOLDER_ID) {
                        setShowDriveBrowser(true);
                    } else {
                        navigateToFolder(folder.id);
                    }
                }}
                onContextMenu={(e) => {
                    if (folder.id !== GOOGLE_DRIVE_FOLDER_ID) {
                        handleContextMenu(e, 'folder', folder.id, folder.name, folder.userId);
                    }
                }}
            >
                {/* Selection Checkbox */}
                {isSelectionMode && canSelect && (
                    <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                        }`}>
                        {isSelected && <Check size={12} className="text-white" />}
                    </div>
                )}
                <div className="flex flex-col items-center">
                    {folder.id === SHARED_FOLDER_ID ? (
                        <div className="relative">
                            <Folder className="w-12 h-12 sm:w-16 sm:h-16 text-blue-500 mb-1 sm:mb-2" />
                            <User className="absolute -bottom-1 -right-1 w-6 h-6 text-white bg-blue-500 rounded-full p-1 border-2 border-white" />
                        </div>
                    ) : folder.id === GOOGLE_DRIVE_FOLDER_ID ? (
                        <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center mb-1 sm:mb-2">
                            <GoogleDriveIcon size={48} />
                        </div>
                    ) : (
                        <Folder className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-500 mb-1 sm:mb-2" />
                    )}
                    <span className="text-xs sm:text-sm font-medium text-gray-700 text-center line-clamp-2">
                        {folder.name}
                    </span>
                    {folder.ownerName && (
                        <span className="text-[10px] sm:text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                            <User size={10} /> {folder.ownerName}
                        </span>
                    )}
                    {folder.id !== GOOGLE_DRIVE_FOLDER_ID && (
                        <span className="text-xs text-gray-400 mt-1 flex items-center gap-1 hidden sm:flex">
                            <Clock size={10} />
                            {formatDate(folder.createdAt)}
                        </span>
                    )}
                </div>

                {folder.id !== SHARED_FOLDER_ID && folder.id !== GOOGLE_DRIVE_FOLDER_ID && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleContextMenu(e, 'folder', folder.id, folder.name, folder.userId);
                        }}
                        className="absolute top-1 right-1 sm:top-2 sm:right-2 p-1.5 sm:p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-gray-100 rounded transition-all"
                    >
                        <MoreVertical size={16} className="text-gray-500" />
                    </button>
                )}
            </div>
        );
    };

    // Grid View Item for File
    const FileGridItem = ({ file }: { file: UserFile }) => {
        const isSelected = selectedItems.files.includes(file.id);
        const canSelect = file.userId === user?.id;

        return (
            <div
                className={`group relative bg-white border rounded-xl p-3 sm:p-4 hover:shadow-lg transition-all cursor-pointer active:scale-98 touch-manipulation ${isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'
                    }`}
                onClick={() => {
                    if (isSelectionMode && canSelect) {
                        toggleSelectItem('file', file.id);
                    } else {
                        handleViewFile(file);
                    }
                }}
                onContextMenu={(e) => handleContextMenu(e, 'file', file.id, file.name, file.userId)}
            >
                {/* Selection Checkbox */}
                {isSelectionMode && canSelect && (
                    <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                        }`}>
                        {isSelected && <Check size={12} className="text-white" />}
                    </div>
                )}
                <div className="flex flex-col items-center">
                    {getFileIcon(file.name)}
                    <span className="mt-1 sm:mt-2 text-xs sm:text-sm font-medium text-gray-700 text-center line-clamp-2">
                        {file.name}
                    </span>
                    {file.ownerName && (
                        <span className="text-[10px] sm:text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                            <User size={10} /> {file.ownerName}
                        </span>
                    )}
                    <span className="text-xs text-gray-400 mt-1">
                        {formatFileSize(file.fileSize)}
                    </span>
                    <span className="text-xs text-gray-400 mt-0.5 hidden sm:flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(file.createdAt)}
                    </span>
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleContextMenu(e, 'file', file.id, file.name, file.userId);
                    }}
                    className="absolute top-1 right-1 sm:top-2 sm:right-2 p-1.5 sm:p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-gray-100 rounded transition-all"
                >
                    <MoreVertical size={16} className="text-gray-500" />
                </button>
            </div>
        );
    };

    // List View Item for Folder
    const FolderListItem = ({ folder }: { folder: UserFolder }) => (
        <div
            className="group flex items-center gap-3 sm:gap-4 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all cursor-pointer active:bg-gray-50 touch-manipulation"
            onClick={() => {
                if (folder.id === GOOGLE_DRIVE_FOLDER_ID) {
                    setShowDriveBrowser(true);
                } else {
                    navigateToFolder(folder.id);
                }
            }}
            onContextMenu={(e) => {
                if (folder.id !== GOOGLE_DRIVE_FOLDER_ID) {
                    handleContextMenu(e, 'folder', folder.id, folder.name, folder.userId);
                }
            }}
        >
            {folder.id === SHARED_FOLDER_ID ? (
                <div className="relative mr-2">
                    <Folder className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
                    <User className="absolute -bottom-1 -right-1 w-4 h-4 text-white bg-blue-500 rounded-full p-0.5 border border-white" />
                </div>
            ) : folder.id === GOOGLE_DRIVE_FOLDER_ID ? (
                <div className="w-8 h-8 flex items-center justify-center">
                    <GoogleDriveIcon size={28} />
                </div>
            ) : (
                <Folder className="w-7 h-7 sm:w-8 sm:h-8 text-yellow-500 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-700 block truncate">
                    {folder.name}
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                        {folder.id === GOOGLE_DRIVE_FOLDER_ID ? 'Cloud Storage' : 'Thư mục'}
                    </span>
                    {folder.ownerName && (
                        <span className="text-xs text-blue-500 flex items-center gap-1">
                            <User size={10} /> {folder.ownerName}
                        </span>
                    )}
                </div>
            </div>
            {folder.id !== GOOGLE_DRIVE_FOLDER_ID && (
                <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={12} />
                    {formatDate(folder.createdAt)}
                </div>
            )}
            {folder.id !== SHARED_FOLDER_ID && folder.id !== GOOGLE_DRIVE_FOLDER_ID && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleContextMenu(e, 'folder', folder.id, folder.name, folder.userId);
                    }}
                    className="p-1.5 sm:p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-gray-100 rounded transition-all"
                >
                    <MoreVertical size={16} className="text-gray-500" />
                </button>
            )}
        </div>
    );

    // List View Item for File
    const FileListItem = ({ file }: { file: UserFile }) => (
        <div
            className="group flex items-center gap-3 sm:gap-4 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all cursor-pointer active:bg-gray-50 touch-manipulation"
            onClick={() => handleViewFile(file)}
            onContextMenu={(e) => handleContextMenu(e, 'file', file.id, file.name, file.userId)}
        >
            {getFileIcon(file.name, 'sm')}
            <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-700 block truncate">
                    {file.name}
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{formatFileSize(file.fileSize)}</span>
                    {file.ownerName && (
                        <span className="text-xs text-blue-500 flex items-center gap-1">
                            <User size={10} /> {file.ownerName}
                        </span>
                    )}
                </div>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                <Clock size={12} />
                {formatDate(file.createdAt)}
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, 'file', file.id, file.name, file.userId);
                }}
                className="p-1.5 sm:p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-gray-100 rounded transition-all"
            >
                <MoreVertical size={16} className="text-gray-500" />
            </button>
        </div>
    );

    return (
        <div
            className="space-y-4 sm:space-y-6 relative"
            ref={dropZoneRef}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag Overlay */}
            {isDragging && (
                <div className="fixed inset-0 z-[9998] bg-blue-500/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 border-4 border-dashed border-blue-500">
                        <div className="flex flex-col items-center gap-4">
                            <Upload className="w-16 h-16 text-blue-500" />
                            <p className="text-xl font-semibold text-gray-800">Thả file hoặc thư mục vào đây</p>
                            <p className="text-sm text-gray-500">Để tải lên vào thư mục hiện tại</p>
                        </div>
                    </div>
                </div>
            )}
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Thư mục của tôi</h2>
                    <p className="text-gray-500 mt-0.5 sm:mt-1 text-sm sm:text-base">Quản lý và lưu trữ các file của bạn</p>
                </div>

                {/* Small Search Bar */}
                <div ref={searchRef} className="relative w-full sm:w-64 group" onClick={(e) => e.stopPropagation()}>
                    <div className="relative w-full p-[1.5px] rounded-xl bg-gray-200 group-focus-within:bg-gradient-to-r group-focus-within:from-blue-500 group-focus-within:via-purple-500 group-focus-within:to-pink-500 transition-all duration-500">
                        <div className="relative w-full bg-white rounded-[10.5px] flex items-center h-full">
                            <Search className="absolute left-3 text-gray-400 group-focus-within:text-blue-500 transition-colors z-10" size={16} />
                            <input
                                type="text"
                                placeholder="Tìm kiếm..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => searchQuery && setShowSearchResults(true)}
                                className="w-full pl-9 pr-8 py-2 bg-transparent border-none focus:ring-0 text-sm outline-none rounded-[10.5px]"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setShowSearchResults(false);
                                    }}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Search Results Dropdown */}
                    {showSearchResults && searchQuery && searchQuery.length >= 2 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-100 max-h-80 overflow-y-auto z-50">
                            {searchLoading ? (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                    <span className="ml-2 text-sm text-gray-500">Đang tìm kiếm...</span>
                                </div>
                            ) : (searchResults.folders.length > 0 || searchResults.files.length > 0) ? (
                                <>
                                    {searchResults.folders.length > 0 && (
                                        <div className="p-2">
                                            <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase">Thư mục ({searchResults.folders.length})</p>
                                            {searchResults.folders.slice(0, 8).map((folder) => (
                                                <div
                                                    key={`search-folder-${folder.id}`}
                                                    onClick={() => {
                                                        navigateToFolder(folder.id);
                                                        setSearchQuery('');
                                                        setShowSearchResults(false);
                                                    }}
                                                    className="flex items-center gap-2 px-2 py-2 hover:bg-blue-50 cursor-pointer rounded-md transition-colors"
                                                >
                                                    <Folder size={16} className="text-yellow-500 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-gray-700 truncate">{folder.name}</span>
                                                            {(folder as any).ownerName && (
                                                                <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                                                                    <User size={10} className="inline mr-0.5" />{(folder as any).ownerName}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {folder.path && (
                                                            <span className="text-xs text-gray-400 block truncate">{folder.path}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {searchResults.files.length > 0 && (
                                        <div className="p-2 border-t border-gray-100">
                                            <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase">File ({searchResults.files.length})</p>
                                            {searchResults.files.slice(0, 8).map((file) => (
                                                <div
                                                    key={`search-file-${file.id}`}
                                                    onClick={() => {
                                                        handleViewFile(file);
                                                        setSearchQuery('');
                                                        setShowSearchResults(false);
                                                    }}
                                                    className="flex items-center gap-2 px-2 py-2 hover:bg-blue-50 cursor-pointer rounded-md transition-colors"
                                                >
                                                    {getFileIcon(file.name, 'xs')}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-gray-700 truncate">{file.name}</span>
                                                            {(file as any).ownerName && (
                                                                <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                                                                    <User size={10} className="inline mr-0.5" />{(file as any).ownerName}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {file.path && (
                                                            <span className="text-xs text-gray-400 block truncate">{file.path}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="p-6 text-center">
                                    <Search size={24} className="text-gray-300 mx-auto mb-2" />
                                    <p className="text-gray-400 text-sm">Không tìm thấy kết quả</p>
                                    <p className="text-gray-300 text-xs mt-1">Thử tìm kiếm với từ khóa khác</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    {currentParentId !== SHARED_FOLDER_ID && (
                        <div className="relative" ref={dropdownRef}>
                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowActionDropdown(!showActionDropdown);
                                }}
                                disabled={uploading}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                            >
                                <Plus size={16} />
                                <span>Thêm mới</span>
                                <ChevronRight size={14} className={`transform transition-transform ${showActionDropdown ? 'rotate-90' : ''}`} />
                            </button>

                            {showActionDropdown && (
                                <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                                    <button
                                        onClick={() => {
                                            setShowCreateFolder(true);
                                            setShowActionDropdown(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <FolderPlus size={16} className="text-yellow-500" />
                                        <span>Tạo thư mục</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            fileInputRef.current?.click();
                                            setShowActionDropdown(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <Upload size={16} className="text-blue-500" />
                                        <span>Tải file lên</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const folderInput = document.createElement('input');
                                            folderInput.type = 'file';
                                            folderInput.setAttribute('webkitdirectory', '');
                                            folderInput.setAttribute('directory', '');
                                            folderInput.multiple = true;
                                            folderInput.style.display = 'none';
                                            folderInput.onchange = (e) => handleFileUpload(e as any);
                                            folderInput.click();
                                            setShowActionDropdown(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <FolderPlus size={16} className="text-indigo-500" />
                                        <span>Tải thư mục lên</span>
                                    </button>
                                    <div className="h-px bg-gray-100 my-1"></div>
                                    <button
                                        onClick={() => createOfficeFile('word')}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <FileText size={16} className="text-blue-600" />
                                        <span>Tạo file Word</span>
                                    </button>
                                    <button
                                        onClick={() => createOfficeFile('excel')}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <FileSpreadsheet size={16} className="text-green-600" />
                                        <span>Tạo file Excel</span>
                                    </button>
                                    <button
                                        onClick={() => createOfficeFile('powerpoint')}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <Presentation size={16} className="text-orange-600" />
                                        <span>Tạo file PowerPoint</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right side: View Mode Toggle + Selection Mode Toggle */}
                <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                            title="Xem dạng lưới"
                        >
                            <Grid3X3 size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                            title="Xem dạng danh sách"
                        >
                            <List size={16} />
                        </button>
                    </div>

                    {/* Selection Mode Toggle */}
                    <button
                        onClick={toggleSelectionMode}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${isSelectionMode
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        <Check size={16} />
                        <span className="hidden sm:inline">Chọn</span>
                    </button>
                </div>
            </div>

            {/* Selection Toolbar */}
            {isSelectionMode && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-sm text-blue-700 font-medium">
                        Đã chọn: {selectedItems.folders.length + selectedItems.files.length}
                    </span>
                    <div className="flex-1" />
                    <button
                        onClick={selectAll}
                        className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-100 rounded-lg"
                    >
                        Chọn tất cả
                    </button>
                    <button
                        onClick={clearSelection}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        Bỏ chọn
                    </button>
                    <button
                        onClick={handleBulkDelete}
                        disabled={selectedItems.folders.length + selectedItems.files.length === 0}
                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                        <Trash2 size={14} />
                        Xóa
                    </button>
                </div>
            )}

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg overflow-x-auto">
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
                            <p className="text-lg">
                                {searchQuery ? 'Không tìm thấy kết quả' : 'Thư mục trống'}
                            </p>
                            <p className="text-sm mt-2">
                                {searchQuery
                                    ? `Không có thư mục hoặc file nào phù hợp với "${searchQuery}"`
                                    : currentParentId === SHARED_FOLDER_ID
                                        ? 'Chưa có file nào được chia sẻ với bạn'
                                        : 'Tạo thư mục mới hoặc tải file lên để bắt đầu'}
                            </p>
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
                            <p className="text-lg">
                                {searchQuery ? 'Không tìm thấy kết quả' : 'Thư mục trống'}
                            </p>
                            <p className="text-sm mt-2">
                                {searchQuery
                                    ? `Không có thư mục hoặc file nào phù hợp với "${searchQuery}"`
                                    : currentParentId === SHARED_FOLDER_ID
                                        ? 'Chưa có file nào được chia sẻ với bạn'
                                        : 'Tạo thư mục mới hoặc tải file lên để bắt đầu'}
                            </p>
                        </div>
                    )}
                </div>
            )
            }

            {/* Context Menu */}
            {
                contextMenu && (
                    <div
                        className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 min-w-[180px]"
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
                                    <Eye size={16} className="text-gray-500" />
                                    <span>Xem</span>
                                </button>
                                <button
                                    onClick={() => {
                                        handleDownloadFile(contextMenu.id, contextMenu.name);
                                        setContextMenu(null);
                                    }}
                                    className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-gray-100"
                                >
                                    <Download size={16} className="text-gray-500" />
                                    <span>Tải xuống</span>
                                </button>
                            </>
                        )}

                        {/* Share button - Allow all users (including shared users) to share */}
                        <div className="my-1 border-t border-gray-100" />
                        <button
                            onClick={() => {
                                setShareDialog({
                                    type: contextMenu.type,
                                    id: contextMenu.id,
                                    name: contextMenu.name
                                });
                                setContextMenu(null);
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-gray-100"
                        >
                            <User size={16} className="text-gray-500" />
                            <span>Chia sẻ</span>
                        </button>

                        {/* Check ownership for Rename and Delete only */}
                        {(contextMenu.userId === user?.id || !contextMenu.userId /* Fallback if userId missing */) && (
                            <>
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
                                    <Edit2 size={16} className="text-gray-500" />
                                    <span>Đổi tên</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setMoveDialog({
                                            type: contextMenu.type,
                                            id: contextMenu.id,
                                            name: contextMenu.name
                                        });
                                        setContextMenu(null);
                                    }}
                                    className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-gray-100"
                                >
                                    <Move size={16} className="text-gray-500" />
                                    <span>Di chuyển</span>
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
                            </>
                        )}
                    </div>
                )
            }

            {/* Share Dialog */}
            {
                shareDialog && (
                    <ShareDialog
                        type={shareDialog.type}
                        id={shareDialog.id}
                        name={shareDialog.name}
                        onClose={() => setShareDialog(null)}
                        token={token || ''}
                    />
                )
            }

            {/* Create Folder Dialog */}
            {
                showCreateFolder && (
                    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
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
                )
            }

            {/* Create File Dialog */}
            {
                createFileDialog && createFileDialog.open && (
                    <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-3 rounded-full ${createFileDialog.type === 'word' ? 'bg-blue-100' :
                                    createFileDialog.type === 'excel' ? 'bg-green-100' : 'bg-orange-100'
                                    }`}>
                                    {createFileDialog.type === 'word' && <FileText className="w-6 h-6 text-blue-600" />}
                                    {createFileDialog.type === 'excel' && <FileSpreadsheet className="w-6 h-6 text-green-600" />}
                                    {createFileDialog.type === 'powerpoint' && <Presentation className="w-6 h-6 text-orange-600" />}
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {createFileDialog.type === 'word' && 'Tạo file Word mới'}
                                    {createFileDialog.type === 'excel' && 'Tạo file Excel mới'}
                                    {createFileDialog.type === 'powerpoint' && 'Tạo file PowerPoint mới'}
                                </h3>
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Tên file
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={newFileNameInput}
                                        onChange={(e) => setNewFileNameInput(e.target.value)}
                                        placeholder="Nhập tên file"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all pr-16"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleConfirmCreateFile();
                                            if (e.key === 'Escape') setCreateFileDialog(null);
                                        }}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                        {createFileDialog.ext}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setCreateFileDialog(null)}
                                    className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleConfirmCreateFile}
                                    className={`px-5 py-2.5 text-white rounded-xl transition-colors font-medium ${createFileDialog.type === 'word' ? 'bg-blue-600 hover:bg-blue-700' :
                                        createFileDialog.type === 'excel' ? 'bg-green-600 hover:bg-green-700' :
                                            'bg-orange-600 hover:bg-orange-700'
                                        }`}
                                >
                                    Tạo file
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Rename Dialog */}
            {
                renameDialog && (
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
                )
            }

            {/* Image Viewer */}
            {
                viewingImage && (
                    <ImageViewer
                        imageUrl={viewingImage.url}
                        fileName={viewingImage.name}
                        onClose={() => setViewingImage(null)}
                    />
                )
            }

            {/* OnlyOffice Viewer */}
            {
                viewingOffice && (
                    <OnlyOfficeViewer
                        fileId={viewingOffice.id}
                        fileName={viewingOffice.name}
                        onClose={() => setViewingOffice(null)}
                        token={token || ''}
                    />
                )
            }

            {/* Upload Progress Dialog */}
            {
                uploading && uploadProgress && (
                    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Upload className="w-6 h-6 text-blue-600 animate-bounce" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Đang upload file...</h3>
                                    <p className="text-sm text-gray-500">
                                        File {uploadProgress.currentIndex} / {uploadProgress.totalFiles}
                                    </p>
                                </div>
                            </div>

                            <div className="mb-3">
                                <p className="text-sm text-gray-700 truncate mb-2" title={uploadProgress.currentFile}>
                                    📄 {uploadProgress.currentFile}
                                </p>

                                {/* Progress bar */}
                                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                                        style={{ width: `${uploadProgress.percentage}%` }}
                                    />
                                </div>

                                <p className="text-sm text-gray-500 mt-2 text-center">
                                    {uploadProgress.percentage}% hoàn thành
                                </p>
                            </div>

                            <p className="text-xs text-gray-400 text-center">
                                Vui lòng không đóng trang này khi đang upload
                            </p>
                        </div>
                    </div>
                )
            }

            {/* Move Dialog */}
            {moveDialog && (
                <MoveDialog
                    type={moveDialog.type}
                    id={moveDialog.id}
                    name={moveDialog.name}
                    currentFolderId={currentParentId}
                    onClose={() => setMoveDialog(null)}
                    onSuccess={fetchData}
                    token={token!}
                />
            )}

            {/* Google Drive Browser Modal */}
            {showDriveBrowser && (
                <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl">
                        <GoogleDriveBrowser
                            onClose={() => setShowDriveBrowser(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserFolders;
