import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Quản lý nhân viên</h2>
                    <p className="text-sm text-gray-500 mt-1">Quản lý hệ thống tài khoản của nhân viên</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={20} />
                    Add User
                </button>
            </div>

            {/* User List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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

            {/* Create/Edit User Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-900">{editingUser ? 'Edit User' : 'Create New User'}</h3>
                            <button title="Đóng" onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Nhập họ tên"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Nhập tên đăng nhập"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {editingUser ? 'Password (leave blank to keep current)' : 'Password'}
                                </label>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    placeholder="Nhập mật khẩu"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                <select
                                    title="Chọn vai trò"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="USER">User</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                                <input
                                    type="text"
                                    placeholder="Nhập chức vụ"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                                >
                                    {editingUser ? 'Update User' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
