import React, { useState, useEffect, useRef } from 'react';
import { Calendar, X, ChevronDown, Check, CloudUpload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface UserData {
    id: number;
    name: string;
    role: string;
}

const CreateProject = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserData[]>([]);

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        startDate: '',
        endDate: '',
        duration: '',
        group: '',
        value: '',
        progressMethod: 'Theo bình quân % tiến độ các công việc thuộc dự án',
        managerId: '',
        implementerIds: [] as string[],
        followerIds: [] as string[],
        description: ''
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await fetch('http://localhost:3000/api/users', {
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

        if (token) fetchUsers();
        if (token) fetchUsers();
    }, [token]);

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

    const handleMultiSelectChange = (name: 'implementerIds' | 'followerIds', userId: string) => {
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
        try {
            const response = await fetch('http://localhost:3000/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                alert('Dự án đã được tạo thành công!');
                navigate('/admin/projects');
            } else {
                const data = await response.json();
                alert(`Lỗi: ${data.message}`);
            }
        } catch (error) {
            console.error('Error creating project:', error);
            alert('Có lỗi xảy ra khi tạo dự án');
        }
    };

    const UserMultiSelect = ({ label, name, selectedIds }: { label: string, name: 'implementerIds' | 'followerIds', selectedIds: string[] }) => {
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

    const ProgressMethodSelector = () => {
        const [isOpen, setIsOpen] = useState(false);
        const dropdownRef = useRef<HTMLDivElement>(null);

        const options = [
            {
                value: 'Theo bình quân % tiến độ các công việc thuộc dự án',
                label: 'Theo bình quân % tiến độ các công việc thuộc dự án',
                description: 'Ví dụ dự án gồm 2 công việc A và B.\nCông việc A tiến độ 40%, công việc B tiến độ 60%.\nTiến độ dự án là (60+40)/2 = 50%'
            },
            {
                value: 'Theo tỷ trọng ngày thực hiện',
                label: 'Theo tỷ trọng ngày thực hiện',
                description: 'Ví dụ dự án gồm 2 công việc A và B.\nCông việc A yêu cầu thực hiện trong 4 ngày, tiến độ 40%.\nCông việc B yêu cầu thực hiện trong 6 ngày, tiến độ 50%.\nTiến độ dự án là ((4*40 + 6*50 )/(4*100 + 6*100)) * 100 = 46%'
            },
            {
                value: 'Theo tỷ trọng công việc',
                label: 'Theo tỷ trọng công việc',
                description: 'Ví dụ Dự án gồm 2 công việc A và B.\nCông việc A có Tỷ trọng là 40, tiến độ là 50%\nCông việc B có Tỷ trọng là 30, tiến độ là 40%\nTiến độ của dự án là [(40x50)+(30x40)]/(40+50)=35%'
            }
        ];

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Phương pháp tính tiến độ <span className="text-red-500">*</span></label>
                <div className="relative">
                    <div
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white flex justify-between items-center"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        <span className="text-gray-700">{formData.progressMethod}</span>
                        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {isOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden">
                            {options.map((option) => (
                                <div
                                    key={option.value}
                                    className={`p-4 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${formData.progressMethod === option.value ? 'bg-gray-50' : ''}`}
                                    onClick={() => {
                                        setFormData(prev => ({ ...prev, progressMethod: option.value }));
                                        setIsOpen(false);
                                    }}
                                >
                                    <div className="font-medium text-gray-900 mb-1">{option.label}</div>
                                    <div className="text-sm text-gray-500 whitespace-pre-line italic">{option.description}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const FileAttachment = () => {
        const fileInputRef = useRef<HTMLInputElement>(null);

        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files && e.target.files[0]) {
                setSelectedFile(e.target.files[0]);
            }
        };

        const handleDragOver = (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const handleDrop = (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                setSelectedFile(e.dataTransfer.files[0]);
            }
        };

        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Đính kèm</label>
                <div
                    className="border-2 border-dashed border-red-200 rounded-lg p-8 flex flex-col items-center justify-center gap-4 bg-white"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                        <CloudUpload size={32} />
                    </div>
                    <p className="text-gray-600">Kéo thả file vào đây để tải lên hoặc</p>
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 flex items-center gap-2 font-medium"
                        >
                            <CloudUpload size={18} />
                            CHỌN TỪ MÁY
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>
                    {selectedFile && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-1 rounded-full">
                            <span>{selectedFile.name}</span>
                            <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-red-500">
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Tạo dự án mới</h2>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Thông tin chung</h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mã dự án <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="code"
                                value={formData.code}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="VD: DA001"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tên dự án <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Nhập tên dự án"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        name="startDate"
                                        value={formData.startDate}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <Calendar className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={18} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        name="endDate"
                                        value={formData.endDate}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <Calendar className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={18} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Thời hạn (ngày)</label>
                            <input
                                type="number"
                                name="duration"
                                value={formData.duration}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Additional Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Chi tiết & Phân quyền</h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nhóm dự án</label>
                            <input
                                type="text"
                                name="group"
                                value={formData.group}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Giá trị hợp đồng</label>
                            <input
                                type="text"
                                name="value"
                                value={formData.value}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <ProgressMethodSelector />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quản trị dự án <span className="text-red-500">*</span></label>
                            <select
                                name="managerId"
                                value={formData.managerId}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">-- Chọn quản trị dự án --</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
                                ))}
                            </select>
                        </div>

                        <UserMultiSelect label="Người thực hiện" name="implementerIds" selectedIds={formData.implementerIds} />
                        <UserMultiSelect label="Người theo dõi" name="followerIds" selectedIds={formData.followerIds} />

                    </div>

                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả dự án</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        ></textarea>
                    </div>

                    <div className="col-span-1 md:col-span-2">
                        <FileAttachment />
                    </div>
                </div>

                <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-200">
                    <button
                        onClick={() => navigate('/admin/projects')}
                        className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        Tạo dự án
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateProject;
