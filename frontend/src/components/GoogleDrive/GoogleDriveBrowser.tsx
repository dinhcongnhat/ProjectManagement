import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { googleDriveService } from '../../services/googleDriveService';
import { Folder, ChevronRight, Search, Check, Loader2, LogOut, X, List, LayoutGrid, Star, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { GoogleDriveViewer } from './GoogleDriveViewer'; // Import the new viewer
import { GoogleDriveIcon } from '../ui/AttachmentPicker'; // Import shared icon


interface GoogleDriveBrowserProps {
    projectId?: number;
    onLinkSuccess?: () => void;
    onSelectFiles?: (files: File[]) => void;
    onClose: () => void;
    mode?: 'link' | 'browse' | 'select';
}

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    iconLink: string;
    webViewLink: string;
    hasThumbnail: boolean;
    thumbnailLink?: string;
    starred?: boolean;
}

// Helper to check if file is supported by OnlyOffice
const isOfficeFile = (mimeType: string, name: string): boolean => {
    // Check by mime type first
    if (mimeType.includes('word') ||
        mimeType.includes('excel') ||
        mimeType.includes('spreadsheet') ||
        mimeType.includes('powerpoint') ||
        mimeType.includes('presentation') ||
        mimeType.includes('pdf') ||
        mimeType.includes('application/vnd.google-apps.document') ||
        mimeType.includes('application/vnd.google-apps.spreadsheet') ||
        mimeType.includes('application/vnd.google-apps.presentation')) {
        return true;
    }

    // Check by extension
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const officeExts = [
        'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'fodt', 'ott', 'rtf', 'txt',
        'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'ods', 'fods', 'ots', 'csv',
        'ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'odp', 'fodp', 'otp',
        'pdf'
    ];
    return officeExts.includes(ext);
};

