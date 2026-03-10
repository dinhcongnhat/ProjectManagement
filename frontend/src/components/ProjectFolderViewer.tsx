import React, { useState, useEffect } from 'react';
import {
    FolderOpen, File, ChevronRight, ChevronDown, X, Download,
    FolderDown, Eye, Loader2, FileText, Image, Film, Music, Archive,
    Trash2, FolderOpen as FolderIcon
} from 'lucide-react';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from './ui/Dialog';
import { OnlyOfficeViewer } from './OnlyOfficeViewer';
import { ProjectAttachmentViewer } from './ProjectAttachmentViewer';

interface FolderTreeNode {
    name: string;
    type: 'folder' | 'file';
    children?: FolderTreeNode[];
    // File-specific
    id?: number;
    fileType?: string;
    fileSize?: number;
    relativePath?: string;
    uploadedBy?: { id: number; name: string; role: string };
    createdAt?: string;
}

interface ProjectFolderViewerProps {
    projectId: number;
    folderName: string;
    category: string;
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

// Recursive tree node component
const TreeNode: React.FC<{
    node: FolderTreeNode;
    depth: number;
    onViewFile: (fileId: number, fileName: string) => void;
    onDownloadFile: (fileId: number, fileName: string) => void;
    token: string;
}> = ({ node, depth, onViewFile, onDownloadFile, token }) => {
    const [expanded, setExpanded] = useState(depth < 2); // Auto-expand first 2 levels

    if (node.type === 'folder') {
        return (
            <div>
                <div
                    className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                    style={{ paddingLeft: `${depth * 16 + 8}px` }}
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? (
                        <ChevronDown size={14} className="text-gray-400 shrink-0" />
                    ) : (
                        <ChevronRight size={14} className="text-gray-400 shrink-0" />
                    )}
                    <FolderOpen size={16} className="text-amber-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-700 truncate">{node.name}</span>
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
                        {/* Folders first, then files */}
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
                                    token={token}
                                />
                            ))}
                    </div>
                )}
            </div>
        );
    }

    // File node
    const isImage = node.fileType?.startsWith('image/');
    const canView = isOfficeFile(node.name) || isImage;

    return (
        <div
            className={`flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded-lg group transition-colors ${
                canView ? 'cursor-pointer' : ''
            }`}
            style={{ paddingLeft: `${depth * 16 + 24}px` }}
            onClick={canView && node.id ? () => onViewFile(node.id!, node.name) : undefined}
        >
            {getFileIcon(node.name, node.fileType)}
            <span className={`text-sm truncate flex-1 ${canView ? 'text-blue-600 hover:underline' : 'text-gray-700'}`}>
                {node.name}
            </span>
            <span className="text-xs text-gray-400 shrink-0">{formatFileSize(node.fileSize || 0)}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {canView && node.id && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewFile(node.id!, node.name); }}
                        className="p-1 text-blue-500 hover:bg-blue-100 rounded transition-colors"
                        title="Xem"
                    >
                        <Eye size={14} />
                    </button>
                )}
                {node.id && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDownloadFile(node.id!, node.name); }}
                        className="p-1 text-gray-500 hover:bg-gray-200 rounded transition-colors"
                        title="Tải xuống"
                    >
                        <Download size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

