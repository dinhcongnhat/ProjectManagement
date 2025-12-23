import React, { useState, useRef, useEffect } from 'react';
import { FileText, Trash2, CloudUpload, FolderOpen, X, Loader2, Eye, Paperclip, ChevronDown, HardDrive } from 'lucide-react';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from './ui/Dialog';
import { UploadProgressDialog } from './ui/UploadProgressDialog';
import type { UploadFile } from './ui/UploadProgressDialog';
import { FileDownloadButton } from './ui/DownloadOptions';
import { FilePickerDialog } from './ui/FilePickerDialog';
import type { SelectedFile } from './ui/FilePickerDialog';
import { ProjectAttachmentViewer } from './ProjectAttachmentViewer';

interface Attachment {
    id: number;
    name: string;
    minioPath: string;
    fileType: string;
    fileSize: number;
    category: 'TaiLieuDinhKem' | 'NhanVienDinhKem';
    createdAt: string;
    uploadedBy: {
        id: number;
        name: string;
        role: string;
    };
}

interface ProjectAttachmentsProps {
    projectId: number;
    projectName: string;
    projectStatus: string;
    canUpload: boolean;  // Manager, implementer (after completion), or admin
    isImplementer: boolean;
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
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('document') || mimeType.includes('word')) return '📄';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('video')) return '🎬';
    if (mimeType.includes('audio')) return '🎵';
    return '📎';
};