export const GoogleDriveBrowser: React.FC<GoogleDriveBrowserProps> = ({
    projectId,
    onLinkSuccess,
    onSelectFiles,
    onClose,
    mode = projectId ? 'link' : 'browse'
}) => {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const { logout, token } = useAuth(); // Get token
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string, name: string }[]>([{ id: 'root', name: 'My Drive' }]);
    const [currentFolderId, setCurrentFolderId] = useState<string>('root');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<DriveFile[]>([]);
    const [isLinking, setIsLinking] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [viewingFile, setViewingFile] = useState<{ id: string, name: string } | null>(null);

    const [viewingImage, setViewingImage] = useState<{ id: string, name: string, url?: string } | null>(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'my-drive' | 'starred' | 'shared-with-me'>('my-drive');

    // Handle Star Toggle
    const handleToggleStar = async (e: React.MouseEvent, file: DriveFile) => {
        e.stopPropagation();
        const newStatus = !file.starred;

        // Optimistic update
        setFiles(files.map(f => f.id === file.id ? { ...f, starred: newStatus } : f));

        try {
            await googleDriveService.toggleStar(file.id, newStatus);
            // If we are in Starred tab and user unstars, should we remove it?
            // For now, let's keep it visible until refresh or navigation to avoid UI jumping
        } catch (err) {
            console.error('Failed to toggle star', err);
            toast.error('Failed to update star status');
            // Revert
            setFiles(files.map(f => f.id === file.id ? { ...f, starred: !newStatus } : f));
        }
    };

    // Helper to check if file is an image
    const isImageFile = (mimeType: string, name: string): boolean => {
        if (mimeType.startsWith('image/')) return true;
        const ext = name.split('.').pop()?.toLowerCase() || '';
        return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
    };

    // Initial check for connection
    useEffect(() => {
        const check = async () => {
            try {
                const status = await googleDriveService.checkConnection();
                if (status.connected) {
                    setIsAuthenticated(true);
                    loadFiles('root');
                } else {
                    setIsAuthenticated(false);
                }
            } catch (e) {
                console.error(e);
                setIsAuthenticated(false);
            }
        };
        check();
    }, []);

    const loadFiles = async (folderId: string, query?: string) => {
        setLoading(true);
        try {
            const isStarred = activeTab === 'starred';
            const isShared = activeTab === 'shared-with-me';

            // For Shared tab, we only filter by sharedWithMe when at root. 
            // Once we navigate into a folder, we list that folder's content normally.
            const shouldFilterShared = isShared && folderId === 'root';

            const data = await googleDriveService.listFiles(
                isStarred ? undefined : (folderId !== 'root' ? folderId : undefined),
                query,
                isStarred,
                shouldFilterShared
            );

            // Sort: Folders first, then alphabetically
            const sortedFiles = data.files.sort((a: DriveFile, b: DriveFile) => {
                const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
                const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';

                if (aIsFolder && !bIsFolder) return -1;
                if (!aIsFolder && bIsFolder) return 1;
                return a.name.localeCompare(b.name);
            });

            setFiles(sortedFiles);
            setIsAuthenticated(true);
        } catch (error: any) {
            console.error(error);
            if (error.response?.status === 401) {
                logout();
            } else if (error.response?.status === 400) {
                setIsAuthenticated(false);
            } else {
                const errorMsg = error.response?.data?.details || error.response?.data?.error || 'Failed to load Google Drive files';
                toast.error(errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    // Debounce search query - only update after 500ms of no typing
    useEffect(() => {
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }
        searchTimerRef.current = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 500);
        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
            }
        };
    }, [searchQuery]);

    // Load files when auth is confirmed or folder changes or tab changes
    useEffect(() => {
        if (isAuthenticated === true) {
            loadFiles(currentFolderId, debouncedSearchQuery);
        }
    }, [currentFolderId, isAuthenticated, debouncedSearchQuery, activeTab]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Immediately trigger search on form submit (Enter key)
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }
        setDebouncedSearchQuery(searchQuery);
    };

    const handleFolderClick = (file: DriveFile) => {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
            setBreadcrumbs([...breadcrumbs, { id: file.id, name: file.name }]);
            setCurrentFolderId(file.id);
            setSearchQuery('');
            setDebouncedSearchQuery('');
        }
    };

    const handleBreadcrumbClick = (index: number) => {
        const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
        setBreadcrumbs(newBreadcrumbs);
        setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
        setSearchQuery('');
        setDebouncedSearchQuery('');
    };

    const toggleSelection = (file: DriveFile) => {
        if (selectedFiles.find(f => f.id === file.id)) {
            setSelectedFiles(selectedFiles.filter(f => f.id !== file.id));
        } else {
            setSelectedFiles([...selectedFiles, file]);
        }
    };

    const handleConnect = async () => {
        try {
            const url = await googleDriveService.getAuthUrl();
            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            const popup = window.open(
                url,
                'Google Drive Auth',
                `width=${width},height=${height},top=${top},left=${left}`
            );

            // Listen for success message from popup
            const messageHandler = (event: MessageEvent) => {
                if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
                    setIsAuthenticated(true);
                    loadFiles('root');
                    window.removeEventListener('message', messageHandler);
                }
            };
            window.addEventListener('message', messageHandler);

            // Also poll to check if popup closed (manual close)
            const timer = setInterval(() => {
                if (popup?.closed) {
                    clearInterval(timer);
                    // Maybe refresh just in case
                    loadFiles('root');
                }
            }, 1000);

        } catch (error) {
            console.error(error);
            toast.error('Could not initiate Google Auth');
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm('Are you sure you want to disconnect Google Drive?')) return;
        try {
            await googleDriveService.disconnect();
            setIsAuthenticated(false);
            setFiles([]);
            toast.success('Disconnected');
        } catch (e) {
            toast.error('Failed to disconnect');
        }
    };

    const handleLinkFiles = async () => {
        if (!projectId) {
            toast.error('Project ID is missing');
            return;
        }
        if (selectedFiles.length === 0) return;
        setIsLinking(true);
        try {
            for (const file of selectedFiles) {
                await googleDriveService.linkFile(projectId, {
                    fileId: file.id,
                    name: file.name,
                    mimeType: file.mimeType,
                    webViewLink: file.webViewLink,
                    iconLink: file.iconLink,
                    resourceType: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file'
                });
            }
            toast.success(`Linked ${selectedFiles.length} items successfully`);
            onLinkSuccess?.();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Failed to link files');
        } finally {
            setIsLinking(false);
        }
    };

    const handleSelectFiles = async () => {
        if (selectedFiles.length === 0) return;

        if (mode === 'select' && onSelectFiles) {
            setDownloading(true);
            try {
                const downloadedFiles: File[] = [];
                for (const file of selectedFiles) {
                    const blob = await googleDriveService.downloadFile(file.id);

                    let fileName = file.name;
                    if (file.mimeType === 'application/vnd.google-apps.document' && !fileName.toLowerCase().endsWith('.docx')) {
                        fileName += '.docx';
                    } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet' && !fileName.toLowerCase().endsWith('.xlsx')) {
                        fileName += '.xlsx';
                    } else if (file.mimeType === 'application/vnd.google-apps.presentation' && !fileName.toLowerCase().endsWith('.pptx')) {
                        fileName += '.pptx';
                    }

                    const fileObj = new File([blob], fileName, { type: file.mimeType });
                    downloadedFiles.push(fileObj);
                }
                onSelectFiles(downloadedFiles);
                onClose();
            } catch (error) {
                console.error('Error selecting files:', error);
                toast.error('Failed to download some files');
            } finally {
                setDownloading(false);
            }
        }
    };

    if (isAuthenticated === false) {
        // ... (keep existing connect screen)
        return (
            <div className="flex flex-col items-center justify-center p-10 space-y-6 bg-white rounded-2xl border border-gray-100 shadow-sm h-[600px]">
                <div className="p-6 bg-blue-50 rounded-3xl w-24 h-24 flex items-center justify-center animate-bounce-subtle">
                    <div className="scale-150"><GoogleDriveIcon /></div>
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Connect Google Drive</h3>
                    <p className="text-gray-500 max-w-sm mx-auto leading-relaxed">
                        Link your Google Drive to seamlessly access, attach, and view your files directly within the project.
                    </p>
                </div>
                <button
                    onClick={handleConnect}
                    className="group px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
                >
                    <GoogleDriveIcon />
                    Connect Account
                </button>
            </div>
        );
    }

    return (
        <div className="h-full max-h-[85vh] flex flex-col bg-white rounded-2xl overflow-hidden animate-in fade-in duration-300 shadow-2xl border border-gray-100/50 ring-1 ring-gray-200/50">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <GoogleDriveIcon />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-900 tracking-tight">
                            {mode === 'select' ? 'Select Files' : 'Google Drive'}
                        </h3>
                        {files.length > 0 && (
                            <p className="text-xs text-gray-500 font-medium">
                                {(() => {
                                    const folderCount = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length;
                                    const fileCount = files.length - folderCount;
                                    const parts = [];
                                    if (folderCount > 0) parts.push(`${folderCount} thư mục`);
                                    if (fileCount > 0) parts.push(`${fileCount} tệp`);
                                    return parts.join(', ') || `${files.length} mục`;
                                })()}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 mr-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Grid View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="List View"
                        >
                            <List size={18} />
                        </button>
                    </div>

                    <button onClick={handleDisconnect} className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Disconnect Account">
                        <LogOut size={18} />
                    </button>
                    <button onClick={onClose} className="p-2.5 text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200/50">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 pt-2 pb-0 flex gap-6 border-b border-gray-100 bg-white">
                <button
                    onClick={() => { setActiveTab('my-drive'); setCurrentFolderId('root'); setBreadcrumbs([{ id: 'root', name: 'My Drive' }]); setSearchQuery(''); setDebouncedSearchQuery(''); }}
                    className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'my-drive' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    Files
                    {activeTab === 'my-drive' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => { setActiveTab('starred'); setSearchQuery(''); setDebouncedSearchQuery(''); }}
                    className={`pb-3 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${activeTab === 'starred' ? 'text-amber-500' : 'text-gray-500 hover:text-amber-500'}`}
                >
                    <Star size={14} className={activeTab === 'starred' ? "fill-current" : ""} />
                    Starred
                    {activeTab === 'starred' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => { setActiveTab('shared-with-me'); setCurrentFolderId('root'); setBreadcrumbs([{ id: 'root', name: 'Shared with me' }]); setSearchQuery(''); setDebouncedSearchQuery(''); }}
                    className={`pb-3 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${activeTab === 'shared-with-me' ? 'text-green-600' : 'text-gray-500 hover:text-green-600'}`}
                >
                    <Users size={14} />
                    Shared with me
                    {activeTab === 'shared-with-me' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 rounded-t-full"></div>}
                </button>
            </div>

            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-4 flex-wrap justify-between">
                {/* Custom Breadcrumbs */}
                <div className="flex items-center gap-1.5 text-sm text-gray-600 overflow-hidden flex-1 no-scrollbar">
                    {breadcrumbs.map((crumb, index) => (
                        <div key={crumb.id} className="flex items-center whitespace-nowrap animate-in slide-in-from-left-2 duration-200">
                            {index > 0 && <ChevronRight size={14} className="mx-1 text-gray-400" />}
                            <button
                                onClick={() => handleBreadcrumbClick(index)}
                                className={`px-2 py-1 rounded-md transition-colors ${index === breadcrumbs.length - 1
                                    ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-100'
                                    : 'hover:bg-gray-100 hover:text-gray-900 font-medium'
                                    }`}
                            >
                                {crumb.name}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="relative w-full sm:w-64 group">
                    <div className="relative w-full p-[1.5px] rounded-xl bg-gray-200 group-focus-within:bg-gradient-to-r group-focus-within:from-blue-500 group-focus-within:via-purple-500 group-focus-within:to-pink-500 transition-all duration-500">
                        <div className="relative w-full bg-white rounded-[10.5px] flex items-center h-full">
                            <Search size={16} className="absolute left-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors z-10" />
                            <input
                                type="text"
                                placeholder="Search files..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-transparent border-none focus:ring-0 text-sm outline-none rounded-[10.5px]"
                            />
                        </div>
                    </div>
                </form>
            </div>

            {/* File List Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/30">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                        <div className="relative">
                            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <GoogleDriveIcon />
                            </div>
                        </div>
                        <p className="font-medium animate-pulse">Syncing files...</p>
                    </div>
                ) : files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                            <Folder size={40} className="text-gray-300" />
                        </div>
                        <p className="font-medium text-lg text-gray-500">No files found</p>
                        <p className="text-sm">Try searching for something else or check another folder.</p>
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {files.map(file => {
                                    const isSelected = !!selectedFiles.find(f => f.id === file.id);
                                    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                                    const supported = !isFolder && isOfficeFile(file.mimeType, file.name);
                                    const isImage = !isFolder && isImageFile(file.mimeType, file.name);

                                    return (
                                        <div
                                            key={file.id}
                                            onClick={async () => {
                                                if (isFolder) {
                                                    handleFolderClick(file);
                                                } else {
                                                    if (mode === 'browse') {
                                                        if (supported) {
                                                            setViewingFile({ id: file.id, name: file.name });
                                                        } else if (isImage) {
                                                            setViewingImage({ id: file.id, name: file.name });
                                                            setImageLoading(true);
                                                            try {
                                                                const blob = await googleDriveService.downloadFile(file.id);
                                                                const url = URL.createObjectURL(blob);
                                                                setViewingImage({ id: file.id, name: file.name, url });
                                                            } catch (err) {
                                                                console.error('Failed to load image:', err);
                                                                toast.error('Failed to load image');
                                                                setViewingImage(null);
                                                            } finally {
                                                                setImageLoading(false);
                                                            }
                                                        } else {
                                                            window.open(file.webViewLink, '_blank');
                                                        }
                                                    } else {
                                                        toggleSelection(file);
                                                    }
                                                }
                                            }}
                                            className={`
                                                group relative aspect-[3/4] p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300
                                                flex flex-col items-center justify-between
                                                ${isSelected
                                                    ? 'border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]'
                                                    : 'border-transparent bg-white shadow-sm hover:shadow-xl hover:border-blue-200 hover:-translate-y-1'
                                                }
                                            `}
                                        >
                                            {(mode === 'link' || mode === 'select') && (
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleSelection(file);
                                                    }}
                                                    className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white transition-all cursor-pointer z-10 shadow-sm
                                                        ${isSelected
                                                            ? 'border-blue-500 bg-blue-500 text-white scale-110'
                                                            : 'opacity-0 group-hover:opacity-100 border-gray-200 hover:border-blue-400 text-transparent hover:text-blue-400'
                                                        }`}
                                                >
                                                    <Check size={14} strokeWidth={3} />
                                                </div>
                                            )}

                                            {/* Star Button (Grid) */}
                                            {mode === 'browse' && (
                                                <button
                                                    onClick={(e) => handleToggleStar(e, file)}
                                                    className={`absolute top-3 right-3 p-1.5 rounded-full bg-white/90 backdrop-blur shadow-sm transition-all z-10
                                                        ${file.starred
                                                            ? 'text-amber-400 opacity-100'
                                                            : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-amber-400 hover:bg-white'
                                                        }`}
                                                >
                                                    <Star size={14} className={file.starred ? "fill-current" : ""} />
                                                </button>
                                            )}

                                            <div className="flex-1 w-full flex items-center justify-center p-2 relative">
                                                {isFolder && <div className="absolute inset-0 bg-yellow-50/50 rounded-full blur-xl scale-75 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
                                                {file.thumbnailLink && !isFolder ? (
                                                    <img src={file.thumbnailLink} alt="" className="w-full h-full object-contain rounded drop-shadow-sm group-hover:scale-105 transition-transform duration-300" />
                                                ) : isFolder ? (
                                                    <div className="w-24 h-24 group-hover:scale-110 transition-transform flex items-center justify-center">
                                                        <Folder size={80} className="text-yellow-400 fill-yellow-400/20 drop-shadow-md" strokeWidth={1.5} />
                                                    </div>
                                                ) : (
                                                    <img
                                                        src={file.iconLink || "https://fonts.gstatic.com/s/i/materialicons/insert_drive_file/v6/24px.svg"}
                                                        alt=""
                                                        className={`object-contain drop-shadow-md transition-transform duration-300 w-16 h-16 group-hover:rotate-3`}
                                                    />
                                                )}
                                            </div>

                                            <div className="w-full mt-3 text-center">
                                                <p className="text-sm font-bold text-gray-700 line-clamp-2 break-words leading-tight group-hover:text-blue-700 transition-colors px-1">
                                                    {file.name}
                                                </p>
                                                {/* <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                                                    {isFolder ? 'Folder' : file.mimeType.split('.').pop()?.toUpperCase() || 'FILE'}
                                                </p> */}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                {/* List Header */}
                                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <div className="col-span-6 pl-2">Name</div>
                                    <div className="col-span-3">Type</div>
                                    <div className="col-span-3 text-right pr-2">Action</div>
                                </div>

                                {/* List Items */}
                                <div className="divide-y divide-gray-50">
                                    {files.map(file => {
                                        const isSelected = !!selectedFiles.find(f => f.id === file.id);
                                        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                                        const supported = !isFolder && isOfficeFile(file.mimeType, file.name);
                                        const isImage = !isFolder && isImageFile(file.mimeType, file.name);

                                        return (
                                            <div
                                                key={file.id}
                                                onClick={async () => {
                                                    if (isFolder) {
                                                        handleFolderClick(file);
                                                    } else {
                                                        if (mode === 'browse') {
                                                            if (supported) {
                                                                setViewingFile({ id: file.id, name: file.name });
                                                            } else if (isImage) {
                                                                setViewingImage({ id: file.id, name: file.name });
                                                                setImageLoading(true);
                                                                try {
                                                                    const blob = await googleDriveService.downloadFile(file.id);
                                                                    const url = URL.createObjectURL(blob);
                                                                    setViewingImage({ id: file.id, name: file.name, url });
                                                                } catch (err) {
                                                                    console.error('Failed to load image:', err);
                                                                    toast.error('Failed to load image');
                                                                    setViewingImage(null);
                                                                } finally {
                                                                    setImageLoading(false);
                                                                }
                                                            } else {
                                                                window.open(file.webViewLink, '_blank');
                                                            }
                                                        } else {
                                                            toggleSelection(file);
                                                        }
                                                    }
                                                }}
                                                className={`
                                                    group grid grid-cols-12 gap-4 px-4 py-3 cursor-pointer items-center transition-colors
                                                    ${isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50'}
                                                `}
                                            >
                                                <div className="col-span-6 flex items-center gap-3 min-w-0">
                                                    {(mode === 'link' || mode === 'select') && (
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleSelection(file);
                                                            }}
                                                            className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors
                                                                ${isSelected
                                                                    ? 'bg-blue-500 border-blue-500 text-white'
                                                                    : 'border-gray-300 hover:border-blue-400 bg-white'
                                                                }`}
                                                        >
                                                            {isSelected && <Check size={12} strokeWidth={3} />}
                                                        </div>
                                                    )}

                                                    <img
                                                        src={file.iconLink || (isFolder ? "https://fonts.gstatic.com/s/i/materialicons/folder/v6/24px.svg" : "https://fonts.gstatic.com/s/i/materialicons/insert_drive_file/v6/24px.svg")}
                                                        alt=""
                                                        className="w-6 h-6 object-contain flex-shrink-0"
                                                    />
                                                    <span className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-700 group-hover:text-gray-900'}`}>{file.name}</span>

                                                    {file.starred && <Star size={12} className="text-amber-400 fill-current ml-2 flex-shrink-0" />}
                                                </div>

                                                <div className="col-span-3 text-xs text-gray-500 truncate flex items-center gap-2">
                                                    {mode === 'browse' && (
                                                        <button
                                                            onClick={(e) => handleToggleStar(e, file)}
                                                            className={`p-1 rounded-full hover:bg-gray-100 ${file.starred ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400 opacity-0 group-hover:opacity-100'} transition-all`}
                                                        >
                                                            <Star size={14} className={file.starred ? "fill-current" : ""} />
                                                        </button>
                                                    )}
                                                    {isFolder ? 'Folder' : file.mimeType.split('/').pop()}
                                                </div>

                                                <div className="col-span-3 flex justify-end">
                                                    {isFolder ? (
                                                        <button className="p-1 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all">
                                                            <ChevronRight size={16} />
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] font-mono text-gray-400 px-2 py-1 bg-gray-100 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {supported ? 'VIEW' : 'OPEN'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] z-10">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    {mode === 'browse' ? (
                        <>
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span>Ready to preview</span>
                        </>
                    ) : (
                        <span className="font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                        </span>
                    )}
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900 rounded-xl transition-colors"
                    >
                        {mode === 'browse' ? 'Close' : 'Cancel'}
                    </button>
                    {mode === 'link' && (
                        <button
                            onClick={handleLinkFiles}
                            disabled={selectedFiles.length === 0 || isLinking}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
                        >
                            {isLinking ? <Loader2 size={18} className="animate-spin" /> : <div className="p-0.5 bg-white/20 rounded-full"><Check size={12} strokeWidth={3} /></div>}
                            Link Selected
                        </button>
                    )}
                    {mode === 'select' && (
                        <button
                            onClick={handleSelectFiles}
                            disabled={selectedFiles.length === 0 || downloading}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
                        >
                            {downloading ? <Loader2 size={18} className="animate-spin" /> : <div className="p-0.5 bg-white/20 rounded-full"><Check size={12} strokeWidth={3} /></div>}
                            Attach Files
                        </button>
                    )}
                </div>
            </div>

            {/* OnlyOffice Viewer */}
            {viewingFile && token && (
                <GoogleDriveViewer
                    fileId={viewingFile.id}
                    fileName={viewingFile.name}
                    onClose={() => setViewingFile(null)}
                    token={token}
                />
            )}

            {/* Image Viewer */}
            {viewingImage && (
                <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-300">
                    <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 pt-12 md:pt-6 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
                        <div className="flex items-center gap-2 sm:gap-3 text-white/90 min-w-0 flex-1 mr-3">
                            <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md flex-shrink-0">
                                <GoogleDriveIcon />
                            </div>
                            <span className="font-medium text-sm sm:text-lg leading-tight drop-shadow-md truncate">{viewingImage.name}</span>
                        </div>
                        <button
                            onClick={() => {
                                if (viewingImage.url) URL.revokeObjectURL(viewingImage.url);
                                setViewingImage(null);
                            }}
                            className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all hover:rotate-90 duration-300 active:bg-white/20"
                        >
                            <X size={32} strokeWidth={1.5} />
                        </button>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden" onClick={() => {
                        if (viewingImage.url) URL.revokeObjectURL(viewingImage.url);
                        setViewingImage(null);
                    }}>
                        {imageLoading ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin"></div>
                                <p className="text-white/60 font-medium tracking-wide">Fetching high-res image...</p>
                            </div>
                        ) : (
                            <img
                                src={viewingImage.url}
                                alt={viewingImage.name}
                                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-300"
                                onClick={(e) => e.stopPropagation()} // Prevent close on image click
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

