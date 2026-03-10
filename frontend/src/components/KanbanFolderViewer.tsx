import React, { useState, useEffect } from 'react';
import {
    FolderOpen, File, ChevronRight, ChevronDown, X, Download,
    Eye, Loader2, FileText, Image, Film, Music, Archive,
    Trash2
} from 'lucide-react';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';

interface FolderTreeNode {
    name: string;
    type: 'folder' | 'file';
    children?: FolderTreeNode[];
    id?: number;
    fileType?: string;
    fileSize?: number;
    relativePath?: string;
    uploadedBy?: { id: number; name: string };
    createdAt?: string;
}

interface KanbanFolderViewerProps {
    cardId: number;
    folderName: string;
    onClose: () => void;
    onDelete?: () => void;
    canDelete: boolean;
}

const officeExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'pdf', 'txt', 'rtf', 'csv'];

const isOfficeFile = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return officeExtensions.includes(ext);
};

const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getFileIcon = (fileName: string, mimeType?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const type = mimeType || '';

    if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext))
        return <Image size={16} className="text-green-500" />;
    if (type.includes('video') || ['mp4', 'avi', 'mov', 'wmv', 'mkv'].includes(ext))
        return <Film size={16} className="text-purple-500" />;
    if (type.includes('audio') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext))
        return <Music size={16} className="text-pink-500" />;
    if (type.includes('pdf') || ext === 'pdf')
        return <FileText size={16} className="text-red-500" />;
    if (type.includes('spreadsheet') || type.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext))
        return <FileText size={16} className="text-green-600" />;
    if (type.includes('document') || type.includes('word') || ['doc', 'docx'].includes(ext))
        return <FileText size={16} className="text-blue-600" />;
    if (type.includes('presentation') || type.includes('powerpoint') || ['ppt', 'pptx'].includes(ext))
        return <FileText size={16} className="text-orange-500" />;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
        return <Archive size={16} className="text-yellow-600" />;
    return <File size={16} className="text-gray-500" />;
};

const TreeNode: React.FC<{
    node: FolderTreeNode;
    depth: number;
    onViewFile: (fileId: number, fileName: string) => void;
    onDownloadFile: (fileId: number, fileName: string) => void;
}> = ({ node, depth, onViewFile, onDownloadFile }) => {
    const [expanded, setExpanded] = useState(depth < 2);

    if (node.type === 'folder') {
        return (
            <div>
                <div
                    className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                    style={{ paddingLeft: `${depth * 16 + 8}px` }}
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? (
                        <ChevronDown size={14} className="text-gray-400 shrink-0" />
                    ) : (
                        <ChevronRight size={14} className="text-gray-400 shrink-0" />
                    )}
                    <FolderOpen size={16} className="text-amber-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{node.name}</span>
                    {node.children && (
                        <span className="text-xs text-gray-400 shrink-0">
                            ({node.children.filter(c => c.type === 'file').length} tệp
                            {node.children.filter(c => c.type === 'folder').length > 0 &&
                                `, ${node.children.filter(c => c.type === 'folder').length} thư mục`}
                            )
                        </span>
                    )}
                </div>
                {expanded && node.children && (
                    <div>
                        {node.children
                            .sort((a, b) => {
                                if (a.type === 'folder' && b.type !== 'folder') return -1;
                                if (a.type !== 'folder' && b.type === 'folder') return 1;
                                return a.name.localeCompare(b.name);
                            })
                            .map((child, idx) => (
                                <TreeNode
                                    key={`${child.name}-${idx}`}
                                    node={child}
                                    depth={depth + 1}
                                    onViewFile={onViewFile}
                                    onDownloadFile={onDownloadFile}
                                />
                            ))}
                    </div>
                )}
            </div>
        );
    }

    const isImage = node.fileType?.startsWith('image/');
    const canView = isOfficeFile(node.name) || isImage;

    return (
        <div
            className={`flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg group transition-colors ${
                canView ? 'cursor-pointer' : ''
            }`}
            style={{ paddingLeft: `${depth * 16 + 24}px` }}
            onClick={canView && node.id ? () => onViewFile(node.id!, node.name) : undefined}
        >
            {getFileIcon(node.name, node.fileType)}
            <span className={`text-sm truncate flex-1 ${canView ? 'text-blue-600 hover:underline' : 'text-gray-700 dark:text-gray-300'}`}>
                {node.name}
            </span>
            <span className="text-xs text-gray-400 shrink-0">{formatFileSize(node.fileSize || 0)}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {canView && node.id && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewFile(node.id!, node.name); }}
                        className="p-1 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title="Xem"
                    >
                        <Eye size={14} />
                    </button>
                )}
                {node.id && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDownloadFile(node.id!, node.name); }}
                        className="p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        title="Tải xuống"
                    >
                        <Download size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

