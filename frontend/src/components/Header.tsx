
import { Search, Menu, Bell } from 'lucide-react';

interface HeaderProps {
    onMenuClick?: () => void;
}

const Header = ({ onMenuClick }: HeaderProps) => {
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
                <div className="hidden sm:block relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm dự án, công việc..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                </div>

                {/* Mobile Search Icon */}
                <button className="sm:hidden p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors touch-target">
                    <Search size={22} className="text-gray-600" />
                </button>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
                {/* Notifications */}
                <button className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors relative touch-target">
                    <Bell size={22} className="text-gray-600" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
            </div>
        </header>
    );
};

export default Header;