export const ProjectFolderViewer: React.FC<ProjectFolderViewerProps> = ({
    projectId,
    folderName,
    category: _category,
    onClose,
    onDelete,
    canDelete
}) => {
    const { token } = useAuth();
    const { showSuccess, showError, showConfirm } = useDialog();
    const [loading, setLoading] = useState(true);
    const [tree, setTree] = useState<FolderTreeNode | null>(null);
    const [totalFiles, setTotalFiles] = useState(0);
    const [totalSize, setTotalSize] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [viewingFile, setViewingFile] = useState<{ id: number; name: string } | null>(null);

    // Save to folder modal
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveFolders, setSaveFolders] = useState<any[]>([]);
    const [saveFolderId, setSaveFolderId] = useState<number | null>(null);
    const [loadingSaveFolders, setLoadingSaveFolders] = useState(false);
    const [saveBreadcrumbs, setSaveBreadcrumbs] = useState<{ id: number | null; name: string }[]>([{ id: null, name: 'Thư mục gốc' }]);

    useEffect(() => {
        fetchFolderContents();
    }, [projectId, folderName]);

    const fetchFolderContents = async () => {
        setLoading(true);
        try {
            const response = await fetch(
                `${API_URL}/projects/${projectId}/attachments/folder/contents?folderName=${encodeURIComponent(folderName)}`,
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
                `${API_URL}/projects/${projectId}/attachments/folder/download?folderName=${encodeURIComponent(folderName)}`,
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
                showSuccess(`Đã tải xuống ${folderName}.zip`);
            } else {
                showError('Lỗi khi tải thư mục');
            }
        } catch (error) {
            console.error('Error downloading ZIP:', error);
            showError('Lỗi khi tải thư mục');
        } finally {
            setDownloading(false);
        }
    };

    const fetchSaveFolders = async (parentId: number | null = null) => {
        setLoadingSaveFolders(true);
        try {
            const url = parentId
                ? `${API_URL}/folders?parentId=${parentId}`
                : `${API_URL}/folders`;
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSaveFolders(data.folders || []);
            }
        } catch (error) {
            console.error('Error fetching folders:', error);
        } finally {
            setLoadingSaveFolders(false);
        }
    };

    const handleOpenSaveModal = () => {
        setShowSaveModal(true);
        setSaveFolderId(null);
        setSaveBreadcrumbs([{ id: null, name: 'Thư mục gốc' }]);
        fetchSaveFolders(null);
    };

    const handleSaveToStorage = async () => {
        setSaving(true);
        try {
            const response = await fetch(`${API_URL}/projects/${projectId}/attachments/folder/save-to-storage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    folderName,
                    targetFolderId: saveFolderId
                })
            });

            if (response.ok) {
                const data = await response.json();
                showSuccess(data.message || 'Đã lưu thư mục về kho lưu trữ');
                setShowSaveModal(false);
            } else {
                const err = await response.json();
                showError(err.message || 'Lỗi khi lưu thư mục');
            }
        } catch (error) {
            console.error('Error saving to storage:', error);
            showError('Lỗi khi lưu thư mục');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteFolder = async () => {
        const confirmed = await showConfirm(
            `Bạn có chắc muốn xóa thư mục "${folderName}" và tất cả ${totalFiles} tệp bên trong?`,
            { title: 'Xóa thư mục' }
        );
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/projects/${projectId}/attachments/folder`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ folderName })
            });

            if (response.ok) {
                showSuccess(`Đã xóa thư mục "${folderName}"`);
                onDelete?.();
                onClose();
            } else {
                const err = await response.json();
                showError(err.message || 'Lỗi khi xóa thư mục');
            }
        } catch (error) {
            console.error('Error deleting folder:', error);
            showError('Lỗi khi xóa thư mục');
        }
    };

    const handleViewFile = (fileId: number, fileName: string) => {
        setViewingFile({ id: fileId, name: fileName });
    };

    const handleDownloadFile = async (fileId: number, fileName: string) => {
        try {
            const response = await fetch(`${API_URL}/projects/attachments/${fileId}/download`, {
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
            showError('Lỗi khi tải tệp');
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600">
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
                    <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50/80 flex-wrap">
                        <button
                            onClick={handleDownloadZip}
                            disabled={downloading}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            Tải về máy (ZIP)
                        </button>
                        <button
                            onClick={handleOpenSaveModal}
                            disabled={saving}
                            className="px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <FolderDown size={14} />}
                            Lưu về kho lưu trữ
                        </button>
                        {canDelete && (
                            <button
                                onClick={handleDeleteFolder}
                                className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs font-medium flex items-center gap-1.5 transition-colors ml-auto"
                            >
                                <Trash2 size={14} />
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
                                token={token || ''}
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

            {/* Save to Folder Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[60vh] flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-amber-50">
                            <h4 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                                <FolderDown size={16} className="text-amber-600" />
                                Chọn thư mục lưu
                            </h4>
                            <button onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Breadcrumbs */}
                        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1 flex-wrap text-xs bg-gray-50">
                            {saveBreadcrumbs.map((crumb, index) => (
                                <React.Fragment key={index}>
                                    {index > 0 && <ChevronRight size={12} className="text-gray-400" />}
                                    <button
                                        onClick={() => {
                                            const target = saveBreadcrumbs[index];
                                            setSaveFolderId(target.id);
                                            setSaveBreadcrumbs(prev => prev.slice(0, index + 1));
                                            fetchSaveFolders(target.id);
                                        }}
                                        className="px-1.5 py-0.5 rounded text-gray-600 hover:text-amber-600 hover:bg-amber-50"
                                    >
                                        {index === 0 ? 'Gốc' : crumb.name}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {loadingSaveFolders ? (
                                <div className="flex justify-center py-6">
                                    <Loader2 className="animate-spin text-amber-500" size={20} />
                                </div>
                            ) : saveFolders.length === 0 ? (
                                <p className="text-center text-sm text-gray-500 py-6">Lưu vào đây</p>
                            ) : (
                                saveFolders.map(folder => (
                                    <div
                                        key={folder.id}
                                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 cursor-pointer"
                                        onClick={() => {
                                            setSaveFolderId(folder.id);
                                            setSaveBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
                                            fetchSaveFolders(folder.id);
                                        }}
                                    >
                                        <FolderIcon size={16} className="text-amber-500" />
                                        <span className="text-sm text-gray-700 truncate">{folder.name}</span>
                                        <ChevronRight size={14} className="text-gray-400 ml-auto" />
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="px-3 py-2.5 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
                            <button
                                onClick={() => setShowSaveModal(false)}
                                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-lg"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSaveToStorage}
                                disabled={saving}
                                className="px-4 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <FolderDown size={12} />}
                                Lưu vào đây
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* File Viewer */}
            {viewingFile && (
                isOfficeFile(viewingFile.name) ? (
                    <OnlyOfficeViewer
                        attachmentId={viewingFile.id}
                        onClose={() => setViewingFile(null)}
                        token={token || ''}
                    />
                ) : (
                    <ProjectAttachmentViewer
                        attachmentId={viewingFile.id}
                        fileName={viewingFile.name}
                        onClose={() => setViewingFile(null)}
                        token={token || ''}
                    />
                )
            )}
        </>
    );
};

export default ProjectFolderViewer;
