import { useState, useEffect } from 'react';
import { X, Save, Loader2, Calendar, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { useDialog } from './ui/Dialog';

interface UserData {
    id: number;
    name: string;
    role: string;
}

interface SubProjectData {
    id: number;
    code: string;
    name: string;
    description?: string;
    documentNumber?: string;
    documentDate?: string;
    implementingUnit?: string;
    appraisalUnit?: string;
    approver?: string;
    startDate?: string;
    endDate?: string;
    productType?: string;
    value?: string;
    priority?: 'NORMAL' | 'HIGH';
    status?: 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'COMPLETED';
    manager?: { id: number; name: string };
    implementers?: { id: number; name: string }[];
    cooperators?: { id: number; name: string }[];
}

interface EditSubProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    subProject: SubProjectData | null;
    users: UserData[];
}

export const EditSubProjectModal = ({
    isOpen,
    onClose,
    onSuccess,
    subProject,
    users
}: EditSubProjectModalProps) => {
    const { token } = useAuth();
    const { showSuccess, showError } = useDialog();
    const [isSaving, setIsSaving] = useState(false);
    const [showManagerDropdown, setShowManagerDropdown] = useState(false);
    const [showImplementerDropdown, setShowImplementerDropdown] = useState(false);
    const [showCooperatorDropdown, setShowCooperatorDropdown] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        documentNumber: '',
        documentDate: '',
        implementingUnit: '',
        appraisalUnit: '',
        approver: '',
        startDate: '',
        endDate: '',
        productType: '',
        value: '',
        priority: 'NORMAL',
        status: 'IN_PROGRESS',
        managerId: '',
        implementerIds: [] as string[],
        cooperatorIds: [] as string[],
    });

    // Load sub-project data when modal opens
    useEffect(() => {
        if (isOpen && subProject) {
            setFormData({
                name: subProject.name || '',
                description: subProject.description || '',
                documentNumber: subProject.documentNumber || '',
                documentDate: subProject.documentDate ? subProject.documentDate.split('T')[0] : '',
                implementingUnit: subProject.implementingUnit || '',
                appraisalUnit: subProject.appraisalUnit || '',
                approver: subProject.approver || '',
                startDate: subProject.startDate ? subProject.startDate.split('T')[0] : '',
                endDate: subProject.endDate ? subProject.endDate.split('T')[0] : '',
                productType: subProject.productType || '',
                value: subProject.value || '',
                priority: subProject.priority || 'NORMAL',
                status: subProject.status || 'IN_PROGRESS',
                managerId: subProject.manager?.id.toString() || '',
                implementerIds: subProject.implementers?.map(u => u.id.toString()) || [],
                cooperatorIds: subProject.cooperators?.map(u => u.id.toString()) || [],
            });
        }
    }, [isOpen, subProject]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subProject) return;

        setIsSaving(true);
        try {
            const response = await fetch(`${API_URL}/projects/${subProject.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...formData,
                    code: subProject.code, // Keep original code
                }),
            });

            if (response.ok) {
                showSuccess('Dự án con đã được cập nhật thành công!');
                onSuccess();
                onClose();
            } else {
                const error = await response.json();
                showError(error.message || 'Không thể cập nhật dự án con');
            }
        } catch (error) {
            console.error('Error updating sub-project:', error);
            showError('Có lỗi xảy ra khi cập nhật dự án con');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !subProject) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-3xl mx-4 max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white">Chỉnh sửa dự án con</h2>
                        <p className="text-white/80 text-sm mt-0.5">{subProject.code}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="bg-gray-50 rounded-xl p-4">
                            <h3 className="font-semibold text-gray-900 mb-4">Thông tin cơ bản</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tên công việc <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        rows={3}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Document Info */}
                        <div className="bg-cyan-50 rounded-xl p-4">
                            <h3 className="font-semibold text-gray-900 mb-4">Thông tin văn bản</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Số hiệu văn bản</label>
                                    <input
                                        type="text"
                                        name="documentNumber"
                                        value={formData.documentNumber}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày văn bản</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            name="documentDate"
                                            value={formData.documentDate}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                        />
                                        <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị thực hiện</label>
                                    <input
                                        type="text"
                                        name="implementingUnit"
                                        value={formData.implementingUnit}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị thẩm định</label>
                                    <input
                                        type="text"
                                        name="appraisalUnit"
                                        value={formData.appraisalUnit}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Người phê duyệt</label>
                                    <input
                                        type="text"
                                        name="approver"
                                        value={formData.approver}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Loại sản phẩm</label>
                                    <input
                                        type="text"
                                        name="productType"
                                        value={formData.productType}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Schedule & Priority */}
                        <div className="bg-amber-50 rounded-xl p-4">
                            <h3 className="font-semibold text-gray-900 mb-4">Thời gian & Ưu tiên</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            name="startDate"
                                            value={formData.startDate}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                        />
                                        <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
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
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                        />
                                        <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Giá trị (VNĐ)</label>
                                    <input
                                        type="text"
                                        name="value"
                                        value={formData.value}
                                        onChange={handleChange}
                                        placeholder="0"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mức độ ưu tiên</label>
                                    <select
                                        name="priority"
                                        value={formData.priority}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${formData.priority === 'HIGH' ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300'
                                            }`}
                                    >
                                        <option value="NORMAL">Bình thường</option>
                                        <option value="HIGH">Ưu tiên cao</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    >
                                        <option value="IN_PROGRESS">Đang thực hiện</option>
                                        <option value="PENDING_APPROVAL">Chờ phê duyệt</option>
                                        <option value="COMPLETED">Hoàn thành</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Team Assignment */}
                        <div className="bg-violet-50 rounded-xl p-4">
                            <h3 className="font-semibold text-gray-900 mb-4">Phân công nhân sự</h3>
                            <div className="space-y-4">
                                {/* Manager */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Người quản lý <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowManagerDropdown(!showManagerDropdown)}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-left flex items-center justify-between bg-white focus:ring-2 focus:ring-violet-500"
                                        >
                                            <span className={formData.managerId ? 'text-gray-900' : 'text-gray-400'}>
                                                {formData.managerId
                                                    ? users.find(u => u.id.toString() === formData.managerId)?.name
                                                    : 'Chọn người quản lý'}
                                            </span>
                                            <ChevronDown size={16} className="text-gray-400" />
                                        </button>
                                        {showManagerDropdown && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                {users.map(user => (
                                                    <button
                                                        key={user.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData(prev => ({ ...prev, managerId: user.id.toString() }));
                                                            setShowManagerDropdown(false);
                                                        }}
                                                        className="w-full px-4 py-2 text-left hover:bg-violet-50 flex items-center justify-between"
                                                    >
                                                        <span>{user.name}</span>
                                                        {formData.managerId === user.id.toString() && (
                                                            <Check size={16} className="text-violet-600" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Implementers */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Người thực hiện</label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowImplementerDropdown(!showImplementerDropdown)}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-left flex items-center justify-between bg-white focus:ring-2 focus:ring-violet-500"
                                        >
                                            <span className={formData.implementerIds.length > 0 ? 'text-gray-900' : 'text-gray-400'}>
                                                {formData.implementerIds.length > 0
                                                    ? `${formData.implementerIds.length} người được chọn`
                                                    : 'Chọn người thực hiện'}
                                            </span>
                                            <ChevronDown size={16} className="text-gray-400" />
                                        </button>
                                        {showImplementerDropdown && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                {users.map(user => (
                                                    <button
                                                        key={user.id}
                                                        type="button"
                                                        onClick={() => {
                                                            const id = user.id.toString();
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                implementerIds: prev.implementerIds.includes(id)
                                                                    ? prev.implementerIds.filter(i => i !== id)
                                                                    : [...prev.implementerIds, id]
                                                            }));
                                                        }}
                                                        className="w-full px-4 py-2 text-left hover:bg-violet-50 flex items-center justify-between"
                                                    >
                                                        <span>{user.name}</span>
                                                        {formData.implementerIds.includes(user.id.toString()) && (
                                                            <Check size={16} className="text-violet-600" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {formData.implementerIds.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {formData.implementerIds.map(id => {
                                                const user = users.find(u => u.id.toString() === id);
                                                return user ? (
                                                    <span key={id} className="px-2 py-1 bg-violet-100 text-violet-700 text-xs rounded-full flex items-center gap-1">
                                                        {user.name}
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({
                                                                ...prev,
                                                                implementerIds: prev.implementerIds.filter(i => i !== id)
                                                            }))}
                                                            className="hover:text-violet-900"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Cooperators */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Người phối hợp</label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowCooperatorDropdown(!showCooperatorDropdown)}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-left flex items-center justify-between bg-white focus:ring-2 focus:ring-violet-500"
                                        >
                                            <span className={formData.cooperatorIds.length > 0 ? 'text-gray-900' : 'text-gray-400'}>
                                                {formData.cooperatorIds.length > 0
                                                    ? `${formData.cooperatorIds.length} người được chọn`
                                                    : 'Chọn người phối hợp'}
                                            </span>
                                            <ChevronDown size={16} className="text-gray-400" />
                                        </button>
                                        {showCooperatorDropdown && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                {users.map(user => (
                                                    <button
                                                        key={user.id}
                                                        type="button"
                                                        onClick={() => {
                                                            const id = user.id.toString();
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                cooperatorIds: prev.cooperatorIds.includes(id)
                                                                    ? prev.cooperatorIds.filter(i => i !== id)
                                                                    : [...prev.cooperatorIds, id]
                                                            }));
                                                        }}
                                                        className="w-full px-4 py-2 text-left hover:bg-violet-50 flex items-center justify-between"
                                                    >
                                                        <span>{user.name}</span>
                                                        {formData.cooperatorIds.includes(user.id.toString()) && (
                                                            <Check size={16} className="text-violet-600" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {formData.cooperatorIds.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {formData.cooperatorIds.map(id => {
                                                const user = users.find(u => u.id.toString() === id);
                                                return user ? (
                                                    <span key={id} className="px-2 py-1 bg-teal-100 text-teal-700 text-xs rounded-full flex items-center gap-1">
                                                        {user.name}
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({
                                                                ...prev,
                                                                cooperatorIds: prev.cooperatorIds.filter(i => i !== id)
                                                            }))}
                                                            className="hover:text-teal-900"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !formData.name || !formData.managerId}
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-500/25"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Đang lưu...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Lưu thay đổi
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
