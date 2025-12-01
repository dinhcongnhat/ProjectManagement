import React, { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
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
    }, [token]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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

    const UserMultiSelect = ({ label, name, selectedIds }: { label: string, name: 'implementerIds' | 'followerIds', selectedIds: string[] }) => (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto bg-white">
                {users.map(user => (
                    <div key={user.id} className="flex items-center gap-2 py-1">
                        <input
                            type="checkbox"
                            id={`${name}-${user.id}`}
                            checked={selectedIds.includes(String(user.id))}
                            onChange={() => handleMultiSelectChange(name, String(user.id))}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <label htmlFor={`${name}-${user.id}`} className="text-sm text-gray-700 cursor-pointer select-none">
                            {user.name} ({user.role})
                        </label>
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-1 min-h-[24px]">
                {selectedIds.map(id => {
                    const user = users.find(u => String(u.id) === id);
                    return user ? (
                        <span key={id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {user.name}
                            <button
                                type="button"
                                onClick={() => handleMultiSelectChange(name, id)}
                                className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ) : null;
                })}
            </div>
        </div>
    );

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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phương pháp tính tiến độ <span className="text-red-500">*</span></label>
                            <select
                                name="progressMethod"
                                value={formData.progressMethod}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="Theo bình quân % tiến độ các công việc thuộc dự án">Theo bình quân % tiến độ các công việc thuộc dự án</option>
                                <option value="Theo trọng số công việc">Theo trọng số công việc</option>
                            </select>
                        </div>

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
