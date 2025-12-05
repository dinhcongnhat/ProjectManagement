import React, { useEffect, useRef } from 'react';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

// Dialog types
type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title?: string;
    message: string;
    type?: DialogType;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
}

const Dialog: React.FC<DialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'info',
    confirmText = 'OK',
    cancelText = 'Hủy',
    showCancel = false
}) => {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Focus trap
    useEffect(() => {
        if (isOpen && dialogRef.current) {
            dialogRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-12 h-12 text-green-500" />;
            case 'warning':
            case 'confirm':
                return <AlertTriangle className="w-12 h-12 text-amber-500" />;
            case 'error':
                return <AlertCircle className="w-12 h-12 text-red-500" />;
            default:
                return <Info className="w-12 h-12 text-blue-500" />;
        }
    };

    const getButtonColor = () => {
        switch (type) {
            case 'success':
                return 'bg-green-500 hover:bg-green-600 focus:ring-green-300';
            case 'warning':
            case 'confirm':
                return 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-300';
            case 'error':
                return 'bg-red-500 hover:bg-red-600 focus:ring-red-300';
            default:
                return 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300';
        }
    };

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
                onClick={onClose}
            />
            
            {/* Dialog */}
            <div 
                ref={dialogRef}
                tabIndex={-1}
                className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full transform animate-scaleIn overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                >
                    <X size={20} />
                </button>

                {/* Content */}
                <div className="p-6 pt-8 text-center">
                    {/* Icon */}
                    <div className="flex justify-center mb-4">
                        {getIcon()}
                    </div>

                    {/* Title */}
                    {title && (
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {title}
                        </h3>
                    )}

                    {/* Message */}
                    <p className="text-gray-600 mb-6 whitespace-pre-wrap">
                        {message}
                    </p>

                    {/* Actions */}
                    <div className={`flex gap-3 ${showCancel || type === 'confirm' ? 'justify-center' : 'justify-center'}`}>
                        {(showCancel || type === 'confirm') && (
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                            >
                                {cancelText}
                            </button>
                        )}
                        <button
                            onClick={handleConfirm}
                            className={`px-6 py-2.5 rounded-xl text-white font-medium transition-colors focus:outline-none focus:ring-2 ${getButtonColor()}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dialog;

// ==================== Dialog Context & Hook ====================

interface DialogContextType {
    showAlert: (message: string, options?: Partial<AlertOptions>) => void;
    showConfirm: (message: string, options?: Partial<ConfirmOptions>) => Promise<boolean>;
    showSuccess: (message: string, options?: Partial<AlertOptions>) => void;
    showError: (message: string, options?: Partial<AlertOptions>) => void;
    showWarning: (message: string, options?: Partial<AlertOptions>) => void;
}

interface AlertOptions {
    title?: string;
    confirmText?: string;
    type?: DialogType;
}

interface ConfirmOptions {
    title?: string;
    confirmText?: string;
    cancelText?: string;
}

const DialogContext = React.createContext<DialogContextType | null>(null);

interface DialogState {
    isOpen: boolean;
    type: DialogType;
    title?: string;
    message: string;
    confirmText: string;
    cancelText: string;
    showCancel: boolean;
    onConfirm?: () => void;
    onClose?: () => void;
}

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [dialog, setDialog] = React.useState<DialogState>({
        isOpen: false,
        type: 'info',
        message: '',
        confirmText: 'OK',
        cancelText: 'Hủy',
        showCancel: false
    });

    const closeDialog = () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
    };

    const showAlert = (message: string, options: Partial<AlertOptions> = {}) => {
        setDialog({
            isOpen: true,
            type: options.type || 'info',
            title: options.title,
            message,
            confirmText: options.confirmText || 'OK',
            cancelText: 'Hủy',
            showCancel: false
        });
    };

    const showSuccess = (message: string, options: Partial<AlertOptions> = {}) => {
        showAlert(message, { ...options, type: 'success' });
    };

    const showError = (message: string, options: Partial<AlertOptions> = {}) => {
        showAlert(message, { ...options, type: 'error' });
    };

    const showWarning = (message: string, options: Partial<AlertOptions> = {}) => {
        showAlert(message, { ...options, type: 'warning' });
    };

    const showConfirm = (message: string, options: Partial<ConfirmOptions> = {}): Promise<boolean> => {
        return new Promise((resolve) => {
            setDialog({
                isOpen: true,
                type: 'confirm',
                title: options.title || 'Xác nhận',
                message,
                confirmText: options.confirmText || 'Xác nhận',
                cancelText: options.cancelText || 'Hủy',
                showCancel: true,
                onConfirm: () => {
                    resolve(true);
                },
                onClose: () => {
                    resolve(false);
                }
            });
        });
    };

    const handleClose = () => {
        if (dialog.onClose) {
            dialog.onClose();
        }
        closeDialog();
    };

    const handleConfirm = () => {
        if (dialog.onConfirm) {
            dialog.onConfirm();
        }
        closeDialog();
    };

    return (
        <DialogContext.Provider value={{ showAlert, showConfirm, showSuccess, showError, showWarning }}>
            {children}
            <Dialog
                isOpen={dialog.isOpen}
                onClose={handleClose}
                onConfirm={handleConfirm}
                title={dialog.title}
                message={dialog.message}
                type={dialog.type}
                confirmText={dialog.confirmText}
                cancelText={dialog.cancelText}
                showCancel={dialog.showCancel}
            />
        </DialogContext.Provider>
    );
};

export const useDialog = (): DialogContextType => {
    const context = React.useContext(DialogContext);
    if (!context) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
};
