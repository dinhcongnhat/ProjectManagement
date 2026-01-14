import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Users as UsersIcon, Shield, User, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import { useDialog } from '../../components/ui/Dialog';

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
    const [searchQuery, setSearchQuery] = useState('');
    const { token } = useAuth();
    const { showConfirm, showError } = useDialog();

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
                const usersResponse = await fetch(`${API_URL}/users`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const usersData = await usersResponse.json();
                if (Array.isArray(usersData)) {
                    setUsers(usersData);
                }
            } else {
                showError('Failed to save user');
            }
        } catch (error) {
            console.error('Error saving user:', error);
        }
    };

    const handleDeleteUser = async (id: number) => {
        const confirmed = await showConfirm('Bạn có chắc chắn muốn xóa nhân viên này?');
        if (!confirmed) return;
        try {
            const response = await fetch(`${API_URL}/users/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const usersResponse = await fetch(`${API_URL}/users`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const usersData = await usersResponse.json();
                if (Array.isArray(usersData)) {
                    setUsers(usersData);
                }
            } else {
                showError('Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    };

    const openEditModal = (user: UserData) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: '',
            name: user.name,
            role: user.role,
            position: user.position || '',
        });
        setShowModal(true);
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const adminCount = users.filter(u => u.role === 'ADMIN').length;
    const userCount = users.filter(u => u.role === 'USER').length;

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Quản lý nhân viên</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1 text-sm sm:text-base">Quản lý hệ thống tài khoản</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg sm:rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-500/25 text-xs sm:text-sm font-medium active:scale-95"
                >
                    <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
                    <span>Thêm</span>
                </button>
            </div>

            {/* Stats - Mobile Compact */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <div className="p-2 sm:p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg sm:rounded-xl text-white shadow-lg shadow-purple-500/30 w-fit">
                            <UsersIcon size={16} className="sm:w-5 sm:h-5" />
                        </div>
                        <div>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{users.length}</p>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Tổng</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <div className="p-2 sm:p-2.5 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg sm:rounded-xl text-white shadow-lg shadow-orange-500/30 w-fit">
                            <Shield size={16} className="sm:w-5 sm:h-5" />
                        </div>
                        <div>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{adminCount}</p>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Admin</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 lg:p-5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <div className="p-2 sm:p-2.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg sm:rounded-xl text-white shadow-lg shadow-green-500/30 w-fit">
                            <User size={16} className="sm:w-5 sm:h-5" />
                        </div>
                        <div>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{userCount}</p>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">User</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm..."
                    className="w-full pl-9 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 text-sm sm:text-base dark:text-gray-200 placeholder-gray-400"
                />
            </div>

            {/* User List - Desktop Table */}
            <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nhân viên</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vai trò</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Chức vụ</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/20">
                                            {user.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${user.role === 'ADMIN'
                                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-orange-500/20'
                                        : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-green-500/20'
                                        }`}>
                                        {user.role === 'ADMIN' ? <Shield size={12} /> : <User size={12} />}
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                    {user.position || <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            title="Chỉnh sửa"
                                            onClick={() => openEditModal(user)}
                                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            title="Xóa"
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        >
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
            <div className="lg:hidden space-y-2 sm:space-y-3">
                {filteredUsers.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-700 p-8 sm:p-12 text-center shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                            <UsersIcon size={24} className="text-gray-400 sm:w-8 sm:h-8" />
                        </div>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1 sm:mb-2">Không tìm thấy</h3>
                        <p className="text-gray-500 text-sm">Thử tìm kiếm khác</p>
                    </div>
                ) : (
                    filteredUsers.map((user) => (
                        <div key={user.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 p-4 hover:shadow-xl transition-all">
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/20 shrink-0">
                                    {user.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                                            <p className="text-sm text-gray-500">@{user.username}</p>
                                        </div>
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${user.role === 'ADMIN'
                                            ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
                                            : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'
                                            }`}>
                                            {user.role === 'ADMIN' ? <Shield size={10} /> : <User size={10} />}
                                            {user.role}
                                        </span>
                                    </div>
                                    {user.position && (
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">Chức vụ:</span>
                                            <span className="text-sm text-gray-700 font-medium">{user.position}</span>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEditModal(user)}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
                                        >
                                            <Pencil size={16} />
                                            <span>Chỉnh sửa</span>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-sm font-medium"
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
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-900 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl text-white">
                                    {editingUser ? <Pencil size={20} /> : <Plus size={20} />}
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{editingUser ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}</h3>
                            </div>
                            <button title="Đóng" onClick={resetForm} className="p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Họ và tên <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Nhập họ tên"
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all bg-white dark:bg-gray-800 dark:text-white"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tên đăng nhập <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Nhập tên đăng nhập"
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all bg-white dark:bg-gray-800 dark:text-white"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    {editingUser ? 'Mật khẩu (để trống nếu không đổi)' : 'Mật khẩu'} {!editingUser && <span className="text-red-500">*</span>}
                                </label>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    placeholder="Nhập mật khẩu"
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all bg-white dark:bg-gray-800 dark:text-white"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Vai trò <span className="text-red-500">*</span></label>
                                <select
                                    title="Chọn vai trò"
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all bg-white dark:bg-gray-800 dark:text-white"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="USER">User</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Chức vụ</label>
                                <input
                                    type="text"
                                    placeholder="Nhập chức vụ"
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all bg-white dark:bg-gray-800 dark:text-white"
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                />
                            </div>
                        </form>
                        <div className="flex gap-3 p-5 border-t border-gray-100 dark:border-gray-700 shrink-0">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                onClick={handleSubmit}
                                className="flex-1 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl transition-all shadow-lg shadow-purple-500/25"
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
