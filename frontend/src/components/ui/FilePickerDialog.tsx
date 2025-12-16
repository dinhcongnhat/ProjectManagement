import React, { useState, useEffect } from 'react';
import { FolderOpen, File, Loader2, ChevronRight, Home, X, FileText, Image, Film, Music, Archive, Check } from 'lucide-react';
import { API_URL } from '../../config/api';

interface Folder {
    id: number;
    name: string;
    minioPath: string;
    parentId?: number | null;
}

interface FileItem {
    id: number;
    name: string;
    mimeType: string;
    fileType: string;
    fileSize: number;
    minioPath: string;
}

interface FolderBreadcrumb {
    id: number | null;
    name: string;
}

interface FilePickerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (files: SelectedFile[]) => void;
    token: string;
    multiple?: boolean;
    title?: string;
    acceptTypes?: string[]; // e.g. ['image/*', 'application/pdf']
}

export interface SelectedFile {
    id: number;
    name: string;
    mimeType: string;
    size: number;
    minioPath: string;
    source: 'folder'; // To distinguish from local files
}

const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getFileIcon = (fileName: string, mimeType?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const type = mimeType || '';

    // Image files
    if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
        return <Image size={20} className="text-green-500" />;
    }
    // Video files
    if (type.includes('video') || ['mp4', 'avi', 'mov', 'wmv', 'mkv'].includes(ext)) {
        return <Film size={20} className="text-purple-500" />;
    }
    // Audio files
    if (type.includes('audio') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
        return <Music size={20} className="text-pink-500" />;
    }
    // PDF
    if (type.includes('pdf') || ext === 'pdf') {
        return <FileText size={20} className="text-red-500" />;
    }
    // Excel
    if (type.includes('spreadsheet') || type.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) {
        return <FileText size={20} className="text-green-600" />;
    }
    // Word
    if (type.includes('document') || type.includes('word') || ['doc', 'docx'].includes(ext)) {
        return <FileText size={20} className="text-blue-600" />;
    }
    // PowerPoint
    if (type.includes('presentation') || type.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) {
        return <FileText size={20} className="text-orange-500" />;
    }
    // Archive
    if (type.includes('zip') || type.includes('rar') || type.includes('archive') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
        return <Archive size={20} className="text-amber-600" />;
    }
    return <File size={20} className="text-gray-500" />;
};

