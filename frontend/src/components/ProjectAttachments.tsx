import React, { useState, useRef, useEffect } from 'react';
import { googleDriveService } from '../services/googleDriveService';
import { GoogleDriveBrowser } from './GoogleDrive/GoogleDriveBrowser';
import { FileText, Trash2, CloudUpload, FolderOpen, X, Loader2, Eye, Paperclip, ChevronDown, HardDrive, ExternalLink, FolderUp, Download, FolderInput } from 'lucide-react';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from './ui/Dialog';
import { UploadProgressDialog } from './ui/UploadProgressDialog';
import type { UploadFile } from './ui/UploadProgressDialog';
import { FileDownloadButton } from './ui/DownloadOptions';
import { FilePickerDialog } from './ui/FilePickerDialog';
import type { SelectedFile } from './ui/FilePickerDialog';
import { FolderPickerDialog } from './ui/FolderPickerDialog';
import { OnlyOfficeViewer } from './OnlyOfficeViewer';
import { ProjectFolderViewer } from './ProjectFolderViewer';

import { ProjectAttachmentViewer } from './ProjectAttachmentViewer';

interface Attachment {
    id: number;
    name: string;
    minioPath: string;
    fileType: string;
    fileSize: number;
    category: 'TaiLieuDinhKem' | 'NhanVienDinhKem' | 'PhoiHopDinhKem';
    createdAt: string;
    isFolder?: boolean;
    folderName?: string;
    relativePath?: string;
    uploadedBy: {
        id: number;
        name: string;
        role: string;
    };
}

interface DriveLink {
    id: number;
    fileId: string;
    name: string;
    mimeType: string;
    webViewLink: string | null;
    iconLink: string | null;
    resourceType: string;
    addedBy: {
        id: number;
        name: string;
    };
}

interface ProjectAttachmentsProps {
    projectId: number;
    projectName: string;
    projectStatus: string;
    canUpload: boolean;
    isImplementer: boolean;
    isCooperator: boolean;
    isAdmin: boolean;
    isManager: boolean;
    attachments?: Attachment[];
    onRefresh?: () => void;
}

// Office file extensions for OnlyOffice
const officeExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'pdf', 'txt', 'rtf', 'csv'];

const isOfficeFile = (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return officeExtensions.includes(ext);
};

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return 'Link';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('google-drive')) return 'googledrive';
    if (mimeType.includes('folder')) return '📁';

    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('document') || mimeType.includes('word')) return '📄';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('video')) return '🎬';
    if (mimeType.includes('audio')) return '🎵';
    if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('7z')) return '📦';
    return '📎';
};

// SVG Icons for Drive/OneDrive
const GoogleDriveIcon = () => (
    <svg viewBox="0 0 87.3 78" className="w-5 h-5">
        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.9 2.5 3.2 3.3l12.3-21.3-6.5-11.3H4.35C1.8 44.2.35 45.65.35 47.7c0 2.05.9 3.95 2.55 5.5l3.7 13.65z" fill="#0066da" />
        <path d="M43.65 25h13L43.85 3.45c-.8-1.4-1.9-2.5-3.2-3.3l-12.3 21.3 6.5 11.3h15.1c2.55 0 4-1.45 4-3.5 0-2.05-.9-3.95-2.55-5.5l-7.75-18.3z" fill="#00ac47" />
        <path d="M73.55 76.8c1.45-.8 2.5-1.9 3.3-3.2l12.75-22.1c.8-1.45.8-3.05.8-4.5 0-1.45-1-3.05-1.8-4.5l-6.35-11H52.1l11.75 20.35 9.7 25.45z" fill="#ea4335" />
        <path d="M43.65 25H11.55l7.75 13.45L31.6 59.9h30.15l-12.75-22.1-5.35-12.8z" fill="#00832d" />
        <path d="M73.55 76.8 53.4 41.9l-9.75-16.9H13.65L39.8 76.8h33.75z" fill="#2684fc" />
        <path d="M6.6 66.85 20.25 43.2l11.75 20.35-6.15 10.65c-2.05 1.2-4.5 1.2-6.55 0L6.6 66.85z" fill="#ffba00" />
    </svg>
);

interface SelectedLink {
    name: string;
    url: string;
    type: string;
}

