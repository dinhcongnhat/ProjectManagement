import React, { useState, useEffect, useRef } from 'react';
import api, { API_URL } from '../config/api';
import { useDialog } from '../components/ui/Dialog';
import { 
    User as UserIcon, 
    Camera, 
    Pencil, 
    Phone, 
    Mail, 
    Check, 
    X, 
    Key,
    Eye,
    EyeOff
} from 'lucide-react';
import ImageCropper from '../components/ImageCropper';

// Helper to resolve relative URLs to absolute URLs
const resolveAvatarUrl = (url: string | null): string | null => {
    if (!url) return null;
    // If already absolute URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
    }
    // For relative URLs, prepend API_URL base (remove /api suffix if present)
    const baseUrl = API_URL.replace(/\/api$/, '');
    return `${baseUrl}${url}`;
};

interface UserProfileData {
    id: number;
    username: string;
    name: string;
    role: string;
    position: string | null;
    avatar: string | null;
    avatarUrl: string | null;
    bio: string | null;
    phone: string | null;
    email: string | null;
    createdAt: string;
}

export default function UserProfile() {
    const { showError, showSuccess, showWarning } = useDialog();
    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    
    // Image cropper state
    const [showCropper, setShowCropper] = useState(false);
    const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
    
    // Form fields
    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch profile
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get('/users/profile');
                setProfile(response.data);
                setName(response.data.name || '');
                setBio(response.data.bio || '');
                setPhone(response.data.phone || '');
                setEmail(response.data.email || '');
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    // Handle avatar upload - open cropper first
    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            showWarning('Vui lòng chọn file hình ảnh');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showWarning('Kích thước file tối đa là 5MB');
            return;
        }

        // Open cropper
        const url = URL.createObjectURL(file);
        setCropImageUrl(url);
        setShowCropper(true);
        
        // Reset input
        e.target.value = '';
    };

    // Upload cropped avatar
    const uploadCroppedAvatar = async (croppedBlob: Blob) => {
        setUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append('avatar', croppedBlob, 'avatar.jpg');

            // Don't set Content-Type manually - let axios/browser set it with proper boundary
            const response = await api.post('/users/profile/avatar', formData);

            setProfile(response.data);
            showSuccess('Cập nhật ảnh đại diện thành công!');
        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            const message = error.response?.data?.message || 'Không thể tải lên ảnh đại diện. Vui lòng thử lại.';
            showError(message);
        } finally {
            setUploadingAvatar(false);
            setShowCropper(false);
            setCropImageUrl(null);
        }
    };

    // Save profile
    const handleSave = async () => {
        try {
            const response = await api.put('/users/profile', {
                name,
                bio,
                phone,
                email
            });
            setProfile(response.data);
            setEditing(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            showError('Không thể cập nhật thông tin');
        }
    };

    // Cancel editing
    const handleCancel = () => {
        if (profile) {
            setName(profile.name || '');
            setBio(profile.bio || '');
            setPhone(profile.phone || '');
            setEmail(profile.email || '');
        }
        setEditing(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <>
            <div className="max-w-2xl mx-auto p-6">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {/* Cover */}
                    <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                    
                    {/* Avatar & Name */}
                    <div className="relative px-6 pb-6">
                        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-16 sm:-mt-12">
                            {/* Avatar */}
                            <div className="relative">
                                <div className="w-28 h-28 rounded-full border-4 border-white bg-white shadow-lg overflow-hidden">
                                    {profile?.avatarUrl ? (
                                        <img
                                            src={resolveAvatarUrl(profile.avatarUrl) || ''}
                                            alt={profile.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                            <UserIcon className="h-20 w-20 text-gray-400" />
                                        </div>
                                    )}
                                </div>
                                
                                {/* Upload button */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingAvatar}
                                    className="absolute bottom-0 right-0 p-2 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 disabled:opacity-50"
                                >
                                    {uploadingAvatar ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Camera className="h-4 w-4" />
                                    )}
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleAvatarChange}
                                />
                            </div>
                            
                            {/* Name & Role */}
                            <div className="text-center sm:text-left sm:flex-1 sm:pb-2">
                                <h1 className="text-2xl font-bold text-gray-900">{profile?.name}</h1>
                                <p className="text-gray-500">@{profile?.username}</p>
                                <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                                    <span className={`
                                        px-2 py-0.5 text-xs rounded-full
                                        ${profile?.role === 'ADMIN' 
                                            ? 'bg-purple-100 text-purple-700' 
                                            : 'bg-blue-100 text-blue-700'
                                        }
                                    `}>
                                        {profile?.role === 'ADMIN' ? 'Quản trị viên' : 'Người dùng'}
                                    </span>
                                    {profile?.position && (
                                        <span className="text-sm text-gray-500">• {profile.position}</span>
                                    )}
                                </div>
                            </div>

                            {/* Edit button */}
                            <div className="sm:pb-2">
                                {!editing ? (
                                    <button
                                        onClick={() => setEditing(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                    >
                                        <Pencil className="h-4 w-4" />
                                        Chỉnh sửa
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCancel}
                                            className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                        >
                                            <X className="h-4 w-4" />
                                            Hủy
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                        >
                                            <Check className="h-4 w-4" />
                                            Lưu
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Profile Info */}
                <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold mb-4">Thông tin cá nhân</h2>
                    
                    <div className="space-y-4">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Họ và tên
                            </label>
                            {editing ? (
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            ) : (
                                <p className="px-3 py-2 bg-gray-50 rounded-lg">{profile?.name || '-'}</p>
                            )}
                        </div>

                        {/* Bio */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Giới thiệu bản thân
                            </label>
                            {editing ? (
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    rows={3}
                                    placeholder="Viết vài dòng giới thiệu về bạn..."
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            ) : (
                                <p className="px-3 py-2 bg-gray-50 rounded-lg min-h-[60px]">
                                    {profile?.bio || 'Chưa có thông tin'}
                                </p>
                            )}
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Phone className="h-4 w-4 inline mr-1" />
                                Số điện thoại
                            </label>
                            {editing ? (
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="0912345678"
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            ) : (
                                <p className="px-3 py-2 bg-gray-50 rounded-lg">{profile?.phone || 'Chưa cập nhật'}</p>
                            )}
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Mail className="h-4 w-4 inline mr-1" />
                                Email
                            </label>
                            {editing ? (
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            ) : (
                                <p className="px-3 py-2 bg-gray-50 rounded-lg">{profile?.email || 'Chưa cập nhật'}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Security */}
                <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold mb-4">Bảo mật</h2>
                    
                    <button
                        onClick={() => setShowPasswordModal(true)}
                        className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                        <Key className="h-5 w-5 text-gray-500" />
                        <span>Đổi mật khẩu</span>
                    </button>
                </div>

                {/* Account Info */}
                <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold mb-4">Thông tin tài khoản</h2>
                    
                    <div className="space-y-3 text-sm text-gray-600">
                        <div className="flex justify-between">
                            <span>Tên đăng nhập</span>
                            <span className="font-medium text-gray-900">@{profile?.username}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Vai trò</span>
                            <span className="font-medium text-gray-900">
                                {profile?.role === 'ADMIN' ? 'Quản trị viên' : 'Người dùng'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Ngày tham gia</span>
                            <span className="font-medium text-gray-900">
                                {profile?.createdAt && new Date(profile.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Change Password Modal */}
            {showPasswordModal && (
                <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
            )}

            {/* Image Cropper */}
            {showCropper && cropImageUrl && (
                <ImageCropper
                    imageUrl={cropImageUrl}
                    onCrop={uploadCroppedAvatar}
                    onCancel={() => {
                        setShowCropper(false);
                        setCropImageUrl(null);
                    }}
                />
            )}
        </>
    );
}

// Modal đổi mật khẩu
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
    const { showSuccess } = useDialog();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }

        if (newPassword.length < 6) {
            setError('Mật khẩu mới phải có ít nhất 6 ký tự');
            return;
        }

        setLoading(true);
        try {
            await api.post('/users/profile/change-password', {
                currentPassword,
                newPassword
            });
            showSuccess('Đổi mật khẩu thành công');
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Không thể đổi mật khẩu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md">
                <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="text-lg font-bold">Đổi mật khẩu</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Mật khẩu hiện tại
                        </label>
                        <div className="relative">
                            <input
                                type={showCurrent ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrent(!showCurrent)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                            >
                                {showCurrent ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Mật khẩu mới
                        </label>
                        <div className="relative">
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNew(!showNew)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                            >
                                {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Xác nhận mật khẩu mới
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                        >
                            {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export { ImageCropper };