export const FilePickerDialog: React.FC<FilePickerDialogProps> = ({
    isOpen,
    onClose,
    onSelect,
    token,
    multiple = true,
    title = 'Chọn file từ thư mục cá nhân',
    acceptTypes
}) => {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<FolderBreadcrumb[]>([{ id: null, name: 'Thư mục gốc' }]);
    const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);

    useEffect(() => {
        if (isOpen) {
            setSelectedFiles([]);
            setCurrentFolderId(null);
            setBreadcrumbs([{ id: null, name: 'Thư mục gốc' }]);
            fetchFoldersAndFiles(null);
        }
    }, [isOpen]);

    const fetchFoldersAndFiles = async (parentId: number | null) => {
        setLoading(true);
        try {
            const url = parentId
                ? `${API_URL}/folders?parentId=${parentId}`
                : `${API_URL}/folders`;

            console.log('[FilePickerDialog] Fetching:', url);

            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('[FilePickerDialog] Response:', data);

                setFolders(data.folders || []);

                // Get files - backend returns files with fileType and fileSize
                let fileList: FileItem[] = (data.files || []).map((f: any) => ({
                    id: f.id,
                    name: f.name,
                    mimeType: f.fileType || f.mimeType || 'application/octet-stream',
                    fileType: f.fileType || f.mimeType || 'application/octet-stream',
                    fileSize: f.fileSize || f.size || 0,
                    minioPath: f.minioPath
                }));

                console.log('[FilePickerDialog] Files before filter:', fileList);

                // Filter files by accept types if specified (but allow all for now to debug)
                if (acceptTypes && acceptTypes.length > 0) {
                    const filtered = fileList.filter((file: FileItem) => {
                        const ext = file.name.split('.').pop()?.toLowerCase() || '';
                        return acceptTypes.some(type => {
                            // Handle wildcard types like 'image/*'
                            if (type.endsWith('/*')) {
                                const baseType = type.replace('/*', '');
                                return file.mimeType.startsWith(baseType);
                            }
                            // Handle extension types like '.pdf', '.doc'
                            if (type.startsWith('.')) {
                                return ext === type.substring(1).toLowerCase();
                            }
                            // Handle mime types
                            return file.mimeType === type;
                        });
                    });
                    console.log('[FilePickerDialog] Files after filter:', filtered);
                    // If filter results in empty, show all files (better UX)
                    setFiles(filtered.length > 0 ? filtered : fileList);
                } else {
                    setFiles(fileList);
                }
            } else {
                console.error('[FilePickerDialog] Error response:', response.status);
            }
        } catch (error) {
            console.error('[FilePickerDialog] Error fetching:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNavigateToFolder = (folder: Folder) => {
        setCurrentFolderId(folder.id);
        setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
        fetchFoldersAndFiles(folder.id);
    };

    const handleNavigateToBreadcrumb = (index: number) => {
        const target = breadcrumbs[index];
        setCurrentFolderId(target.id);
        setBreadcrumbs(prev => prev.slice(0, index + 1));
        fetchFoldersAndFiles(target.id);
    };

    const handleToggleFile = (file: FileItem) => {
        if (multiple) {
            setSelectedFiles(prev => {
                const exists = prev.find(f => f.id === file.id);
                if (exists) {
                    return prev.filter(f => f.id !== file.id);
                }
                return [...prev, file];
            });
        } else {
            setSelectedFiles([file]);
        }
    };

    const handleConfirm = () => {
        const result: SelectedFile[] = selectedFiles.map(f => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType || f.fileType,
            size: f.fileSize,
            minioPath: f.minioPath,
            source: 'folder'
        }));
        onSelect(result);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-blue-500 to-indigo-600">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                        <FolderOpen size={22} />
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Breadcrumbs */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-1 overflow-x-auto bg-gray-50">
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={index}>
                            {index > 0 && <ChevronRight size={16} className="text-gray-400 shrink-0" />}
                            <button
                                onClick={() => handleNavigateToBreadcrumb(index)}
                                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${index === breadcrumbs.length - 1
                                        ? 'bg-blue-100 text-blue-700 font-medium'
                                        : 'hover:bg-gray-200 text-gray-600'
                                    }`}
                            >
                                {index === 0 ? <Home size={14} className="inline mr-1" /> : null}
                                {crumb.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                {/* Content */}
                <div className="p-4 min-h-[350px] max-h-[450px] overflow-y-auto bg-white">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="text-center">
                                <Loader2 size={40} className="animate-spin text-blue-600 mx-auto mb-3" />
                                <p className="text-gray-500 text-sm">Đang tải...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Folders */}
                            {folders.map((folder) => (
                                <div
                                    key={`folder-${folder.id}`}
                                    onClick={() => handleNavigateToFolder(folder)}
                                    className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200 hover:border-amber-400 hover:bg-amber-100 cursor-pointer transition-all hover:shadow-md"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-amber-200 flex items-center justify-center">
                                        <FolderOpen size={22} className="text-amber-600" />
                                    </div>
                                    <span className="flex-1 font-medium text-gray-800">{folder.name}</span>
                                    <ChevronRight size={20} className="text-amber-400" />
                                </div>
                            ))}

                            {/* Files */}
                            {files.map((file) => {
                                const isSelected = selectedFiles.some(f => f.id === file.id);
                                return (
                                    <div
                                        key={`file-${file.id}`}
                                        onClick={() => handleToggleFile(file)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md ${isSelected
                                                ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200'
                                                : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                            {getFileIcon(file.name, file.mimeType)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-800 truncate">{file.name}</p>
                                            <p className="text-xs text-gray-500">{formatFileSize(file.fileSize)}</p>
                                        </div>
                                        {isSelected && (
                                            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                                <Check size={16} className="text-white" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Empty state */}
                            {folders.length === 0 && files.length === 0 && (
                                <div className="text-center py-16 text-gray-400">
                                    <FolderOpen size={56} className="mx-auto mb-4 opacity-40" />
                                    <p className="text-lg font-medium text-gray-500">Thư mục trống</p>
                                    <p className="text-sm mt-1">Không có file nào trong thư mục này</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        {selectedFiles.length > 0 ? (
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                                <Check size={16} />
                                Đã chọn {selectedFiles.length} file
                            </span>
                        ) : (
                            <span className="text-gray-500">Chọn file để đính kèm</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={selectedFiles.length === 0}
                            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-blue-200"
                        >
                            <Check size={18} />
                            Chọn file
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FilePickerDialog;