export const ProjectAttachments: React.FC<ProjectAttachmentsProps> = ({
    projectId,
    projectName: _projectName,
    projectStatus: _projectStatus,
    canUpload: _canUpload,
    isImplementer,
    isCooperator,
    isAdmin,
    isManager,
    attachments: initialAttachments = [],
    onRefresh
}) => {
    const { token } = useAuth();
    const { showSuccess, showError, showConfirm } = useDialog();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadDropdownRef = useRef<HTMLDivElement>(null);

    const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
    const [driveLinks, setDriveLinks] = useState<DriveLink[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [selectedLinks, setSelectedLinks] = useState<SelectedLink[]>([]);
    const [showFilePicker, setShowFilePicker] = useState(false);
    const [showDriveBrowser, setShowDriveBrowser] = useState(false);
    const [dropdownCategory, setDropdownCategory] = useState<'TaiLieuDinhKem' | 'NhanVienDinhKem' | 'PhoiHopDinhKem' | null>(null);
    const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);

    const [activeCategory, setActiveCategory] = useState<'TaiLieuDinhKem' | 'NhanVienDinhKem' | 'PhoiHopDinhKem'>('TaiLieuDinhKem');

    // Upload progress state
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [uploadFilesList, setUploadFilesList] = useState<UploadFile[]>([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'completed' | 'error'>('idle');

    // Folder states
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [viewingFolder, setViewingFolder] = useState<{ folderName: string; category: string } | null>(null);
    const [pendingFolders, setPendingFolders] = useState<{ files: File[]; folderName: string }[]>([]);

    // Close upload dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (uploadDropdownRef.current && !uploadDropdownRef.current.contains(event.target as Node)) {
                setDropdownCategory(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch attachments if not provided
    useEffect(() => {
        fetchAttachments();
        fetchDriveLinks();
    }, [projectId]);

    useEffect(() => {
        setAttachments(initialAttachments);
    }, [initialAttachments]);

    const fetchAttachments = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/projects/${projectId}/attachments`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setAttachments(data);
            }
        } catch (error) {
            console.error('Error fetching attachments:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDriveLinks = async () => {
        try {
            const links = await googleDriveService.getProjectLinks(projectId);
            setDriveLinks(links);
        } catch (error) {
            console.error('Error fetching drive links:', error);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setSelectedFiles(prev => [...prev, ...newFiles]);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeSelectedFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const removeSelectedLink = (index: number) => {
        setSelectedLinks(prev => prev.filter((_, i) => i !== index));
    };

    const uploadFiles = async () => {
        if (selectedFiles.length === 0 && selectedLinks.length === 0) return;

        // Initialize upload progress dialog
        const filesToUpload: UploadFile[] = [
            ...selectedFiles.map(f => ({
                name: f.name,
                size: f.size,
                progress: 0,
                status: 'pending' as const
            })),
            ...selectedLinks.map(l => ({
                name: l.name,
                size: 0,
                progress: 0,
                status: 'pending' as const
            }))
        ];

        setUploadFilesList(filesToUpload);
        setUploadProgress(0);
        setUploadStatus('uploading');
        setShowUploadDialog(true);
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('category', activeCategory);

            selectedFiles.forEach(file => {
                formData.append('files', file);
            });

            // Use XMLHttpRequest for progress tracking
            const xhr = new XMLHttpRequest();

            const uploadPromise = new Promise<{ ok: boolean, data?: any, message?: string }>((resolve, reject) => {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        setUploadProgress(percentComplete);

                        // Update all files progress
                        setUploadFilesList(prev => prev.map(f => ({
                            ...f,
                            progress: percentComplete,
                            status: percentComplete < 100 ? 'uploading' : 'completed'
                        })));
                    }
                });

                xhr.addEventListener('load', () => {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve({ ok: true, data: response });
                        } else {
                            resolve({ ok: false, message: response.message || 'Lỗi không xác định' });
                        }
                    } catch {
                        resolve({ ok: false, message: 'Lỗi phản hồi từ server' });
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new Error('Lỗi kết nối mạng'));
                });

                xhr.open('POST', `${API_URL}/projects/${projectId}/attachments`);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.send(formData);
            });

            const result = await uploadPromise;

            if (result.ok) {
                setUploadStatus('completed');
                setUploadFilesList(prev => prev.map(f => ({ ...f, status: 'completed', progress: 100 })));
                showSuccess(result.data?.message || `Đã thêm ${filesToUpload.length} tệp`);
                setSelectedFiles([]);
                setSelectedLinks([]);

                // Wait a moment then close and refresh
                setTimeout(() => {
                    setShowUploadDialog(false);
                    fetchAttachments();
                    onRefresh?.();
                }, 1000);
            } else {
                setUploadStatus('error');
                setUploadFilesList(prev => prev.map(f => ({ ...f, status: 'error', error: result.message })));
                showError(result.message || 'Lỗi khi tải tệp');
            }
        } catch (error) {
            console.error('Error uploading files:', error);
            setUploadStatus('error');
            setUploadFilesList(prev => prev.map(f => ({
                ...f,
                status: 'error',
                error: error instanceof Error ? error.message : 'Có lỗi xảy ra'
            })));
            showError('Lỗi khi tải tệp lên');
        } finally {
            setUploading(false);
        }
    };

    const deleteAttachment = async (attachment: Attachment) => {
        const confirmed = await showConfirm(
            `Bạn có chắc muốn xóa "${attachment.name}"?`,
            { title: 'Xóa tệp đính kèm' }
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/projects/${projectId}/attachments/${attachment.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                showSuccess('Đã xóa tệp đính kèm');
                setAttachments(prev => prev.filter(a => a.id !== attachment.id));
                onRefresh?.();
            } else {
                const data = await response.json();
                showError(data.message || 'Lỗi khi xóa tệp');
            }
        } catch (error) {
            console.error('Error deleting attachment:', error);
            showError('Lỗi khi xóa tệp');
        }
    };

    // Group attachments by category
    const adminAttachments = attachments.filter(a => a.category === 'TaiLieuDinhKem');
    const employeeAttachments = attachments.filter(a => a.category === 'NhanVienDinhKem');
    const cooperatorAttachments = attachments.filter(a => a.category === 'PhoiHopDinhKem');

    // Handle files selected from folder picker
    const handleFolderFilesSelected = async (files: SelectedFile[]) => {
        if (files.length === 0) return;

        setUploading(true);
        try {
            const fileIds = files.map(f => f.id);
            const response = await fetch(`${API_URL}/projects/${projectId}/attachments/from-folder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    fileIds,
                    category: activeCategory
                })
            });

            if (response.ok) {
                const data = await response.json();
                showSuccess(data.message || 'Đã đính kèm file từ thư mục');
                setShowFilePicker(false);
                fetchAttachments();
                onRefresh?.();
            } else {
                const err = await response.json();
                showError(err.message || 'Lỗi khi đính kèm từ thư mục');
            }
        } catch (error) {
            console.error('Error attaching from folder:', error);
            showError('Lỗi kết nối khi đính kèm từ thư mục');
        } finally {
            setUploading(false);
        }
    };

    // Upload folder from device
    const uploadFolderFiles = async (files: File[], folderName: string) => {
        if (files.length === 0) return;

        const filesToUpload: UploadFile[] = files.map(f => ({
            name: f.name,
            size: f.size,
            progress: 0,
            status: 'pending' as const
        }));

        setUploadFilesList(filesToUpload);
        setUploadProgress(0);
        setUploadStatus('uploading');
        setShowUploadDialog(true);
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('category', activeCategory);
            formData.append('folderName', folderName);

            // Build relative paths from webkitRelativePath
            const relativePaths: string[] = [];
            files.forEach(file => {
                formData.append('files', file);
                // webkitRelativePath = "folderName/subfolder/file.txt"
                // We want the relative path WITHOUT the root folder name
                const fullPath = (file as any).webkitRelativePath || file.name;
                const parts = fullPath.split('/');
                // Remove the root folder part (first segment)
                const relPath = parts.length > 1 ? parts.slice(1).join('/') : file.name;
                relativePaths.push(relPath);
            });
            formData.append('relativePaths', JSON.stringify(relativePaths));

            const xhr = new XMLHttpRequest();
            const uploadPromise = new Promise<{ ok: boolean; data?: any; message?: string }>((resolve, reject) => {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        setUploadProgress(percentComplete);
                        setUploadFilesList(prev => prev.map(f => ({
                            ...f,
                            progress: percentComplete,
                            status: percentComplete < 100 ? 'uploading' : 'completed'
                        })));
                    }
                });

                xhr.addEventListener('load', () => {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve({ ok: true, data: response });
                        } else {
                            resolve({ ok: false, message: response.message || 'Lỗi không xác định' });
                        }
                    } catch {
                        resolve({ ok: false, message: 'Lỗi phản hồi từ server' });
                    }
                });

                xhr.addEventListener('error', () => reject(new Error('Lỗi kết nối mạng')));

                xhr.open('POST', `${API_URL}/projects/${projectId}/attachments/folder`);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.send(formData);
            });

            const result = await uploadPromise;

            if (result.ok) {
                setUploadStatus('completed');
                setUploadFilesList(prev => prev.map(f => ({ ...f, status: 'completed', progress: 100 })));
                showSuccess(result.data?.message || `Đã tải lên thư mục "${folderName}"`);
                setPendingFolders(prev => prev.filter(f => f.folderName !== folderName));
                setSelectedFiles([]);

                setTimeout(() => {
                    setShowUploadDialog(false);
                    fetchAttachments();
                    onRefresh?.();
                }, 1000);
            } else {
                setUploadStatus('error');
                setUploadFilesList(prev => prev.map(f => ({ ...f, status: 'error', error: result.message })));
                showError(result.message || 'Lỗi khi tải thư mục');
            }
        } catch (error) {
            console.error('Error uploading folder:', error);
            setUploadStatus('error');
            setUploadFilesList(prev => prev.map(f => ({
                ...f, status: 'error',
                error: error instanceof Error ? error.message : 'Có lỗi xảy ra'
            })));
            showError('Lỗi khi tải thư mục lên');
        } finally {
            setUploading(false);
        }
    };

    // Handle folder selected from personal storage (Kho dữ liệu)
    const handleStorageFolderSelected = async (folder: { id: number; name: string }) => {
        setUploading(true);
        setShowFolderPicker(false);
        try {
            const response = await fetch(`${API_URL}/projects/${projectId}/attachments/folder-from-storage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    folderId: folder.id,
                    category: activeCategory
                })
            });

            if (response.ok) {
                const data = await response.json();
                showSuccess(data.message || `Đã đính kèm thư mục "${folder.name}"`);
                fetchAttachments();
                onRefresh?.();
            } else {
                const err = await response.json();
                showError(err.message || 'Lỗi khi đính kèm thư mục');
            }
        } catch (error) {
            console.error('Error attaching folder from storage:', error);
            showError('Lỗi khi đính kèm thư mục từ kho dữ liệu');
        } finally {
            setUploading(false);
        }
    };

    const renderSection = (
        title: string,
        category: 'TaiLieuDinhKem' | 'NhanVienDinhKem' | 'PhoiHopDinhKem',
        folderColor: string,
        sectionAttachments: Attachment[],
        allowUpload: boolean
    ) => {
        const isDropdownOpen = dropdownCategory === category;
        const hasSelectedFiles = activeCategory === category && (selectedFiles.length > 0 || selectedLinks.length > 0);
        const hasPendingFolder = activeCategory === category && pendingFolders.length > 0;

        const handleUploadClick = () => {
            if (isDropdownOpen) {
                setDropdownCategory(null);
            } else {
                setDropdownCategory(category);
                setActiveCategory(category as any);
            }
        };

        return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <FolderOpen size={18} className={folderColor} />
                        {title}
                        {sectionAttachments.length > 0 && (
                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                                {sectionAttachments.length}
                            </span>
                        )}
                    </h3>

                    {allowUpload && (
                        <div className="relative" ref={isDropdownOpen ? uploadDropdownRef : null}>
                            <button
                                onClick={handleUploadClick}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium transition-colors"
                                disabled={uploading}
                            >
                                <Paperclip size={14} />
                                Đính kèm
                                <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isDropdownOpen && (
                                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-1 min-w-[200px]">
                                    <button
                                        onClick={() => {
                                            setDropdownCategory(null);
                                            // Handle folder selection - upload as folder structure
                                            const folderInput = document.createElement('input');
                                            folderInput.type = 'file';
                                            folderInput.setAttribute('webkitdirectory', '');
                                            folderInput.setAttribute('directory', '');
                                            folderInput.multiple = true;
                                            folderInput.style.display = 'none';
                                            folderInput.onchange = (e) => {
                                                const target = e.target as HTMLInputElement;
                                                if (target.files && target.files.length > 0) {
                                                    const newFiles = Array.from(target.files);
                                                    // Extract folder name from webkitRelativePath
                                                    const firstPath = (newFiles[0] as any).webkitRelativePath || '';
                                                    const rootFolderName = firstPath.split('/')[0] || 'Unnamed';
                                                    setPendingFolders(prev => [...prev, { files: newFiles, folderName: rootFolderName }]);
                                                }
                                            };
                                            folderInput.click();
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm transition-colors"
                                    >
                                        <FolderUp size={16} className="text-indigo-500" />
                                        <span className="text-gray-700">Thư mục từ thiết bị</span>
                                    </button>
                                    <div className="border-t border-gray-100 my-1"></div>
                                    <p className="px-3 py-1 text-xs text-gray-400 font-medium uppercase tracking-wider">File đơn lẻ</p>
                                    <button
                                        onClick={() => {
                                            setDropdownCategory(null);
                                            fileInputRef.current?.click();
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm transition-colors"
                                    >
                                        <HardDrive size={16} className="text-blue-500" />
                                        <span className="text-gray-700">File từ thiết bị</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDropdownCategory(null);
                                            setShowFilePicker(true);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm transition-colors"
                                    >
                                        <FolderOpen size={16} className="text-amber-500" />
                                        <span className="text-gray-700">File từ Kho dữ liệu</span>
                                    </button>
                                    <div className="border-t border-gray-100 my-1"></div>
                                    <p className="px-3 py-1 text-xs text-gray-400 font-medium uppercase tracking-wider">Thư mục</p>
                                    <button
                                        onClick={() => {
                                            setDropdownCategory(null);
                                            setShowFolderPicker(true);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm transition-colors"
                                    >
                                        <FolderInput size={16} className="text-amber-600" />
                                        <span className="text-gray-700">Thư mục từ Kho dữ liệu</span>
                                    </button>
                                    <div className="border-t border-gray-100 my-1"></div>
                                    <button
                                        onClick={() => {
                                            setDropdownCategory(null);
                                            setShowDriveBrowser(true);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm transition-colors"
                                    >
                                        <GoogleDriveIcon />
                                        <span className="text-gray-700">Google Drive</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 space-y-4">
                    {/* Pending Folder Upload Area */}
                    {hasPendingFolder && pendingFolders.length > 0 && (
                        <div className="w-full mb-4 space-y-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-200">
                            {pendingFolders.map((pendingFolder, folderIdx) => (
                                <div key={`pending-folder-${folderIdx}`} className="flex items-center gap-2 text-sm bg-white px-3 py-2.5 rounded-lg border border-indigo-200">
                                    <FolderUp size={18} className="text-indigo-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-indigo-700 truncate">📁 {pendingFolder.folderName}</p>
                                        <p className="text-xs text-gray-500">{pendingFolder.files.length} tệp • {formatFileSize(pendingFolder.files.reduce((sum, f) => sum + f.size, 0))}</p>
                                    </div>
                                    <button
                                        onClick={() => setPendingFolders(prev => prev.filter((_, i) => i !== folderIdx))}
                                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={async () => {
                                        for (const pf of pendingFolders) {
                                            await uploadFolderFiles(pf.files, pf.folderName);
                                        }
                                    }}
                                    disabled={uploading}
                                    className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <FolderUp size={16} />}
                                    {uploading ? 'Đang tải...' : `Tải ${pendingFolders.length} thư mục lên`}
                                </button>
                                <button
                                    onClick={() => setPendingFolders([])}
                                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm transition-colors"
                                >
                                    Hủy
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Selected Files Area */
                        hasSelectedFiles && (
                            <div className="w-full mb-4 space-y-2 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                {selectedFiles.map((file, index) => (
                                    <div key={`file-${index}`} className="flex items-center gap-2 text-sm bg-white px-3 py-2 rounded-lg border border-gray-200">
                                        <span className="text-lg">{getFileIcon(file.type)}</span>
                                        <span className="flex-1 truncate">{file.name}</span>
                                        <span className="text-gray-400 text-xs">{formatFileSize(file.size)}</span>
                                        <button
                                            onClick={() => removeSelectedFile(index)}
                                            className="p-1 text-gray-400 hover:text-red-500 rounded"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                                {selectedLinks.map((link, index) => (
                                    <div key={`link-${index}`} className="flex items-center gap-2 text-sm bg-white px-3 py-2 rounded-lg border border-gray-200">
                                        <span className="text-lg">
                                            <GoogleDriveIcon />
                                        </span>
                                        <span className="flex-1 truncate text-blue-600">{link.name}</span>
                                        <span className="text-gray-400 text-xs">Link</span>
                                        <button
                                            onClick={() => removeSelectedLink(index)}
                                            className="p-1 text-gray-400 hover:text-red-500 rounded"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}

                                <div className="flex gap-2 mt-2">
                                    <button
                                        onClick={uploadFiles}
                                        disabled={uploading}
                                        className="flex-1 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {uploading ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
                                        {uploading ? 'Đang tải...' : 'Tải lên ngay'}
                                    </button>
                                    <button
                                        onClick={() => { setSelectedFiles([]); setSelectedLinks([]); }}
                                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm transition-colors"
                                    >
                                        Hủy
                                    </button>
                                </div>
                            </div>
                        )}

                    {/* Loading or Empty for Local Attachments */}
                    {loading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="animate-spin text-blue-600" size={20} />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Folder Groups */}
                            {(() => {
                                const folderAttachments = sectionAttachments.filter(a => a.isFolder && a.folderName);
                                const folderNames = [...new Set(folderAttachments.map(a => a.folderName!))];
                                const individualAttachments = sectionAttachments.filter(a => !a.isFolder);
                                return (
                                    <>
                                        {/* Render folder groups */}
                                        {folderNames.length > 0 && (
                                            <div className="space-y-2">
                                                {folderNames.map(fname => {
                                                    const folderFiles = folderAttachments.filter(a => a.folderName === fname);
                                                    const totalSize = folderFiles.reduce((sum, f) => sum + f.fileSize, 0);
                                                    const uploader = folderFiles[0]?.uploadedBy;
                                                    const uploadDate = folderFiles[0]?.createdAt;
                                                    return (
                                                        <div
                                                            key={`folder-${fname}`}
                                                            className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-lg hover:bg-indigo-100 transition-colors group cursor-pointer border border-indigo-100"
                                                            onClick={() => setViewingFolder({ folderName: fname, category })}
                                                        >
                                                            <div className="shrink-0 flex items-center justify-center w-8">
                                                                <span className="text-2xl">📁</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-indigo-700 hover:underline truncate">
                                                                    {fname}
                                                                </p>
                                                                <p className="text-xs text-gray-500">
                                                                    {folderFiles.length} tệp • {formatFileSize(totalSize)}
                                                                    {uploader && <> • {uploader.name}</>}
                                                                    {uploadDate && (
                                                                        <span className="text-gray-400 ml-2">
                                                                            {new Date(uploadDate).toLocaleDateString('vi-VN')}
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setViewingFolder({ folderName: fname, category });
                                                                    }}
                                                                    className="p-2 text-indigo-600 hover:bg-indigo-200 rounded-lg transition-colors"
                                                                    title="Xem thư mục"
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        try {
                                                                            const response = await fetch(
                                                                                `${API_URL}/projects/${projectId}/attachments/folder/download?folderName=${encodeURIComponent(fname)}`,
                                                                                { headers: { Authorization: `Bearer ${token}` } }
                                                                            );
                                                                            if (response.ok) {
                                                                                const blob = await response.blob();
                                                                                const url = window.URL.createObjectURL(blob);
                                                                                const a = document.createElement('a');
                                                                                a.href = url;
                                                                                a.download = `${fname}.zip`;
                                                                                document.body.appendChild(a);
                                                                                a.click();
                                                                                document.body.removeChild(a);
                                                                                window.URL.revokeObjectURL(url);
                                                                            }
                                                                        } catch (err) {
                                                                            console.error('Error downloading folder:', err);
                                                                        }
                                                                    }}
                                                                    className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                                                    title="Tải xuống ZIP"
                                                                >
                                                                    <Download size={16} />
                                                                </button>
                                                                {(isAdmin || isManager || (uploader && uploader.id === (useAuth().user?.id || 0))) && (
                                                                    <button
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            const confirmed = await showConfirm(
                                                                                `Bạn có chắc muốn xóa thư mục "${fname}" (${folderFiles.length} tệp)?`,
                                                                                { title: 'Xóa thư mục' }
                                                                            );
                                                                            if (confirmed) {
                                                                                try {
                                                                                    const response = await fetch(`${API_URL}/projects/${projectId}/attachments/folder`, {
                                                                                        method: 'DELETE',
                                                                                        headers: {
                                                                                            'Content-Type': 'application/json',
                                                                                            Authorization: `Bearer ${token}`
                                                                                        },
                                                                                        body: JSON.stringify({ folderName: fname })
                                                                                    });
                                                                                    if (response.ok) {
                                                                                        showSuccess(`Đã xóa thư mục "${fname}"`);
                                                                                        fetchAttachments();
                                                                                        onRefresh?.();
                                                                                    }
                                                                                } catch (err) {
                                                                                    showError('Lỗi khi xóa thư mục');
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                                        title="Xóa thư mục"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Individual Attachments */}
                                        <div className="space-y-2">
                                            {individualAttachments.map(attachment => (
                                                <AttachmentItem
                                                    key={attachment.id}
                                                    attachment={attachment}
                                                    downloadUrl={`${API_URL}/projects/attachments/${attachment.id}/download`}
                                                    token={token || ''}
                                                    onView={() => setViewingAttachment(attachment)}
                                                    onDelete={() => deleteAttachment(attachment)}
                                                    canDelete={isAdmin || isManager || (attachment.uploadedBy.id === (useAuth().user?.id || 0))}
                                                />
                                            ))}
                                        </div>
                                    </>
                                );
                            })()}

                            {/* Google Drive Links - integrated here if category matches or separate section? 
                                Requirements say "Tree combined".
                                For now, I'll list them here if they belong to "Project Documents" conceptually.
                                Or I can add a dedicated section for Drive Links.
                                Let's list them if this is the "Documents" section (admin/manager stuff) or if we put all drive links in one place.
                                I'll render them in the "Project Documents" section (TaiLieuDinhKem).
                            */}
                            {category === 'TaiLieuDinhKem' && driveLinks.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <GoogleDriveIcon />
                                        Google Drive Links
                                    </h4>
                                    <div className="space-y-2">
                                        {driveLinks.map(link => (
                                            <div key={link.id} className="flex items-center gap-3 p-3 bg-blue-50/30 rounded-lg hover:bg-blue-50 transition-colors group border border-dashed border-blue-200">
                                                <div className="shrink-0 flex items-center justify-center w-8">
                                                    {link.iconLink ? <img src={link.iconLink} className="w-5 h-5" alt="" /> : <GoogleDriveIcon />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <a href={link.webViewLink || '#'} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-700 hover:underline truncate block">
                                                        {link.name}
                                                    </a>
                                                    <p className="text-xs text-gray-500">
                                                        {link.resourceType === 'folder' ? 'Folder' : 'File'} • Added by {link.addedBy.name}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <a
                                                        href={link.webViewLink || '#'}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                        title="Open in Drive"
                                                    >
                                                        <ExternalLink size={16} />
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {sectionAttachments.length === 0 && (category !== 'TaiLieuDinhKem' || driveLinks.length === 0) && (
                                <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-100 rounded-lg bg-gray-50/50">
                                    <FileText size={32} className="mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">Chưa có tài liệu đính kèm</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            <UploadProgressDialog
                isOpen={showUploadDialog}
                onClose={() => {
                    if (uploadStatus !== 'uploading') {
                        setShowUploadDialog(false);
                        setUploadStatus('idle');
                    }
                }}
                title={uploadStatus === 'completed' ? 'Tải lên hoàn tất!' : 'Đang tải lên...'}
                files={uploadFilesList}
                totalProgress={uploadProgress}
                status={uploadStatus}
                canClose={uploadStatus !== 'uploading'}
            />

            <FilePickerDialog
                isOpen={showFilePicker}
                onClose={() => setShowFilePicker(false)}
                onSelect={handleFolderFilesSelected}
                token={token || ''}
                multiple={true}
                title="Chọn file từ thư mục cá nhân"
            />

            {showDriveBrowser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-4xl max-h-[85vh] shadow-2xl">
                        <GoogleDriveBrowser
                            projectId={undefined} // Don't pass projectId to avoid default link mode logic inside component if explicit mode wasn't enough (though explicit mode overrides)
                            mode="select"
                            onSelectFiles={(files) => {
                                setSelectedFiles(prev => [...prev, ...files]);
                                setShowDriveBrowser(false);
                            }}
                            onClose={() => setShowDriveBrowser(false)}
                        />
                    </div>
                </div>
            )}

            <FolderPickerDialog
                isOpen={showFolderPicker}
                onClose={() => setShowFolderPicker(false)}
                onSelect={handleStorageFolderSelected}
                token={token || ''}
                title="Chọn thư mục từ kho dữ liệu"
            />

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
                multiple
            />

            {/* Render Project Documents (Admin Attachments) */}
            {renderSection(
                'Tài liệu dự án',
                'TaiLieuDinhKem',
                'text-amber-500',
                adminAttachments,
                isAdmin || isManager
            )}

            {/* Render Implementer Results (Employee Attachments) */}
            {renderSection(
                'Báo cáo kết quả (Người thực hiện)',
                'NhanVienDinhKem',
                'text-green-500',
                employeeAttachments,
                isImplementer || isAdmin || isManager
            )}

            {/* Render Cooperator Attachments */}
            {renderSection(
                'Báo cáo kết quả (Phối hợp thực hiện)',
                'PhoiHopDinhKem',
                'text-purple-500',
                cooperatorAttachments,
                isCooperator || isAdmin || isManager
            )}

            {/* OnlyOffice Viewer / Image Viewer */}
            {viewingAttachment && (
                isOfficeFile(viewingAttachment.name) ? (
                    <OnlyOfficeViewer
                        attachmentId={viewingAttachment.id}
                        onClose={() => setViewingAttachment(null)}
                        token={token || ''}
                    />
                ) : (
                    <ProjectAttachmentViewer
                        attachmentId={viewingAttachment.id}
                        fileName={viewingAttachment.name}
                        onClose={() => setViewingAttachment(null)}
                        token={token || ''}
                    />
                )
            )}

            {/* Folder Viewer */}
            {viewingFolder && (
                <ProjectFolderViewer
                    projectId={projectId}
                    folderName={viewingFolder.folderName}
                    category={viewingFolder.category}
                    onClose={() => setViewingFolder(null)}
                    onDelete={() => {
                        fetchAttachments();
                        onRefresh?.();
                    }}
                    canDelete={isAdmin || isManager}
                />
            )}
        </>
    );
};

// Attachment Item Component
interface AttachmentItemProps {
    attachment: Attachment;
    downloadUrl: string;
    token: string;
    onView: () => void;
    onDelete: () => void;
    canDelete: boolean;
}

const AttachmentItem: React.FC<AttachmentItemProps> = ({
    attachment,
    downloadUrl,
    token,
    onView,
    onDelete,
    canDelete
}) => {
    // Detect if external link
    const isLink = attachment.minioPath.startsWith('LINK:');
    const getIcon = () => {
        if (attachment.fileType.includes('google-drive')) return <GoogleDriveIcon />;

        const emoji = getFileIcon(attachment.fileType);
        return <span className="text-2xl">{emoji}</span>;
    };

    const handleView = () => {
        if (isLink) {
            // Extract URL and open
            const url = attachment.minioPath.substring(5);
            window.open(url, '_blank');
        } else {
            onView();
        }
    };

    // Check if image
    const isImage = attachment.fileType.startsWith('image/');

    // For local files, check compatibility
    const canView = isLink || isOfficeFile(attachment.name) || isImage;

    return (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
            <div
                className={`flex items-center gap-3 flex-1 min-w-0 ${canView ? 'cursor-pointer' : ''}`}
                onClick={canView ? handleView : undefined}
                title={canView ? 'Nhấn để xem tài liệu' : undefined}
            >
                <div className="shrink-0 flex items-center justify-center w-8">
                    {getIcon()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${canView ? 'text-blue-600 hover:text-blue-800 hover:underline' : 'text-gray-800'}`}>
                        {attachment.name}
                    </p>
                    <p className="text-xs text-gray-500">
                        {formatFileSize(attachment.fileSize)} • {attachment.uploadedBy.name}
                        <span className="text-gray-400 ml-2">
                            {new Date(attachment.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {canView && (
                    <button
                        onClick={handleView}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title={isLink ? "Mở liên kết" : "Xem"}
                    >
                        {isLink ? <ExternalLink size={16} /> : <Eye size={16} />}
                    </button>
                )}
                {!isLink && (
                    <FileDownloadButton
                        fileName={attachment.name}
                        downloadUrl={downloadUrl}
                        token={token}
                        size="sm"
                    />
                )}
                {canDelete && (
                    <button
                        onClick={onDelete}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Xóa"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default ProjectAttachments;
