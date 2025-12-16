import React, { useState, useRef } from 'react';
import { Paperclip, HardDrive, FolderOpen, ChevronUp } from 'lucide-react';
import { FilePickerDialog } from './FilePickerDialog';
import type { SelectedFile } from './FilePickerDialog';
import { API_URL } from '../../config/api';

interface AttachmentPickerProps {
    token: string;
    onFilesSelected: (files: File[]) => void;
    onFolderFilesSelected?: (files: SelectedFile[]) => void;
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
    accept,
    multiple = true,
    className = '',
    buttonClassName = '',
    iconSize = 20,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showFilePicker, setShowFilePicker] = useState(false);
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

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            onFilesSelected(files);
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
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
                    <div className="absolute left-0 bottom-full mb-1 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999] py-1 min-w-[160px]">
                        <button
                            onClick={handleSelectFromComputer}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 transition-colors text-sm"
                        >
                            <HardDrive size={16} className="text-blue-500" />
                            <span className="text-gray-700">Từ máy tính</span>
                        </button>
                        <button
                            onClick={handleSelectFromFolder}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 transition-colors text-sm"
                        >
                            <FolderOpen size={16} className="text-amber-500" />
                            <span className="text-gray-700">Từ thư mục</span>
                        </button>
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
        </>
    );
};

export default AttachmentPicker;
