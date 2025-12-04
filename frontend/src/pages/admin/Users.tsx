import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Users as UsersIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';

interface UserData {
    id: number;
    username: string;
    name: string;
    role: string;
    position: string | null;
}

interface FormDataType {
    username: string;
    password: string;
    name: string;
    role: string;
    position: string;
}

const Users = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const { token } = useAuth();

    // Form state
    const [formData, setFormData] = useState<FormDataType>({
        username: '',
        password: '',
        name: '',
        role: 'USER',
        position: '',
    });

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
        
        if (token) {
            fetchUsers();
        }
    }, [token]);

    const resetForm = () => {
        setFormData({ username: '', password: '', name: '', role: 'USER', position: '' });
        setEditingUser(null);
        setShowModal(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingUser
                ? `${API_URL}/users/${editingUser.id}`
                : `${API_URL}/users`;

            const method = editingUser ? 'PUT' : 'POST';

            // Don't send empty password when editing if not changed
            const bodyData: Partial<FormDataType> = { ...formData };
            if (editingUser && !bodyData.password) {
                delete bodyData.password;
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(bodyData),
            });

            if (response.ok) {
                resetForm();
                // Refetch users
                const usersResponse = await fetch(`${API_URL}/users`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const usersData = await usersResponse.json();
                if (Array.isArray(usersData)) {
                    setUsers(usersData);
                }
            } else {
                alert('Failed to save user');
            }
        } catch (error) {
            console.error('Error saving user:', error);
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            const response = await fetch(`${API_URL}/users/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                // Refetch users
                const usersResponse = await fetch(`${API_URL}/users`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const usersData = await usersResponse.json();
                if (Array.isArray(usersData)) {
                    setUsers(usersData);
                }
            } else {
                alert('Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    };

    const openEditModal = (user: UserData) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: '', // Leave empty to keep existing
            name: user.name,
            role: user.role,
            position: user.position || '',
        });
        setShowModal(true);
    };

    return (
        <div className="space-y-4 lg:space-y-6">
            {/* Header - Mobile Optimized */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Quản lý nhân viên</h2>
                    <p className="text-xs lg:text-sm text-gray-500 mt-1">Quản lý hệ thống tài khoản của nhân viên</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm text-sm font-medium touch-target shrink-0"
                >
                    <Plus size={18} />
                    <span>Thêm nhân viên</span>
                </button>
            </div>

            {/* User List - Desktop Table */}
            <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                                            {user.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{user.name}</p>
                                            <p className="text-sm text-gray-500">@{user.username}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                    {user.position || '-'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button title="Chỉnh sửa" onClick={() => openEditModal(user)} className="p-1 text-gray-400 hover:text-blue-600">
                                            <Pencil size={18} />
                                        </button>
                                        <button title="Xóa" onClick={() => handleDeleteUser(user.id)} className="p-1 text-gray-400 hover:text-red-600">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* User List - Mobile Cards */}
            <div className="lg:hidden space-y-3">
                {users.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <UsersIcon size={32} className="text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm">Chưa có nhân viên nào</p>
                    </div>
                ) : (
                    users.map((user) => (
                        <div key={user.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 active:bg-gray-50 transition-colors">
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-lg shrink-0">
                                    {user.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 truncate">{user.name}</p>
                                            <p className="text-sm text-gray-500">@{user.username}</p>
                                        </div>
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </div>
                                    {user.position && (
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-xs text-gray-500">Chức vụ:</span>
                                            <span className="text-sm text-gray-700 font-medium">{user.position}</span>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => openEditModal(user)} 
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 active:bg-blue-200 transition-colors text-sm font-medium touch-target"
                                        >
                                            <Pencil size={16} />
                                            <span>Chỉnh sửa</span>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteUser(user.id)} 
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:bg-red-200 transition-colors text-sm font-medium touch-target"
                                        >
                                            <Trash2 size={16} />
                                            <span>Xóa</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit User Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 lg:p-6 border-b border-gray-200 shrink-0">
                            <h3 className="text-lg lg:text-xl font-bold text-gray-900">{editingUser ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}</h3>
                            <button title="Đóng" onClick={resetForm} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors touch-target">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Nhập họ tên"
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tên đăng nhập <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Nhập tên đăng nhập"
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    {editingUser ? 'Mật khẩu (để trống nếu không đổi)' : 'Mật khẩu'} {!editingUser && <span className="text-red-500">*</span>}
                                </label>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    placeholder="Nhập mật khẩu"
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Vai trò <span className="text-red-500">*</span></label>
                                <select
                                    title="Chọn vai trò"
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base bg-white"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="USER">User</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Chức vụ</label>
                                <input
                                    type="text"
                                    placeholder="Nhập chức vụ"
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                />
                            </div>
                        </form>
                        <div className="flex gap-3 p-4 lg:p-6 border-t border-gray-200 shrink-0">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 active:bg-gray-100 rounded-lg transition-colors touch-target"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                onClick={handleSubmit}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors shadow-sm touch-target"
                            >
                                {editingUser ? 'Cập nhật' : 'Tạo mới'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