export const KanbanFolderViewer: React.FC<KanbanFolderViewerProps> = ({
    cardId,
    folderName,
    onClose,
    onDelete,
    canDelete
}) => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [tree, setTree] = useState<FolderTreeNode | null>(null);
    const [totalFiles, setTotalFiles] = useState(0);
    const [totalSize, setTotalSize] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [viewingFile, setViewingFile] = useState<{ id: number; name: string } | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');

    useEffect(() => {
        fetchFolderContents();
    }, [cardId, folderName]);

    const fetchFolderContents = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                `${API_URL}/kanban/cards/${cardId}/attachments/folder/contents?folderName=${encodeURIComponent(folderName)}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.ok) {
                const data = await response.json();
                setTree(data.tree);
                setTotalFiles(data.totalFiles);
                setTotalSize(data.totalSize);
            }
        } catch (error) {
            console.error('Error fetching folder contents:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadZip = async () => {
        setDownloading(true);
        try {
            const response = await fetch(
                `${API_URL}/kanban/cards/${cardId}/attachments/folder/download?folderName=${encodeURIComponent(folderName)}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${folderName}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error downloading ZIP:', error);
        } finally {
            setDownloading(false);
        }
    };

    const handleDeleteFolder = async () => {
        if (!confirm(`Bạn có chắc muốn xóa thư mục "${folderName}" và tất cả ${totalFiles} tệp bên trong?`)) return;

        setDeleting(true);
        try {
            const response = await fetch(`${API_URL}/kanban/cards/${cardId}/attachments/folder`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ folderName })
            });

            if (response.ok) {
                onDelete?.();
                onClose();
            }
        } catch (error) {
            console.error('Error deleting folder:', error);
        } finally {
            setDeleting(false);
        }
    };

    const handleViewFile = async (fileId: number, fileName: string) => {
        try {
            const response = await fetch(`${API_URL}/kanban/attachments/${fileId}/presigned-url`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.url) {
                    setViewingFile({ id: fileId, name: fileName });
                    setPreviewUrl(data.url);
                }
            }
        } catch (error) {
            console.error('Error getting presigned URL:', error);
        }
    };

    const handleDownloadFile = async (fileId: number, fileName: string) => {
        try {
            const response = await fetch(`${API_URL}/kanban/attachments/${fileId}/presigned-url`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.url) {
                    const a = document.createElement('a');
                    a.href = data.url;
                    a.download = fileName;
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            }
        } catch (error) {
            console.error('Error downloading file:', error);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={onClose}>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
                    onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600">
                        <div className="flex items-center gap-3 text-white">
                            <FolderOpen size={22} />
                            <div>
                                <h3 className="font-semibold text-lg">{folderName}</h3>
                                <p className="text-xs text-blue-100">
                                    {totalFiles} tệp • {formatFileSize(totalSize)}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Action Bar */}
                    <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 bg-gray-50/80 dark:bg-gray-900/50 flex-wrap">
                        <button
                            onClick={handleDownloadZip}
                            disabled={downloading}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            Tải về máy (ZIP)
                        </button>
                        {canDelete && (
                            <button
                                onClick={handleDeleteFolder}
                                disabled={deleting}
                                className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs font-medium flex items-center gap-1.5 transition-colors ml-auto disabled:opacity-50"
                            >
                                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Xóa thư mục
                            </button>
                        )}
                    </div>

                    {/* Tree Content */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="animate-spin text-blue-500" size={28} />
                            </div>
                        ) : tree ? (
                            <TreeNode
                                node={tree}
                                depth={0}
                                onViewFile={handleViewFile}
                                onDownloadFile={handleDownloadFile}
                            />
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                <FolderOpen size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Thư mục trống</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* File Preview Modal */}
            {viewingFile && previewUrl && (
                <div className="fixed inset-0 z-[10003] bg-black/80 backdrop-blur-sm flex flex-col"
                    onClick={() => { setViewingFile(null); setPreviewUrl(''); }}>
                    <div className="flex items-center justify-between px-4 py-3 bg-black/40 shrink-0"
                        onClick={e => e.stopPropagation()}>
                        <span className="text-white text-sm font-medium truncate">{viewingFile.name}</span>
                        <button onClick={() => { setViewingFile(null); setPreviewUrl(''); }}
                            className="text-white/80 hover:text-white p-1">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
                        {viewingFile.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ? (
                            <img src={previewUrl} alt={viewingFile.name}
                                className="max-w-full max-h-full object-contain rounded-lg" />
                        ) : viewingFile.name.match(/\.(mp4|webm|ogg)$/i) ? (
                            <video src={previewUrl} controls className="max-w-full max-h-full rounded-lg" />
                        ) : viewingFile.name.match(/\.pdf$/i) ? (
                            <iframe src={previewUrl} className="w-full h-full rounded-lg bg-white" />
                        ) : (
                            <div className="text-white text-center">
                                <p className="mb-4">Không thể xem trước tệp này</p>
                                <a href={previewUrl} download={viewingFile.name}
                                    className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">
                                    Tải xuống
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default KanbanFolderViewer;
