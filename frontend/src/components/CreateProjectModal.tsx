import React, { useState, useEffect, useRef } from 'react';
import { Calendar, X, ChevronDown, Check, CloudUpload, FolderTree, Loader2, FolderOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { useDialog } from './ui/Dialog';
import { UploadProgressDialog } from './ui/UploadProgressDialog';
import type { UploadFile } from './ui/UploadProgressDialog';
import { useCloudStoragePicker } from '../hooks/useCloudStoragePicker';
import { FilePickerDialog } from './ui/FilePickerDialog';
import type { SelectedFile } from './ui/FilePickerDialog';

interface UserData {
    id: number;
    name: string;
    role: string;
}

interface ParentProject {
    id: number;
    code: string;
    name: string;
    children?: Array<{ id: number }>;
}

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

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    parentId?: number | null;
}

export const CreateProjectModal = ({ isOpen, onClose, onSuccess, parentId }: CreateProjectModalProps) => {
    const { token } = useAuth();
    const { showSuccess, showError } = useDialog();

    const [users, setUsers] = useState<UserData[]>([]);
    const [parentProject, setParentProject] = useState<ParentProject | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const [formData, setFormData] = useState({
        codeNumber: '',
        name: '',
        investor: '',
        startDate: '',
        endDate: '',
        duration: '',
        group: '',
        value: '',
        managerId: '',
        implementerIds: [] as string[],
        cooperatorIds: [] as string[],
        description: '',
        parentId: parentId || '',
        priority: 'NORMAL' // Default priority
    });

    const CODE_PREFIX = 'DA2026';
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [showFilePicker, setShowFilePicker] = useState(false);
    const [selectedLinks, setSelectedLinks] = useState<{ name: string; url: string; type: string }[]>([]);

    // Cloud Storage Picker
    const { openGoogleDrivePicker } = useCloudStoragePicker({
        onSelect: (file: any) => {
            setSelectedLinks(prev => [...prev, {
                name: file.name,
                url: file.url,
                type: file.type || 'google-drive'
            }]);
        },
        onError: (error) => {
            showError(error);
        }
    });

    // Upload Progress State
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'completed' | 'error'>('idle');

    useEffect(() => {
        if (!isOpen) return;

        const fetchUsers = async () => {
            try {
                const response = await fetch(`${API_URL}/users`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        setUsers(data);
                    }
                }
            } catch (error) {
                console.error('Error fetching users:', error);
            }
        };

        const fetchParentProject = async () => {
            if (!parentId) return;
            try {
                const response = await fetch(`${API_URL}/projects/${parentId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (response.ok) {
                    const data = await response.json();
                    setParentProject({
                        id: data.id,
                        code: data.code,
                        name: data.name,
                        children: data.children || []
                    });

                    // Auto-populate users from parent for child projects
                    setFormData(prev => ({
                        ...prev,
                        managerId: data.manager?.id ? String(data.manager.id) : prev.managerId,
                        implementerIds: data.implementers?.map((u: any) => String(u.id)) || [],
                        cooperatorIds: data.cooperators?.map((u: any) => String(u.id)) || []
                    }));
                }
            } catch (error) {
                console.error('Error fetching parent project:', error);
            }
        };

        if (token) {
            fetchUsers();
            fetchParentProject();
        }
    }, [isOpen, token, parentId]);

    // Auto-calculate duration
    useEffect(() => {
        if (formData.startDate && formData.endDate) {
            const start = new Date(formData.startDate);
            const end = new Date(formData.endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setFormData(prev => ({ ...prev, duration: diffDays.toString() }));
        }
    }, [formData.startDate, formData.endDate]);

    const formatCurrency = (value: string) => {
        const number = value.replace(/\D/g, '');
        return number.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'value') {
            setFormData(prev => ({ ...prev, [name]: formatCurrency(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleMultiSelectChange = (name: 'implementerIds' | 'cooperatorIds', userId: string) => {
        setFormData(prev => {
            const currentIds = prev[name];
            if (currentIds.includes(userId)) {
                return { ...prev, [name]: currentIds.filter(id => id !== userId) };
            } else {
                return { ...prev, [name]: [...currentIds, userId] };
            }
        });
    };

    const handleSubmit = async () => {
        if (!parentProject && !formData.codeNumber.trim()) {
            showError('Vui lòng nhập mã dự án');
            return;
        }
        if (!formData.name.trim()) {
            showError('Vui lòng nhập tên công việc/dự án');
            return;
        }
        // For child project, managerId is auto-populated, so check matches logic
        if (!formData.managerId) {
            showError('Vui lòng chọn quản trị dự án');
            return;
        }

        setIsCreating(true);

        const filesToUpload: UploadFile[] = selectedFiles.map(f => ({
            name: f.name,
            size: f.size,
            progress: 0,
            status: 'pending' as const
        }));

        const linksToUpload: UploadFile[] = selectedLinks.map(l => ({
            name: l.name,
            size: 0,
            progress: 0,
            status: 'pending' as const
        }));

        if (selectedFiles.length > 0 || selectedLinks.length > 0) {
            setUploadFiles([...filesToUpload, ...linksToUpload]);
            setUploadProgress(0);
            setUploadStatus('uploading');
            setShowUploadDialog(true);
        }

        try {
            let projectCode = '';
            if (parentProject) {
                const childCount = parentProject.children?.length || 0;
                projectCode = `${parentProject.code}.${String(childCount + 1).padStart(2, '0')}`;
            } else {
                projectCode = CODE_PREFIX + ' - ' + formData.codeNumber;
            }

            const projectData: Record<string, any> = {
                code: projectCode,
                name: formData.name,
                investor: parentProject ? '' : formData.investor,
                startDate: formData.startDate,
                endDate: formData.endDate,
                duration: parentProject ? '' : formData.duration,
                group: parentProject ? '' : formData.group,
                value: parentProject ? '' : formData.value,
                managerId: formData.managerId,
                description: formData.description,
                parentId: formData.parentId || parentId,
                implementerIds: JSON.stringify(formData.implementerIds),
                cooperatorIds: JSON.stringify(formData.cooperatorIds),
                priority: formData.priority,
            };

            const createResponse = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            });

            if (!createResponse.ok) {
                const errorData = await createResponse.json();
                throw new Error(errorData.message || 'Không thể tạo dự án');
            }

            const createdProject = await createResponse.json();

            if (selectedFiles.length > 0 || selectedLinks.length > 0) {
                const filesFormData = new FormData();
                selectedFiles.forEach(file => {
                    filesFormData.append('files', file);
                });

                if (selectedLinks.length > 0) {
                    filesFormData.append('links', JSON.stringify(selectedLinks));
                }

                const xhr = new XMLHttpRequest();
                await new Promise<void>((resolve) => {
                    xhr.upload.addEventListener('progress', (event) => {
                        if (event.lengthComputable) {
                            const percentComplete = Math.round((event.loaded / event.total) * 100);
                            setUploadProgress(percentComplete);
                            setUploadFiles(prev => prev.map(f => ({
                                ...f,
                                progress: percentComplete,
                                status: percentComplete < 100 ? 'uploading' : 'completed'
                            })));
                        }
                    });
                    xhr.addEventListener('load', () => resolve());
                    xhr.addEventListener('error', () => resolve());
                    xhr.open('POST', `${API_URL}/projects/${createdProject.id}/attachments`);
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                    xhr.send(filesFormData);
                });
            }

            setUploadStatus('completed');
            setUploadFiles(prev => prev.map(f => ({ ...f, status: 'completed', progress: 100 })));

            setTimeout(() => {
                setShowUploadDialog(false);
                showSuccess('Dự án đã được tạo thành công!');
                onSuccess();
                onClose();
            }, 1000);

        } catch (error: any) {
            console.error('Error creating project:', error);
            setUploadStatus('error');
            setUploadFiles(prev => prev.map(f => ({
                ...f,
                status: 'error',
                error: error.message || 'Lỗi không xác định'
            })));
            showError(`Lỗi: ${error.message || 'Lỗi không xác định'}`);
        } finally {
            setIsCreating(false);
        }
    };

    const UserMultiSelect = ({ label, name, selectedIds }: { label: string, name: 'implementerIds' | 'cooperatorIds', selectedIds: string[] }) => {
        const [isOpen, setIsOpen] = useState(false);
        const dropdownRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                    setIsOpen(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        return (
            <div className="space-y-2" ref={dropdownRef}>
                <label className="block text-sm font-medium text-gray-700">{label}</label>
                <div className="relative">
                    <div
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white flex justify-between items-center min-h-[42px]"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        <div className="flex flex-wrap gap-1">
                            {selectedIds.length === 0 && <span className="text-gray-400">-- Chọn {label.toLowerCase()} --</span>}
                            {selectedIds.map(id => {
                                const user = users.find(u => String(u.id) === id);
                                return user ? (
                                    <span key={id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                        {user.name}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleMultiSelectChange(name, id);
                                            }}
                                            className="ml-1 text-blue-600 hover:text-blue-800"
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ) : null;
                            })}
                        </div>
                        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {isOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {users.map(user => {
                                const isSelected = selectedIds.includes(String(user.id));
                                return (
                                    <div
                                        key={user.id}
                                        className={`px-3 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between ${isSelected ? 'bg-blue-50' : ''}`}
                                        onClick={() => handleMultiSelectChange(name, String(user.id))}
                                    >
                                        <span className="text-sm text-gray-700">{user.name} ({user.role})</span>
                                        {isSelected && <Check size={16} className="text-blue-600" />}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const FileAttachment = () => {
        const fileInputRef = useRef<HTMLInputElement>(null);
        const [showDropdown, setShowDropdown] = useState(false);
        const dropdownRef = useRef<HTMLDivElement>(null);

        // Close dropdown when clicking outside
        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                    setShowDropdown(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files && e.target.files.length > 0) {
                const newFiles = Array.from(e.target.files);
                setSelectedFiles(prev => [...prev, ...newFiles]);
            }
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };

        const removeFile = (index: number) => {
            setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        };

        const removeLink = (index: number) => {
            setSelectedLinks(prev => prev.filter((_, i) => i !== index));
        };

        const formatFileSize = (bytes: number) => {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        };

        const handleFolderFilesSelected = async (files: SelectedFile[]) => {
            if (files.length === 0) return;

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
            <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Đính kèm tài liệu
                </label>

                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="w-full flex items-center justify-between px-4 py-3 border-2 border-dashed border-blue-200 rounded-lg bg-blue-50/30 hover:bg-blue-50/50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-500">
                                <CloudUpload size={20} />
                            </div>
                            <span className="text-gray-600">Chọn phương thức đính kèm</span>
                        </div>
                        <ChevronDown size={20} className={`text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showDropdown && (
                        <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden bottom-full mb-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDropdown(false);
                                    fileInputRef.current?.click();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                            >
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                    <CloudUpload size={20} />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-800">Tải lên từ thiết bị của bạn</p>
                                    <p className="text-sm text-gray-500">Chọn tệp từ thiết bị của bạn</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDropdown(false);
                                    setShowFilePicker(true);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t"
                            >
                                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                                    <FolderOpen size={20} />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-800">Từ thư mục</p>
                                    <p className="text-sm text-gray-500">Chọn tệp từ thư mục cá nhân</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={openGoogleDrivePicker}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t"
                            >
                                <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                                    <GoogleDriveIcon />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-800">Google Drive</p>
                                    <p className="text-sm text-gray-500">Chọn tệp từ Google Drive</p>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

                <FilePickerDialog
                    isOpen={showFilePicker}
                    onClose={() => setShowFilePicker(false)}
                    onSelect={handleFolderFilesSelected}
                    token={token || ''}
                    multiple={true}
                    title="Chọn file từ thư mục cá nhân"
                />

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                    multiple
                />

                {selectedFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                        <div className="text-xs text-gray-500">{selectedFiles.length} tệp đã chọn</div>
                        {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-200 px-3 py-2 rounded-lg">
                                <span className="flex-1 truncate">{file.name}</span>
                                <span className="text-gray-400 text-xs shrink-0">{formatFileSize(file.size)}</span>
                                <button
                                    type="button"
                                    onClick={() => removeFile(index)}
                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {selectedLinks.length > 0 && (
                    <div className="mt-3 space-y-2">
                        <div className="text-xs text-gray-500">{selectedLinks.length} liên kết đã chọn</div>
                        {selectedLinks.map((link, index) => (
                            <div key={`link-${index}`} className="flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-200 px-3 py-2 rounded-lg">
                                <span className="flex-1 truncate text-blue-600">{link.name}</span>
                                <span className="text-gray-400 text-xs shrink-0">Link</span>
                                <button
                                    type="button"
                                    onClick={() => removeLink(index)}
                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                                    aria-label="Xóa liên kết"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 z-[60] bg-white border-b px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <FolderTree className="text-blue-600" size={24} />
                        {parentProject ? 'Tạo dự án con' : 'Tạo dự án mới'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Parent Project Info Banner */}
                    {parentProject && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg shadow-lg shadow-blue-500/30 shrink-0">
                                <FolderTree size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-blue-700">Đang tạo dự án con cho:</p>
                                <p className="text-blue-800 font-bold text-base truncate">{parentProject.name}</p>
                            </div>
                        </div>
                    )}

                    {parentProject ? (
                        // Simplified Form for Child Project
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Tên công việc <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    placeholder="Nhập tên công việc"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mô tả công việc</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Nhập mô tả chi tiết..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                                ></textarea>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Ngày kết thúc dự kiến</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            name="endDate"
                                            value={formData.endDate}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        />
                                        <Calendar className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Mức độ ưu tiên</label>
                                    <div className="relative">
                                        <select
                                            name="priority"
                                            value={formData.priority}
                                            onChange={handleChange}
                                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-sm font-medium ${formData.priority === 'HIGH' ? 'text-red-600 bg-red-50 border-red-200' : 'text-gray-700 bg-white'
                                                }`}
                                        >
                                            <option value="NORMAL" className="text-gray-700 bg-white">Công việc thường</option>
                                            <option value="HIGH" className="text-red-600 bg-red-50">Công việc ưu tiên</option>
                                        </select>
                                        <ChevronDown className={`absolute right-3 top-2.5 pointer-events-none ${formData.priority === 'HIGH' ? 'text-red-400' : 'text-gray-400'}`} size={16} />
                                    </div>
                                </div>
                            </div>

                            <FileAttachment />
                        </div>
                    ) : (
                        // Full Form for Main Project (Existing Layout)
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <h3 className="text-base font-semibold text-gray-900 border-b pb-2">Thông tin chung</h3>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Mã dự án <span className="text-red-500">*</span></label>
                                    <div className="flex">
                                        <span className="inline-flex items-center px-3 py-2 border border-r-0 border-gray-300 bg-gray-100 text-gray-600 rounded-l-lg font-medium text-sm">
                                            {CODE_PREFIX} -
                                        </span>
                                        <input
                                            type="text"
                                            name="codeNumber"
                                            value={formData.codeNumber}
                                            onChange={handleChange}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            placeholder="01, 02..."
                                            pattern="[0-9]*"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Tên dự án <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        placeholder="Nhập tên dự án"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Chủ đầu tư</label>
                                    <input
                                        type="text"
                                        name="investor"
                                        value={formData.investor}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        placeholder="Nhập tên chủ đầu tư"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Ngày bắt đầu</label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                name="startDate"
                                                value={formData.startDate}
                                                onChange={handleChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                            <Calendar className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Ngày kết thúc</label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                name="endDate"
                                                value={formData.endDate}
                                                onChange={handleChange}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                            <Calendar className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Thời hạn (ngày)</label>
                                        <input
                                            type="number"
                                            name="duration"
                                            value={formData.duration}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Giá trị HĐ (VNĐ)</label>
                                        <input
                                            type="text"
                                            name="value"
                                            value={formData.value}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nhóm dự án</label>
                                    <input
                                        type="text"
                                        name="group"
                                        value={formData.group}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        placeholder="Nhập nhóm dự án"
                                    />
                                </div>
                            </div>

                            {/* Details & Permissions */}
                            <div className="space-y-4">
                                <h3 className="text-base font-semibold text-gray-900 border-b pb-2">
                                    Chi tiết & Phân quyền
                                </h3>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Quản trị dự án <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            name="managerId"
                                            value={formData.managerId}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white text-sm"
                                        >
                                            <option value="">-- Chọn quản trị --</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                </div>

                                <UserMultiSelect label="Người thực hiện" name="implementerIds" selectedIds={formData.implementerIds} />
                                <UserMultiSelect label="Phối hợp thực hiện" name="cooperatorIds" selectedIds={formData.cooperatorIds} />

                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Mô tả</label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        rows={3}
                                        placeholder="Nhập mô tả chi tiết..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                                    ></textarea>
                                </div>

                                <FileAttachment />
                            </div>
                        </div>
                    )}
                </div>

                <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3 z-[60]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        disabled={isCreating}
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isCreating}
                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all shadow-md disabled:opacity-70 flex items-center gap-2"
                    >
                        {isCreating && <Loader2 size={18} className="animate-spin" />}
                        {isCreating ? 'Đang tạo...' : 'Tạo dự án'}
                    </button>
                </div>
            </div>

            {showUploadDialog && (
                <UploadProgressDialog
                    isOpen={showUploadDialog}
                    onClose={() => setShowUploadDialog(false)}
                    files={uploadFiles}
                    totalProgress={uploadProgress}
                    status={uploadStatus}
                />
            )}
        </div>
    );
};
