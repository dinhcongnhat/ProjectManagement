import React, { useState, useEffect } from 'react';
import { FolderOpen, Loader2, ChevronRight, Home, X, Check } from 'lucide-react';
import { API_URL } from '../../config/api';

interface Folder {
    id: number;
    name: string;
    minioPath: string;
    parentId?: number | null;
}

interface FolderBreadcrumb {
    id: number | null;
    name: string;
}

interface FolderPickerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (folder: { id: number; name: string }) => void;
    token: string;
    title?: string;
}

export const FolderPickerDialog: React.FC<FolderPickerDialogProps> = ({
    isOpen,
    onClose,
    onSelect,
    token,
    title = 'Chọn thư mục từ kho dữ liệu'
}) => {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [loading, setLoading] = useState(false);
    const [_currentFolderId, setCurrentFolderId] = useState<number | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<FolderBreadcrumb[]>([{ id: null, name: 'Thư mục gốc' }]);
    const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);

    useEffect(() => {
        if (isOpen) {
            setSelectedFolder(null);
            setCurrentFolderId(null);
            setBreadcrumbs([{ id: null, name: 'Thư mục gốc' }]);
            fetchFolders(null);
        }
    }, [isOpen]);

    const fetchFolders = async (parentId: number | null) => {
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
                setFolders(data.folders || []);
            }
        } catch (error) {
            console.error('Error fetching folders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNavigateToFolder = (folder: Folder) => {
        setCurrentFolderId(folder.id);
        setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
        setSelectedFolder(null);
        fetchFolders(folder.id);
    };

    const handleNavigateToBreadcrumb = (index: number) => {
        const target = breadcrumbs[index];
        setCurrentFolderId(target.id);
        setBreadcrumbs(prev => prev.slice(0, index + 1));
        setSelectedFolder(null);
        fetchFolders(target.id);
    };

    const handleSelect = () => {
        if (selectedFolder) {
            onSelect({ id: selectedFolder.id, name: selectedFolder.name });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-amber-500 to-amber-600">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                        <FolderOpen size={18} />
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Breadcrumbs */}
                <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1 flex-wrap text-sm bg-gray-50">
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={index}>
                            {index > 0 && <ChevronRight size={14} className="text-gray-400" />}
                            <button
                                onClick={() => handleNavigateToBreadcrumb(index)}
                                className={`px-2 py-1 rounded-md transition-colors ${
                                    index === breadcrumbs.length - 1
                                        ? 'text-amber-700 font-medium bg-amber-50'
                                        : 'text-gray-600 hover:text-amber-600 hover:bg-amber-50'
                                }`}
                            >
                                {index === 0 ? <Home size={14} /> : crumb.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                {/* Folder List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="animate-spin text-amber-500" size={24} />
                        </div>
                    ) : folders.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <FolderOpen size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Không có thư mục con</p>
                        </div>
                    ) : (
                        folders.map(folder => (
                            <div
                                key={folder.id}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                    selectedFolder?.id === folder.id
                                        ? 'bg-amber-100 border border-amber-300'
                                        : 'hover:bg-gray-100 border border-transparent'
                                }`}
                                onClick={() => setSelectedFolder(folder)}
                                onDoubleClick={() => handleNavigateToFolder(folder)}
                            >
                                <FolderOpen size={20} className="text-amber-500 shrink-0" />
                                <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                                    {folder.name}
                                </span>
                                {selectedFolder?.id === folder.id && (
                                    <Check size={16} className="text-amber-600" />
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleNavigateToFolder(folder);
                                    }}
                                    className="p-1 text-gray-400 hover:text-amber-600 rounded"
                                    title="Mở thư mục"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                    <p className="text-xs text-gray-500">
                        {selectedFolder ? `Đã chọn: ${selectedFolder.name}` : 'Nhấp để chọn, nhấp đúp để mở'}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSelect}
                            disabled={!selectedFolder}
                            className="px-4 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                        >
                            <Check size={14} />
                            Chọn thư mục
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
