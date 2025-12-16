import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Download, HardDrive, FolderOpen, Loader2, ChevronDown, Plus, ChevronRight, Home, X, FolderPlus } from 'lucide-react';
import { API_URL } from '../../config/api';
import { useDialog } from './Dialog';

interface Folder {
    id: number;
    name: string;
    path: string;
    parentId?: number | null;
    children?: Folder[];
}

interface FolderBreadcrumb {
    id: number | null;
    name: string;
}

interface FileDownloadButtonProps {
    fileName: string;
    downloadUrl: string;
    token: string;
    className?: string;
    size?: 'sm' | 'md';
    variant?: 'icon' | 'button';
    isOwnMessage?: boolean;
}

export const FileDownloadButton: React.FC<FileDownloadButtonProps> = ({
    fileName,
    downloadUrl,
    token,
    className = '',
    size = 'sm',
    variant = 'icon',
    isOwnMessage = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<FolderBreadcrumb[]>([{ id: null, name: 'Thư mục gốc' }]);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { showSuccess, showError } = useDialog();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate dropdown position when opening
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.top - 8, // Position above button
                left: rect.right - 200 // Align right edge
            });
        }
    }, [isOpen]);

    const fetchFolders = async (parentId: number | null = null) => {
        setLoadingFolders(true);
        try {
            const url = parentId
                ? `${API_URL}/folders?parentId=${parentId}`
                : `${API_URL}/folders`;
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setFolders(data.folders || []);
            }
        } catch (error) {
            console.error('Error fetching folders:', error);
        } finally {
            setLoadingFolders(false);
        }
    };

    const handleDownloadToComputer = async () => {
        setIsOpen(false);
        try {
            const response = await fetch(downloadUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error downloading file:', error);
            showError('Lỗi khi tải file về máy');
        }
    };

    const handleOpenFolderModal = () => {
        setIsOpen(false);
        setShowFolderModal(true);
        setCurrentFolderId(null);
        setBreadcrumbs([{ id: null, name: 'Thư mục gốc' }]);
        fetchFolders(null);
    };

    const handleNavigateToFolder = (folder: Folder) => {
        setCurrentFolderId(folder.id);
        setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
        fetchFolders(folder.id);
    };

    const handleNavigateToBreadcrumb = (index: number) => {
        const target = breadcrumbs[index];
        setCurrentFolderId(target.id);
        setBreadcrumbs(prev => prev.slice(0, index + 1));
        fetchFolders(target.id);
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        setCreatingFolder(true);
        try {
            const response = await fetch(`${API_URL}/folders/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newFolderName.trim(),
                    parentId: currentFolderId
                })
            });

            if (response.ok) {
                showSuccess(`Đã tạo thư mục "${newFolderName}"`);
                setNewFolderName('');
                setShowCreateFolder(false);
                fetchFolders(currentFolderId);
            } else {
                const data = await response.json();
                showError(data.message || 'Lỗi khi tạo thư mục');
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            showError('Lỗi khi tạo thư mục');
        } finally {
            setCreatingFolder(false);
        }
    };

    const handleSaveToFolder = async (folderId: number | null, folderName: string) => {
        setSaving(true);
        try {
            // First download the file
            const response = await fetch(downloadUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to download file');

            const blob = await response.blob();
            const file = new File([blob], fileName, { type: blob.type });

            // Then upload to selected folder
            const formData = new FormData();
            formData.append('file', file);
            if (folderId) {
                formData.append('folderId', folderId.toString());
            }

            const uploadResponse = await fetch(`${API_URL}/folders/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            if (uploadResponse.ok) {
                showSuccess(`Đã lưu "${fileName}" vào "${folderName}"`);
                setShowFolderModal(false);
            } else {
                const data = await uploadResponse.json();
                showError(data.message || 'Lỗi khi lưu file');
            }
        } catch (error) {
            console.error('Error saving to folder:', error);
            showError('Lỗi khi lưu file vào thư mục');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveToCurrentFolder = () => {
        const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
        handleSaveToFolder(currentFolderId, currentBreadcrumb.name);
    };

    const iconSize = size === 'sm' ? 14 : 16;
    const buttonClass = variant === 'icon'
        ? `p-1 rounded ${isOwnMessage ? 'hover:bg-blue-300' : 'hover:bg-gray-200'}`
        : 'p-2 text-gray-600 hover:bg-gray-200 rounded-lg';

    return (
        <>
            <div className={`relative ${className}`}>
                <button
                    ref={buttonRef}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-0.5 transition-colors ${buttonClass}`}
                    title="Tải xuống"
                >
                    {saving ? (
                        <Loader2 size={iconSize} className="animate-spin" />
                    ) : (
                        <Download size={iconSize} />
                    )}
                    <ChevronDown size={8} />
                </button>
            </div>

            {/* Dropdown rendered via Portal */}
            {isOpen && ReactDOM.createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed bg-white rounded-lg shadow-2xl border border-gray-200 min-w-[180px] py-1 text-gray-700"
                    style={{
                        top: Math.max(10, dropdownPosition.top - 90),
                        left: Math.max(10, dropdownPosition.left - 180),
                        zIndex: 99999
                    }}
                >
                    <button
                        onClick={handleDownloadToComputer}
                        className="w-full px-3 py-2.5 text-left text-sm hover:bg-blue-50 flex items-center gap-2 transition-colors"
                    >
                        <HardDrive size={16} className="text-blue-600" />
                        <span className="font-medium text-gray-700">Lưu về máy tính</span>
                    </button>
                    <button
                        onClick={handleOpenFolderModal}
                        className="w-full px-3 py-2.5 text-left text-sm hover:bg-amber-50 flex items-center gap-2 transition-colors"
                    >
                        <FolderOpen size={16} className="text-amber-600" />
                        <span className="font-medium text-gray-700">Lưu về thư mục</span>
                    </button>
                </div>,
                document.body
            )}

            {/* Folder Picker Modal */}
            {showFolderModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <FolderOpen size={20} className="text-amber-600" />
                                Chọn thư mục lưu trữ
                            </h3>
                            <button
                                onClick={() => setShowFolderModal(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* File info */}
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <p className="text-sm text-gray-600">
                                <span className="font-medium">File:</span> {fileName}
                            </p>
                        </div>

                        {/* Breadcrumbs */}
                        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1 overflow-x-auto">
                            {breadcrumbs.map((crumb, index) => (
                                <React.Fragment key={index}>
                                    {index > 0 && <ChevronRight size={14} className="text-gray-400 shrink-0" />}
                                    <button
                                        onClick={() => handleNavigateToBreadcrumb(index)}
                                        className={`px-2 py-1 rounded text-sm whitespace-nowrap transition-colors ${index === breadcrumbs.length - 1
                                            ? 'bg-amber-100 text-amber-700 font-medium'
                                            : 'hover:bg-gray-100 text-gray-600'
                                            }`}
                                    >
                                        {index === 0 ? <Home size={14} className="inline mr-1" /> : null}
                                        {crumb.name}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Folder list */}
                        <div className="p-4">
                            {loadingFolders ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 size={24} className="animate-spin text-amber-600" />
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {/* Create new folder button */}
                                    {!showCreateFolder ? (
                                        <button
                                            onClick={() => setShowCreateFolder(true)}
                                            className="w-full p-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <FolderPlus size={18} />
                                            <span>Tạo thư mục mới</span>
                                        </button>
                                    ) : (
                                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                            <p className="text-sm text-amber-700 font-medium mb-2">Tên thư mục mới:</p>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newFolderName}
                                                    onChange={(e) => setNewFolderName(e.target.value)}
                                                    placeholder="Nhập tên thư mục..."
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-gray-900 bg-white"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCreateFolder();
                                                        if (e.key === 'Escape') {
                                                            setShowCreateFolder(false);
                                                            setNewFolderName('');
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={handleCreateFolder}
                                                    disabled={!newFolderName.trim() || creatingFolder}
                                                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                                                >
                                                    {creatingFolder ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                                    Tạo
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowCreateFolder(false);
                                                        setNewFolderName('');
                                                    }}
                                                    className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm"
                                                >
                                                    Hủy
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Folder list */}
                                    {folders.length === 0 && !showCreateFolder ? (
                                        <div className="text-center py-8 text-gray-400">
                                            <FolderOpen size={40} className="mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">Chưa có thư mục con</p>
                                            <p className="text-xs mt-1">Bấm "Tạo thư mục mới" để thêm</p>
                                        </div>
                                    ) : (
                                        folders.map((folder) => (
                                            <div
                                                key={folder.id}
                                                className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-colors group"
                                            >
                                                <FolderOpen size={20} className="text-amber-500 shrink-0" />
                                                <span className="flex-1 font-medium text-gray-700 truncate">{folder.name}</span>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleNavigateToFolder(folder)}
                                                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-100 rounded transition-colors"
                                                        title="Mở thư mục"
                                                    >
                                                        <ChevronRight size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleSaveToFolder(folder.id, folder.name)}
                                                        disabled={saving}
                                                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        Lưu vào đây
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                            <p className="text-xs text-gray-500">
                                Thư mục hiện tại: <span className="font-medium text-amber-600">{breadcrumbs[breadcrumbs.length - 1].name}</span>
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowFolderModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSaveToCurrentFolder}
                                    disabled={saving}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm transition-colors"
                                >
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                    Lưu vào thư mục này
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default FileDownloadButton;