export const ProjectAttachments: React.FC<ProjectAttachmentsProps> = ({
    projectId,
    projectName: _projectName, // eslint-disable-line @typescript-eslint/no-unused-vars
    projectStatus: _projectStatus, // eslint-disable-line @typescript-eslint/no-unused-vars
    canUpload,
    isImplementer,
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
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [showFilePicker, setShowFilePicker] = useState(false);
    const [showUploadDropdown, setShowUploadDropdown] = useState(false);
    const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);

    // Upload progress state
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [uploadFilesList, setUploadFilesList] = useState<UploadFile[]>([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'completed' | 'error'>('idle');

    // Close upload dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (uploadDropdownRef.current && !uploadDropdownRef.current.contains(event.target as Node)) {
                setShowUploadDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch attachments if not provided
    useEffect(() => {
        if (initialAttachments.length === 0) {
            fetchAttachments();
        }
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

    const uploadFiles = async () => {
        if (selectedFiles.length === 0) return;

        // Initialize upload progress dialog
        const filesToUpload: UploadFile[] = selectedFiles.map(f => ({
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
                showSuccess(result.data?.message || `Đã tải lên ${selectedFiles.length} tệp`);
                setSelectedFiles([]);

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

    // Determine if implementer can upload - always allowed now (removed status check)
    const implementerCanUpload = isImplementer && !isAdmin && !isManager;

    const showUploadSection = canUpload || implementerCanUpload;

    // Handle files selected from folder picker
    const handleFolderFilesSelected = async (files: SelectedFile[]) => {
        if (files.length === 0) return;

        // Download each file and add to selectedFiles
        try {
            const downloadedFiles: File[] = [];
            for (const file of files) {
                const response = await fetch(`${API_URL}/folders/files/${file.id}/stream`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.ok) {
                    const blob = await response.blob();
                    const fileObj = new File([blob], file.name, { type: file.mimeType });
                    downloadedFiles.push(fileObj);
                }
            }
            if (downloadedFiles.length > 0) {
                setSelectedFiles(prev => [...prev, ...downloadedFiles]);
            }
        } catch (error) {
            console.error('Error downloading files from folder:', error);
            showError('Lỗi khi tải file từ thư mục');
        }
    };

    return (
        <>
            {/* Upload Progress Dialog */}
            <UploadProgressDialog
                isOpen={showUploadDialog}
                onClose={() => {
                    if (uploadStatus !== 'uploading') {
                        setShowUploadDialog(false);
                    }
                }}
                title={uploadStatus === 'completed' ? 'Tải lên hoàn tất!' : 'Đang tải lên...'}
                files={uploadFilesList}
                totalProgress={uploadProgress}
                status={uploadStatus}
                canClose={uploadStatus !== 'uploading'}
            />

            {/* File Picker Dialog */}
            <FilePickerDialog
                isOpen={showFilePicker}
                onClose={() => setShowFilePicker(false)}
                onSelect={handleFolderFilesSelected}
                token={token || ''}
                multiple={true}
                title="Chọn file từ thư mục cá nhân"
            />

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <FileText size={18} className="text-blue-600" />
                        Tài liệu đính kèm
                        {attachments.length > 0 && (
                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                                {attachments.length}
                            </span>
                        )}
                    </h3>
                </div>

                <div className="p-4 space-y-4">
                    {/* Upload Section */}
                    {showUploadSection && (
                        <div className="flex items-center gap-3">
                            <div className="relative" ref={uploadDropdownRef}>
                                <button
                                    onClick={() => setShowUploadDropdown(!showUploadDropdown)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium transition-colors"
                                    disabled={uploading}
                                >
                                    <Paperclip size={16} />
                                    Đính kèm tài liệu
                                    <ChevronDown size={14} className={`transition-transform ${showUploadDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showUploadDropdown && (
                                    <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-1 min-w-[180px]">
                                        <button
                                            onClick={() => {
                                                setShowUploadDropdown(false);
                                                fileInputRef.current?.click();
                                            }}
                                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm transition-colors"
                                        >
                                            <HardDrive size={16} className="text-blue-500" />
                                            <span className="text-gray-700">Từ máy tính</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowUploadDropdown(false);
                                                setShowFilePicker(true);
                                            }}
                                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm transition-colors"
                                        >
                                            <FolderOpen size={16} className="text-amber-500" />
                                            <span className="text-gray-700">Từ thư mục</span>
                                        </button>
                                    </div>
                                )}

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileSelect}
                                    multiple
                                />
                            </div>
                        </div>
                    )}

                    {/* Selected files */}
                    {selectedFiles.length > 0 && (
                        <div className="w-full mt-2 space-y-2">
                            {selectedFiles.map((file, index) => (
                                <div key={index} className="flex items-center gap-2 text-sm bg-white px-3 py-2 rounded-lg border border-gray-200">
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
                            <div className="flex gap-2">
                                <button
                                    onClick={uploadFiles}
                                    disabled={uploading}
                                    className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
                                    {uploading ? 'Đang tải...' : `Tải lên ${selectedFiles.length} tệp`}
                                </button>
                                <button
                                    onClick={() => setSelectedFiles([])}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm transition-colors"
                                >
                                    Hủy
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="animate-spin text-blue-600" size={24} />
                        </div>
                    )}

                    {/* No attachments */}
                    {!loading && attachments.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            <FileText size={40} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Chưa có tài liệu đính kèm</p>
                        </div>
                    )}

                    {/* Admin Attachments (TaiLieuDinhKem) */}
                    {adminAttachments.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <FolderOpen size={16} className="text-amber-500" />
                                Tài liệu đính kèm ({adminAttachments.length})
                            </h4>
                            <div className="space-y-2">
                                {adminAttachments.map(attachment => (
                                    <AttachmentItem
                                        key={attachment.id}
                                        attachment={attachment}
                                        downloadUrl={`${API_URL}/projects/attachments/${attachment.id}/download`}
                                        token={token || ''}
                                        onView={() => setViewingAttachment(attachment)}
                                        onDelete={() => deleteAttachment(attachment)}
                                        canDelete={isAdmin || isManager}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Employee Attachments (NhanVienDinhKem) */}
                    {employeeAttachments.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <FolderOpen size={16} className="text-green-500" />
                                Nhân viên đính kèm ({employeeAttachments.length})
                            </h4>
                            <div className="space-y-2">
                                {employeeAttachments.map(attachment => (
                                    <AttachmentItem
                                        key={attachment.id}
                                        attachment={attachment}
                                        downloadUrl={`${API_URL}/projects/attachments/${attachment.id}/download`}
                                        token={token || ''}
                                        onView={() => setViewingAttachment(attachment)}
                                        onDelete={() => deleteAttachment(attachment)}
                                        canDelete={isAdmin || isManager}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* OnlyOffice Viewer */}
            {viewingAttachment && (
                <ProjectAttachmentViewer
                    attachmentId={viewingAttachment.id}
                    fileName={viewingAttachment.name}
                    onClose={() => setViewingAttachment(null)}
                    token={token || ''}
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
    const canView = isOfficeFile(attachment.name);

    return (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
            <div
                className={`flex items-center gap-3 flex-1 min-w-0 ${canView ? 'cursor-pointer' : ''}`}
                onClick={canView ? onView : undefined}
                title={canView ? 'Nhấn để xem tài liệu' : undefined}
            >
                <span className="text-2xl">{getFileIcon(attachment.fileType)}</span>
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
                        onClick={onView}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Xem"
                    >
                        <Eye size={16} />
                    </button>
                )}
                <FileDownloadButton
                    fileName={attachment.name}
                    downloadUrl={downloadUrl}
                    token={token}
                    size="sm"
                />
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
