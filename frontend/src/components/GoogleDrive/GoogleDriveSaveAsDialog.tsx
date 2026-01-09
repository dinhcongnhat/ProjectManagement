import { useState, useEffect } from 'react';
import { X, Folder, Home, ChevronRight, Loader2, Plus, HardDrive, Smartphone } from 'lucide-react';
import { API_URL } from '../../config/api';

interface GoogleDriveSaveAsDialogProps {
    fileId: string;
    fileName: string;
    token: string;
    onClose: () => void;
    onSuccess: () => void;
}

interface DriveFolder {
    id: string;
    name: string;
    mimeType: string;
}

interface SystemFolder {
    id: number;
    name: string;
}

export const GoogleDriveSaveAsDialog = ({ fileId, fileName, token, onClose, onSuccess }: GoogleDriveSaveAsDialogProps) => {
    const [activeTab, setActiveTab] = useState<'drive' | 'system'>('drive');
    const [name, setName] = useState(fileName);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Drive State
    const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
    const [driveBreadcrumbs, setDriveBreadcrumbs] = useState<DriveFolder[]>([]);
    const [currentDriveFolderId, setCurrentDriveFolderId] = useState<string | null>(null);

    // System State
    const [systemFolders, setSystemFolders] = useState<SystemFolder[]>([]);
    const [systemBreadcrumbs, setSystemBreadcrumbs] = useState<SystemFolder[]>([]);
    const [currentSystemFolderId, setCurrentSystemFolderId] = useState<number | null>(null);

    // New Folder State
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    useEffect(() => {
        if (activeTab === 'drive') {
            fetchDriveFolders(currentDriveFolderId);
        } else {
            fetchSystemFolders(currentSystemFolderId);
        }
    }, [activeTab, currentDriveFolderId, currentSystemFolderId]);

    const fetchDriveFolders = async (folderId: string | null) => {
        setLoading(true);
        try {
            let url = `${API_URL}/drive/files`;
            if (folderId) {
                url = `${API_URL}/drive/files?folderId=${folderId}`;
            }

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (res.ok) {
                const allFiles = data.files || [];
                const folderList = allFiles.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder');
                setDriveFolders(folderList);
                // Simple breadcrumb logic: push if going deeper. Pop if going back is harder without full path.
                // For MVP, if we click a folder, we push. To go back, we rely on "Root" or "Back" buttons if simpler.
                // Better: keep track of path.
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSystemFolders = async (parentId: number | null) => {
        setLoading(true);
        try {
            const url = parentId
                ? `${API_URL}/folders?parentId=${parentId}`
                : `${API_URL}/folders`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (res.ok) {
                setSystemFolders(data.folders || []);
                setSystemBreadcrumbs(data.breadcrumbs || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        try {
            setLoading(true);
            if (activeTab === 'drive') {
                const res = await fetch(`${API_URL}/drive/folders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ name: newFolderName, parentId: currentDriveFolderId })
                });
                if (res.ok) {
                    await fetchDriveFolders(currentDriveFolderId);
                    setShowNewFolderInput(false);
                    setNewFolderName('');
                } else {
                    const data = await res.json();
                    alert(data.message || 'Failed to create Drive folder');
                }
            } else {
                const res = await fetch(`${API_URL}/folders/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ name: newFolderName, parentId: currentSystemFolderId })
                });
                if (res.ok) {
                    await fetchSystemFolders(currentSystemFolderId);
                    setShowNewFolderInput(false);
                    setNewFolderName('');
                } else {
                    const data = await res.json();
                    alert(data.message || 'Lỗi khi tạo thư mục hệ thống');
                }
            }
        } catch (e) {
            console.error(e);
            alert('Lỗi kết nối hoặc xử lý yêu cầu');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            let url = '';
            let body = {};

            if (activeTab === 'drive') {
                url = `${API_URL}/onlyoffice/drive/save-as/${fileId}`;
                body = { title: name, parentId: currentDriveFolderId };
            } else {
                url = `${API_URL}/onlyoffice/drive/save-to-system/${fileId}`;
                body = { title: name, parentId: currentSystemFolderId };
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (data.error) {
                alert(data.message || 'Failed to save');
            } else {
                onSuccess();
                onClose();
            }
        } catch (e) {
            console.error(e);
            alert('Error saving file');
        } finally {
            setSaving(false);
        }
    };

    const handleDriveFolderClick = (folder: DriveFolder) => {
        setDriveBreadcrumbs([...driveBreadcrumbs, folder]);
        setCurrentDriveFolderId(folder.id);
    };

    const handleDriveRootClick = () => {
        setDriveBreadcrumbs([]);
        setCurrentDriveFolderId(null);
    };

    const handleDriveBreadcrumbClick = (index: number) => {
        const newCrumbs = driveBreadcrumbs.slice(0, index + 1);
        setDriveBreadcrumbs(newCrumbs);
        setCurrentDriveFolderId(newCrumbs[newCrumbs.length - 1].id);
    };

    const handleSystemFolderClick = (folder: SystemFolder) => {
        // Breadcrumbs handled by backend response
        setCurrentSystemFolderId(folder.id);
    };

    return (
        <div className="fixed inset-0 z-[10001] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                    <h2 className="text-lg font-semibold text-gray-800">Lưu bản sao</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('drive')}
                        className={`flex-1 py-3 px-4 font-medium text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'drive'
                            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <HardDrive size={18} />
                        Google Drive
                    </button>
                    <button
                        onClick={() => setActiveTab('system')}
                        className={`flex-1 py-3 px-4 font-medium text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'system'
                            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Smartphone size={18} />
                        Thư mục người dùng
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 p-3 border-b text-sm overflow-x-auto whitespace-nowrap bg-gray-50/50">
                        <button
                            onClick={activeTab === 'drive' ? handleDriveRootClick : () => setCurrentSystemFolderId(null)}
                            className="flex items-center gap-1 text-gray-600 hover:text-blue-600 px-1 py-0.5 rounded"
                        >
                            <Home size={14} />
                            <span>Gốc</span>
                        </button>
                        {(activeTab === 'drive' ? driveBreadcrumbs : systemBreadcrumbs).map((crumb, index) => (
                            <div key={crumb.id} className="flex items-center gap-1">
                                <ChevronRight size={14} className="text-gray-400" />
                                <button
                                    onClick={() => activeTab === 'drive' ? handleDriveBreadcrumbClick(index) : setCurrentSystemFolderId((crumb as SystemFolder).id)}
                                    className="text-gray-600 hover:text-blue-600 px-1 py-0.5 rounded hover:bg-gray-200 max-w-[150px] truncate"
                                    title={(crumb as any).name}
                                >
                                    {(crumb as any).name}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Toolbar */}
                    <div className="p-3 border-b flex justify-between items-center bg-white">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">
                            {activeTab === 'drive' ? 'Thư mục Drive' : 'Thư mục Hệ thống'}
                        </span>
                        <div className="flex items-center gap-2">
                            {/* Create Folder Logic */}
                            {showNewFolderInput ? (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newFolderName}
                                        onChange={e => setNewFolderName(e.target.value)}
                                        className="text-sm border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none w-40"
                                        placeholder="Tên thư mục..."
                                        onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                                    />
                                    <button onClick={handleCreateFolder} className="text-blue-600 hover:bg-blue-50 p-1 rounded">
                                        <Plus size={16} />
                                    </button>
                                    <button onClick={() => setShowNewFolderInput(false)} className="text-gray-500 hover:bg-gray-100 p-1 rounded">
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowNewFolderInput(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                >
                                    <Plus size={16} />
                                    <span>Tạo thư mục</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Folder List */}
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-[200px]">
                        {loading && !activeTab ? (
                            <div className="flex justify-center items-center h-full">
                                <Loader2 className="animate-spin text-blue-500" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {(activeTab === 'drive' ? driveFolders : systemFolders).length === 0 ? (
                                    <div className="col-span-full flex flex-col items-center justify-center text-gray-400 py-10">
                                        <Folder size={48} className="mb-2 opacity-20" />
                                        <p>Thư mục trống</p>
                                    </div>
                                ) : (
                                    (activeTab === 'drive' ? driveFolders : systemFolders).map((folder: any) => (
                                        <button
                                            key={folder.id}
                                            onClick={() => activeTab === 'drive' ? handleDriveFolderClick(folder) : handleSystemFolderClick(folder)}
                                            className="flex flex-col items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all group text-center"
                                        >
                                            <Folder className="w-10 h-10 text-yellow-400 mb-3 group-hover:scale-110 transition-transform" fill="currentColor" fillOpacity={0.2} />
                                            <span className="text-sm text-gray-700 font-medium line-clamp-2 w-full break-words leading-snug">
                                                {folder.name}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Input */}
                <div className="p-4 border-t bg-white flex flex-col gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tên file mới</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Nhập tên file..."
                            />
                            <div className="flex items-center px-4 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 font-medium select-none">
                                {fileName.includes('.') ? `.${fileName.split('.').pop()}` : ''}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !name.trim()}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none flex items-center gap-2 transition-all active:scale-95"
                        >
                            {saving && <Loader2 size={18} className="animate-spin" />}
                            Lưu bản sao
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
