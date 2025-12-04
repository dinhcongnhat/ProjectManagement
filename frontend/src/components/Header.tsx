
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Menu, Bell, Briefcase } from 'lucide-react';
import ChatPopup from './ChatPopup';
import UserProfilePopup from './UserProfilePopup';
import api from '../config/api';

interface HeaderProps {
    onMenuClick?: () => void;
}

interface ProjectResult {
    id: number;
    code: string;
    name: string;
    status: string;
}

const Header = ({ onMenuClick }: HeaderProps) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ProjectResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [searching, setSearching] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Close results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search projects
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const searchProjects = async () => {
            setSearching(true);
            try {
                const response = await api.get('/projects', { params: { q: searchQuery } });
                setSearchResults(response.data.slice(0, 5));
                setShowResults(true);
            } catch (error) {
                console.error('Error searching projects:', error);
            } finally {
                setSearching(false);
            }
        };

        const debounce = setTimeout(searchProjects, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    const handleSelectProject = (projectId: number) => {
        setSearchQuery('');
        setShowResults(false);
        navigate(`/projects/${projectId}`);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'bg-green-100 text-green-700';
            case 'PENDING_APPROVAL': return 'bg-orange-100 text-orange-700';
            default: return 'bg-blue-100 text-blue-700';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'Hoàn thành';
            case 'PENDING_APPROVAL': return 'Chờ duyệt';
            default: return 'Đang thực hiện';
        }
    };

    return (
        <header className="h-14 lg:h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 sticky top-0 z-30 safe-top">
            {/* Mobile Menu Button */}
            <button 
                onClick={onMenuClick}
                className="lg:hidden p-2 -ml-2 mr-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors touch-target"
            >
                <Menu size={24} className="text-gray-600" />
            </button>

            <div className="flex items-center gap-2 lg:gap-4 flex-1">
                {/* Search - Hidden on mobile, shown on larger screens */}
                <div className="hidden sm:block relative flex-1 max-w-md" ref={searchRef}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => searchQuery && setShowResults(true)}
                        placeholder="Tìm kiếm dự án, công việc..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                    
                    {/* Search Results Dropdown */}
                    {showResults && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto z-50">
                            {searchResults.map((project) => (
                                <div
                                    key={project.id}
                                    onClick={() => handleSelectProject(project.id)}
                                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3 border-b last:border-b-0"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                        <Briefcase size={20} className="text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 truncate">{project.name}</p>
                                        <p className="text-xs text-gray-500">{project.code}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                                        {getStatusText(project.status)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* No results */}
                    {showResults && searchQuery && searchResults.length === 0 && !searching && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-4 text-center text-gray-500 z-50">
                            Không tìm thấy dự án
                        </div>
                    )}
                    
                    {/* Searching */}
                    {searching && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-4 text-center text-gray-500 z-50">
                            Đang tìm kiếm...
                        </div>
                    )}
                </div>

                {/* Mobile Search Icon */}
                <button className="sm:hidden p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors touch-target">
                    <Search size={22} className="text-gray-600" />
                </button>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-1 lg:gap-2">
                {/* Chat Popup */}
                <ChatPopup />
                
                {/* Notifications */}
                <button className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors relative touch-target">
                    <Bell size={22} className="text-gray-600" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>

                {/* User Profile */}
                <UserProfilePopup />
            </div>
        </header>
    );
};

export default Header;
