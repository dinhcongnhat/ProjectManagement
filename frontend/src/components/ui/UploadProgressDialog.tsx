import React from 'react';
import { X, CloudUpload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export interface UploadFile {
    name: string;
    size: number;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    error?: string;
}

interface UploadProgressDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    files: UploadFile[];
    totalProgress: number;
    status: 'idle' | 'uploading' | 'completed' | 'error';
    canClose?: boolean;
}

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
        case 'completed':
            return <CheckCircle size={16} className="text-green-500" />;
        case 'error':
            return <AlertCircle size={16} className="text-red-500" />;
        case 'uploading':
            return <Loader2 size={16} className="text-blue-500 animate-spin" />;
        default:
            return <CloudUpload size={16} className="text-gray-400" />;
    }
};

const getStatusColor = (status: UploadFile['status']) => {
    switch (status) {
        case 'completed':
            return 'bg-green-500';
        case 'error':
            return 'bg-red-500';
        case 'uploading':
            return 'bg-blue-500';
        default:
            return 'bg-gray-300';
    }
};

export const UploadProgressDialog: React.FC<UploadProgressDialogProps> = ({
    isOpen,
    onClose,
    title = 'Đang tải lên...',
    files,
    totalProgress,
    status,
    canClose = true
}) => {
    if (!isOpen) return null;

    const getOverallStatusText = () => {
        switch (status) {
            case 'uploading':
                return `Đang tải lên ${files.length} tệp...`;
            case 'completed':
                return `Đã tải lên thành công ${files.length} tệp!`;
            case 'error':
                return 'Có lỗi xảy ra khi tải tệp';
            default:
                return 'Chuẩn bị tải lên...';
        }
    };

    const getOverallIcon = () => {
        switch (status) {
            case 'uploading':
                return <Loader2 size={32} className="text-blue-500 animate-spin" />;
            case 'completed':
                return <CheckCircle size={32} className="text-green-500" />;
            case 'error':
                return <AlertCircle size={32} className="text-red-500" />;
            default:
                return <CloudUpload size={32} className="text-gray-400" />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <CloudUpload size={20} className="text-blue-600" />
                        {title}
                    </h3>
                    {canClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Overall Progress */}
                    <div className="text-center space-y-3">
                        <div className="flex justify-center">
                            {getOverallIcon()}
                        </div>
                        <p className="text-sm text-gray-600">{getOverallStatusText()}</p>

                        {/* Total Progress Bar */}
                        <div className="space-y-1">
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${status === 'completed' ? 'bg-green-500' :
                                            status === 'error' ? 'bg-red-500' :
                                                'bg-gradient-to-r from-blue-500 to-indigo-500'
                                        }`}
                                    style={{ width: `${totalProgress}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-500 font-medium">{Math.round(totalProgress)}%</p>
                        </div>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-100 rounded-lg p-2 bg-gray-50">
                            {files.map((file, index) => (
                                <div key={index} className="bg-white rounded-lg p-2 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(file.status)}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-700 truncate">
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {formatFileSize(file.size)}
                                            </p>
                                        </div>
                                        <span className={`text-xs font-medium ${file.status === 'completed' ? 'text-green-600' :
                                                file.status === 'error' ? 'text-red-600' :
                                                    'text-blue-600'
                                            }`}>
                                            {file.status === 'completed' ? '✓' :
                                                file.status === 'error' ? '✗' :
                                                    `${Math.round(file.progress)}%`}
                                        </span>
                                    </div>
                                    {/* Individual file progress */}
                                    {file.status === 'uploading' && (
                                        <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${getStatusColor(file.status)}`}
                                                style={{ width: `${file.progress}%` }}
                                            />
                                        </div>
                                    )}
                                    {file.error && (
                                        <p className="mt-1 text-xs text-red-500">{file.error}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {(status === 'completed' || status === 'error') && canClose && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50">
                        <button
                            onClick={onClose}
                            className={`w-full py-2.5 rounded-lg font-medium text-white transition-colors ${status === 'completed'
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-red-600 hover:bg-red-700'
                                }`}
                        >
                            {status === 'completed' ? 'Hoàn tất' : 'Đóng'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadProgressDialog;
