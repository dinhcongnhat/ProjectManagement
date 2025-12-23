import React, { useState, useEffect, useRef } from 'react';
import { Calendar, X, ChevronDown, Check, CloudUpload, FolderTree, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useDialog } from '../../components/ui/Dialog';
import { UploadProgressDialog } from '../../components/ui/UploadProgressDialog';
import type { UploadFile } from '../../components/ui/UploadProgressDialog';

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

const CreateProject = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const parentIdParam = searchParams.get('parentId');
    const { showSuccess, showError } = useDialog();

    const [users, setUsers] = useState<UserData[]>([]);
    const [parentProject, setParentProject] = useState<ParentProject | null>(null);
    const [isCreating, setIsCreating] = useState(false); // Loading state for creating project

    const [formData, setFormData] = useState({
        codeNumber: '',  // Chỉ nhập số phần sau tiền tố
        name: '',
        investor: '',    // Chủ đầu tư
        startDate: '',
        endDate: '',
        duration: '',
        group: '',
        value: '',
        managerId: '',
        implementerIds: [] as string[],
        cooperatorIds: [] as string[],  // Phối hợp thực hiện
        description: '',
        parentId: parentIdParam || ''
    });

    const CODE_PREFIX = 'DA2026';  // Tiền tố cố định
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    // Upload Progress State
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'completed' | 'error'>('idle');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await fetch(`${API_URL}/users`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) {
                    console.error('Failed to fetch users:', response.status, response.statusText);
                    return;
                }

                const data = await response.json();
                if (Array.isArray(data)) {
                    setUsers(data);
                } else {
                    console.error('Users data is not an array:', data);
                }
            } catch (error) {
                console.error('Error fetching users:', error);
            }
        };

        const fetchParentProject = async () => {
            if (!parentIdParam) return;
            try {
                const response = await fetch(`${API_URL}/projects/${parentIdParam}`, {
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
                }
            } catch (error) {
                console.error('Error fetching parent project:', error);
            }
        };

        if (token) {
            fetchUsers();
            fetchParentProject();
        }
    }, [token, parentIdParam]);

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
        // Remove non-digit characters
        const number = value.replace(/\D/g, '');
        // Format with dots
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
        // Validate required fields
        // Dự án con không cần mã dự án
        if (!parentProject && !formData.codeNumber.trim()) {
            showError('Vui lòng nhập mã dự án');
            return;
        }
        if (!formData.name.trim() || !formData.managerId) {
            showError('Vui lòng điền đầy đủ các trường bắt buộc: Tên và Quản trị');
            return;
        }

        setIsCreating(true);

        // Initialize upload files state for dialog
        const filesToUpload: UploadFile[] = selectedFiles.map(f => ({
            name: f.name,
            size: f.size,
            progress: 0,
            status: 'pending' as const
        }));

        if (selectedFiles.length > 0) {
            setUploadFiles(filesToUpload);
            setUploadProgress(0);
            setUploadStatus('uploading');
            setShowUploadDialog(true);
        }

        try {
            // Step 1: Tạo project trước (không có file)
            // Tạo mã dự án: nếu là dự án con thì dùng mã dự án cha làm tiền tố
            let projectCode = '';
            if (parentProject) {
                // Dự án con: CODE dự án cha + tên công việc viết tắt hoặc số thứ tự
                const childCount = parentProject.children?.length || 0;
                projectCode = `${parentProject.code}.${String(childCount + 1).padStart(2, '0')}`;
            } else {
                // Dự án mới: DA2026 - XX
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
                parentId: formData.parentId,
                implementerIds: JSON.stringify(formData.implementerIds),
                cooperatorIds: JSON.stringify(formData.cooperatorIds),
            };

            // Create project first
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

            // Step 2: Upload files if any
            if (selectedFiles.length > 0) {
                const filesFormData = new FormData();
                selectedFiles.forEach(file => {
                    filesFormData.append('files', file);
                });

                const xhr = new XMLHttpRequest();

                await new Promise<void>((resolve, reject) => {
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

                    xhr.addEventListener('load', () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve();
                        } else {
                            console.error('Upload attachments failed but project was created');
                            resolve(); // Still resolve since project is created
                        }
                    });

                    xhr.addEventListener('error', () => {
                        console.error('Upload error');
                        resolve(); // Still resolve since project is created
                    });

                    xhr.open('POST', `${API_URL}/projects/${createdProject.id}/attachments`);
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                    xhr.send(filesFormData);
                });
            }

            // Success  
            setUploadStatus('completed');
            setUploadFiles(prev => prev.map(f => ({ ...f, status: 'completed', progress: 100 })));

            setTimeout(() => {
                setShowUploadDialog(false);
                showSuccess('Dự án đã được tạo thành công!');
                if (parentIdParam) {
                    navigate(`/admin/projects/${parentIdParam}`);
                } else {
                    navigate('/admin/projects');
                }
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
        const [showFolderModal, setShowFolderModal] = useState(false);
        const [userFiles, setUserFiles] = useState<Array<{ id: number; name: string; fileSize: number; minioPath: string }>>([]);
        const [loadingFiles, setLoadingFiles] = useState(false);
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

        const formatFileSize = (bytes: number) => {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        };

        const [userFolders, setUserFolders] = useState<Array<{ id: number; name: string }>>([]);
        const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
        const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: number | null; name: string }>>([]);

        const fetchUserFiles = async (folderId: number | null = null) => {
            setLoadingFiles(true);
            try {
                const url = folderId
                    ? `${API_URL}/folders?parentId=${folderId}`
                    : `${API_URL}/folders`;
                const response = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setUserFiles(data.files || []);
                    setUserFolders(data.folders || []);
                    setCurrentFolderId(folderId);
                    // Update breadcrumbs
                    if (folderId === null) {
                        setBreadcrumbs([]);
                    } else if (data.breadcrumbs) {
                        setBreadcrumbs(data.breadcrumbs);
                    }
                }
            } catch (error) {
                console.error('Error fetching user files:', error);
            } finally {
                setLoadingFiles(false);
            }
        };

        const handleOpenFolderPicker = () => {
            setShowDropdown(false);
            setCurrentFolderId(null);
            setBreadcrumbs([]);
            fetchUserFiles(null);
            setShowFolderModal(true);
        };

        const handleSelectFolderFile = async (file: { id: number; name: string; fileSize: number; minioPath: string }) => {
            try {
                // Get presigned URL and download file
                const urlResponse = await fetch(`${API_URL}/folders/files/${file.id}/url`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (urlResponse.ok) {
                    const { url } = await urlResponse.json();
                    const fileResponse = await fetch(url);
                    if (fileResponse.ok) {
                        const blob = await fileResponse.blob();
                        const newFile = new File([blob], file.name, { type: blob.type || 'application/octet-stream' });
                        setSelectedFiles(prev => [...prev, newFile]);
                        setShowFolderModal(false);
                    }
                }
            } catch (error) {
                console.error('Error downloading file:', error);
            }
        };

        const handleNavigateFolder = (folderId: number) => {
            fetchUserFiles(folderId);
        };

        const handleGoBack = () => {
            if (breadcrumbs.length > 1) {
                const parentFolder = breadcrumbs[breadcrumbs.length - 2];
                fetchUserFiles(parentFolder.id);
            } else {
                fetchUserFiles(null);
            }
        };

        return (
            <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Đính kèm
                </label>

                {/* Dropdown to select upload method */}
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
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
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
                                    <p className="font-medium text-gray-800">Tải lên từ máy tính</p>
                                    <p className="text-sm text-gray-500">Chọn tệp từ thiết bị của bạn</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenFolderPicker}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t"
                            >
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                                    <FolderTree size={20} />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-800">Chọn từ thư mục</p>
                                    <p className="text-sm text-gray-500">Chọn tệp từ thư mục cá nhân của bạn</p>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    aria-label="Chọn tệp đính kèm"
                    onChange={handleFileChange}
                    multiple
                />

                {/* Display selected files */}
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
                                    aria-label="Xóa tệp"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setSelectedFiles([])}
                            className="text-xs text-red-500 hover:text-red-700"
                        >
                            Xóa tất cả
                        </button>
                    </div>
                )}

                {/* Folder Picker Modal */}
                {showFolderModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                                <div className="flex items-center gap-2">
                                    {currentFolderId !== null && (
                                        <button
                                            type="button"
                                            onClick={handleGoBack}
                                            className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                                        >
                                            <ArrowLeft size={18} className="text-gray-600" />
                                        </button>
                                    )}
                                    <h3 className="font-semibold text-gray-900">
                                        {breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].name : 'Thư mục của tôi'}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowFolderModal(false)}
                                    className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            {/* Breadcrumbs */}
                            {breadcrumbs.length > 0 && (
                                <div className="px-4 py-2 bg-gray-100 flex items-center gap-1 text-sm overflow-x-auto">
                                    <button
                                        type="button"
                                        onClick={() => fetchUserFiles(null)}
                                        className="text-blue-600 hover:underline shrink-0"
                                    >
                                        Thư mục
                                    </button>
                                    {breadcrumbs.map((bc, index) => (
                                        <span key={bc.id} className="flex items-center gap-1">
                                            <span className="text-gray-400">/</span>
                                            <button
                                                type="button"
                                                onClick={() => fetchUserFiles(bc.id)}
                                                className={`hover:underline shrink-0 ${index === breadcrumbs.length - 1 ? 'text-gray-700 font-medium' : 'text-blue-600'}`}
                                            >
                                                {bc.name}
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="p-4 overflow-y-auto max-h-96">
                                {loadingFiles ? (
                                    <div className="flex items-center justify-center py-12 text-gray-500">
                                        <Loader2 size={24} className="animate-spin mr-2" />
                                        <span>Đang tải danh sách...</span>
                                    </div>
                                ) : userFolders.length === 0 && userFiles.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">
                                        <FolderTree size={48} className="mx-auto mb-3 text-gray-400" />
                                        <p className="font-medium">Thư mục này đang trống</p>
                                        <p className="text-sm mt-1">Hãy vào "Thư mục" để tải lên file trước</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Folders first */}
                                        {userFolders.map((folder) => (
                                            <div
                                                key={`folder-${folder.id}`}
                                                onClick={() => handleNavigateFolder(folder.id)}
                                                className="flex items-center gap-3 px-3 py-3 hover:bg-yellow-50 cursor-pointer rounded-lg border transition-colors"
                                            >
                                                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-600">
                                                    📁
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate">{folder.name}</p>
                                                    <p className="text-xs text-gray-500">Thư mục</p>
                                                </div>
                                                <ChevronDown size={16} className="text-gray-400 -rotate-90" />
                                            </div>
                                        ))}

                                        {/* Files */}
                                        {userFiles.map((file) => (
                                            <div
                                                key={`file-${file.id}`}
                                                onClick={() => handleSelectFolderFile(file)}
                                                className="flex items-center gap-3 px-3 py-3 hover:bg-blue-50 cursor-pointer rounded-lg border transition-colors"
                                            >
                                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                                    📄
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                                                    <p className="text-xs text-gray-500">{formatFileSize(file.fileSize)}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
                                                >
                                                    Chọn
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    {parentProject && (
                        <Link
                            to={`/admin/projects/${parentProject.id}`}
                            className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-600 transition-colors shadow-lg shadow-gray-200/50 shrink-0"
                        >
                            <ArrowLeft size={20} />
                        </Link>
                    )}
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/30">
                                <FolderTree size={24} />
                            </div>
                            {parentProject ? 'Tạo dự án con' : 'Tạo dự án mới'}
                        </h2>
                        {parentProject && (
                            <p className="text-sm text-gray-500 mt-2">
                                Dự án cha: <span className="font-medium text-blue-600">{parentProject.name}</span> ({parentProject.code})
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Parent Project Info Banner */}
            {parentProject && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 lg:p-5 flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/30 shrink-0">
                        <FolderTree size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-blue-700">Đang tạo dự án con cho:</p>
                        <p className="text-blue-800 font-bold text-lg truncate">{parentProject.name}</p>
                    </div>
                </div>
            )}

            {/* Form */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/50 p-5 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                    {/* Basic Info */}
                    <div className="space-y-5">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 pb-3 border-b border-gray-100">
                            <span className="w-1.5 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></span>
                            {parentProject ? 'Thông tin công việc' : 'Thông tin chung'}
                        </h3>

                        {/* Mã dự án - Chỉ hiển thị khi tạo dự án mới (không có parentProject) */}
                        {!parentProject && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mã dự án <span className="text-red-500">*</span></label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 py-2.5 border border-r-0 border-gray-300 bg-gray-100 text-gray-600 rounded-l-lg font-medium text-base">
                                        {CODE_PREFIX} -
                                    </span>
                                    <input
                                        type="text"
                                        name="codeNumber"
                                        value={formData.codeNumber}
                                        onChange={handleChange}
                                        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                        placeholder="01, 02, 03..."
                                        pattern="[0-9]*"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Mã đầy đủ: {CODE_PREFIX} - {formData.codeNumber || '...'}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                {parentProject ? 'Tên công việc' : 'Tên dự án'} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                placeholder={parentProject ? 'Nhập tên công việc' : 'Nhập tên dự án'}
                            />
                        </div>

                        {/* Chủ đầu tư - Chỉ hiển thị khi tạo dự án mới */}
                        {!parentProject && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Chủ đầu tư</label>
                                <input
                                    type="text"
                                    name="investor"
                                    value={formData.investor}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                    placeholder="Nhập tên chủ đầu tư"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 lg:gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ngày bắt đầu</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        name="startDate"
                                        title="Chọn ngày bắt đầu"
                                        value={formData.startDate}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                    />
                                    <Calendar className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={16} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ngày kết thúc dự kiến</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        name="endDate"
                                        title="Chọn ngày kết thúc dự kiến"
                                        value={formData.endDate}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                    />
                                    <Calendar className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Thời hạn - Chỉ hiển thị khi tạo dự án mới */}
                        {!parentProject && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Thời hạn (ngày)</label>
                                <input
                                    type="number"
                                    name="duration"
                                    title="Thời hạn dự án"
                                    placeholder="Nhập số ngày"
                                    value={formData.duration}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                />
                            </div>
                        )}
                    </div>

                    {/* Additional Info */}
                    <div className="space-y-4">
                        <h3 className="text-base lg:text-lg font-semibold text-gray-900 border-b pb-2">
                            {parentProject ? 'Phân quyền' : 'Chi tiết & Phân quyền'}
                        </h3>

                        {/* Nhóm dự án và Giá trị hợp đồng - Chỉ hiển thị khi tạo dự án mới */}
                        {!parentProject && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nhóm dự án</label>
                                    <input
                                        type="text"
                                        name="group"
                                        value={formData.group}
                                        onChange={handleChange}
                                        placeholder="Nhập nhóm dự án"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Giá trị hợp đồng</label>
                                    <input
                                        type="text"
                                        name="value"
                                        value={formData.value}
                                        onChange={handleChange}
                                        placeholder="Nhập giá trị hợp đồng"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                {parentProject ? 'Quản trị công việc' : 'Quản trị dự án'} <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="managerId"
                                title="Chọn quản trị"
                                value={formData.managerId}
                                onChange={handleChange}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base bg-white"
                            >
                                <option value="">-- Chọn quản trị --</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
                                ))}
                            </select>
                        </div>

                        <UserMultiSelect label="Người thực hiện" name="implementerIds" selectedIds={formData.implementerIds} />
                        <UserMultiSelect label="Phối hợp thực hiện" name="cooperatorIds" selectedIds={formData.cooperatorIds} />

                    </div>

                    <div className="col-span-1 lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {parentProject ? 'Mô tả công việc' : 'Mô tả dự án'}
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={4}
                            placeholder={parentProject ? 'Nhập mô tả công việc' : 'Nhập mô tả dự án'}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base resize-none"
                        ></textarea>
                    </div>

                    <div className="col-span-1 lg:col-span-2">
                        <FileAttachment />
                    </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 lg:mt-8 pt-4 lg:pt-6 border-t border-gray-200">
                    <button
                        onClick={() => navigate('/admin/projects')}
                        disabled={isCreating}
                        className="w-full sm:w-auto px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors touch-target disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isCreating}
                        className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm touch-target disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isCreating ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>Đang tạo...</span>
                            </>
                        ) : (
                            'Tạo dự án'
                        )}
                    </button>
                </div>
            </div>

            {/* Upload Progress Dialog */}
            <UploadProgressDialog
                isOpen={showUploadDialog}
                onClose={() => {
                    if (uploadStatus !== 'uploading') {
                        setShowUploadDialog(false);
                    }
                }}
                title={uploadStatus === 'completed' ? 'Tải lên hoàn tất!' : 'Đang tải lên...'}
                files={uploadFiles}
                totalProgress={uploadProgress}
                status={uploadStatus}
                canClose={uploadStatus !== 'uploading'}
            />

            {/* Simple Loading Overlay (when no files to upload) */}
            {isCreating && !showUploadDialog && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                            <Loader2 size={32} className="text-blue-600 animate-spin" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">Đang tạo dự án</h3>
                            <p className="text-sm text-gray-500">Vui lòng đợi trong giây lát...</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateProject;
