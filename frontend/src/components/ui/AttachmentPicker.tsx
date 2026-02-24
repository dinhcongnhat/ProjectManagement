import React, { useState, useRef } from 'react';
import { Paperclip, HardDrive, FolderOpen, ChevronUp } from 'lucide-react';
import { FilePickerDialog } from './FilePickerDialog';
import type { SelectedFile } from './FilePickerDialog';
import { API_URL } from '../../config/api';

// SVG Icons for Drive/OneDrive (Reused)
export const GoogleDriveIcon = ({ size = 20 }: { size?: number }) => (
    <svg viewBox="0 0 87.3 78" style={{ width: size, height: size }}>
        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.9 2.5 3.2 3.3l12.3-21.3-6.5-11.3H4.35C1.8 44.2.35 45.65.35 47.7c0 2.05.9 3.95 2.55 5.5l3.7 13.65z" fill="#0066da" />
        <path d="M43.65 25h13L43.85 3.45c-.8-1.4-1.9-2.5-3.2-3.3l-12.3 21.3 6.5 11.3h15.1c2.55 0 4-1.45 4-3.5 0-2.05-.9-3.95-2.55-5.5l-7.75-18.3z" fill="#00ac47" />
        <path d="M73.55 76.8c1.45-.8 2.5-1.9 3.3-3.2l12.75-22.1c.8-1.45.8-3.05.8-4.5 0-1.45-1-3.05-1.8-4.5l-6.35-11H52.1l11.75 20.35 9.7 25.45z" fill="#ea4335" />
        <path d="M43.65 25H11.55l7.75 13.45L31.6 59.9h30.15l-12.75-22.1-5.35-12.8z" fill="#00832d" />
        <path d="M73.55 76.8 53.4 41.9l-9.75-16.9H13.65L39.8 76.8h33.75z" fill="#2684fc" />
        <path d="M6.6 66.85 20.25 43.2l11.75 20.35-6.15 10.65c-2.05 1.2-4.5 1.2-6.55 0L6.6 66.85z" fill="#ffba00" />
    </svg>
);

import { GoogleDriveBrowser } from '../GoogleDrive/GoogleDriveBrowser';

interface AttachmentPickerProps {
    token: string;
    onFilesSelected: (files: File[]) => void;
    onFolderFilesSelected?: (files: SelectedFile[]) => void;
    onLinkSelected?: (link: { name: string; url: string; type: 'google-drive' }) => void;
    onKanbanCardSelected?: () => void;
    accept?: string;
    multiple?: boolean;
    className?: string;
    buttonClassName?: string;
    iconSize?: number;
    disabled?: boolean;
}

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
    token,
    onFilesSelected,
    onFolderFilesSelected,
    onLinkSelected,
    onKanbanCardSelected,
    accept,
    multiple = true,
    className = '',
    buttonClassName = '',
    iconSize = 20,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showFilePicker, setShowFilePicker] = useState(false);
    const [showDrivePicker, setShowDrivePicker] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectFromComputer = () => {
        setIsOpen(false);
        fileInputRef.current?.click();
    };

    const handleSelectFromFolder = () => {
        setIsOpen(false);
        setShowFilePicker(true);
    };

    const handleSelectFromDrive = () => {
        setIsOpen(false);
        setShowDrivePicker(true);
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            onFilesSelected(files);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFolderFilesSelected = async (selectedFiles: SelectedFile[]) => {
        if (onFolderFilesSelected) {
            onFolderFilesSelected(selectedFiles);
        } else {
            // Convert folder files to File objects by downloading them
            try {
                const files: File[] = [];
                for (const file of selectedFiles) {
                    const response = await fetch(`${API_URL}/folders/files/${file.id}/stream`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (response.ok) {
                        const blob = await response.blob();
                        const fileObj = new File([blob], file.name, { type: file.mimeType });
                        files.push(fileObj);
                    }
                }
                if (files.length > 0) {
                    onFilesSelected(files);
                }
            } catch (error) {
                console.error('Error downloading files from folder:', error);
            }
        }
    };

    // Parse accept types for FilePickerDialog
    const acceptTypes = accept ? accept.split(',').map(t => t.trim()) : undefined;

    return (
        <>
            <div className={`relative ${className}`} ref={dropdownRef}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={accept}
                    multiple={multiple}
                    onChange={handleFileInputChange}
                    className="hidden"
                />

                <button
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={buttonClassName || 'p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors'}
                    title="Đính kèm file"
                >
                    <div className="flex items-center gap-0.5">
                        <Paperclip size={iconSize} />
                        <ChevronUp size={8} className={`transition-transform ${isOpen ? '' : 'rotate-180'}`} />
                    </div>
                </button>

                {isOpen && (
                    <div className="absolute left-0 bottom-full mb-1 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999] py-1 min-w-[180px]">
                        <button
                            onClick={handleSelectFromComputer}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 transition-colors text-sm"
                        >
                            <HardDrive size={16} className="text-blue-500" />
                            <span className="text-gray-700">File từ thiết bị</span>
                        </button>
                        <button
                            onClick={handleSelectFromFolder}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 transition-colors text-sm"
                        >
                            <FolderOpen size={16} className="text-amber-500" />
                            <span className="text-gray-700">Từ Kho dữ liệu</span>
                        </button>
                        {onLinkSelected && (
                            <>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                    onClick={handleSelectFromDrive}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm transition-colors"
                                >
                                    <GoogleDriveIcon />
                                    <span className="text-gray-700">Google Drive</span>
                                </button>
                            </>
                        )}
                        {onKanbanCardSelected && (
                            <>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                    onClick={() => { setIsOpen(false); onKanbanCardSelected(); }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm transition-colors"
                                >
                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="3" y1="9" x2="21" y2="9"></line>
                                        <line x1="9" y1="21" x2="9" y2="9"></line>
                                    </svg>
                                    <span className="text-gray-700">Thẻ làm việc nhóm</span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <FilePickerDialog
                isOpen={showFilePicker}
                onClose={() => setShowFilePicker(false)}
                onSelect={handleFolderFilesSelected}
                token={token}
                multiple={multiple}
                acceptTypes={acceptTypes}
            />

            {/* Google Drive Picker Modal */}
            {showDrivePicker && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
                    onClick={() => setShowDrivePicker(false)}
                >
                    <div
                        className="w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GoogleDriveBrowser
                            onClose={() => setShowDrivePicker(false)}
                            mode="select"
                            onSelectFiles={(files) => {
                                onFilesSelected(files);
                                setShowDrivePicker(false);
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default AttachmentPicker;
