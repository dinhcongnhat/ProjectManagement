import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Loader2, ChevronDown, ChevronUp, Edit, TrendingUp, CheckCircle, AlertCircle, FileText, RefreshCw } from 'lucide-react';
import { API_URL } from '../config/api';

interface Activity {
    id: number;
    action: string;
    fieldName: string | null;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
    user: {
        id: number;
        name: string;
        role: string;
    };
}

interface ActivityHistoryPanelProps {
    projectId: number;
}

export const ActivityHistoryPanel = ({ projectId }: ActivityHistoryPanelProps) => {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [retryCount, setRetryCount] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Fetch activities with retry logic
    const fetchActivities = useCallback(async (isManualRefresh = false) => {
        // Cancel previous request if exists
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        if (isManualRefresh) {
            setIsRefreshing(true);
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/projects/${projectId}/activities`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache',
                },
                signal: abortControllerRef.current.signal,
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            setActivities(data.activities || []);
            setError(null);
            setRetryCount(0);
        } catch (err: any) {
            if (err.name === 'AbortError') {
                return; // Request was cancelled
            }
            
            console.error('Error fetching activities:', err);
            
            // Retry logic
            if (retryCount < 3 && !isManualRefresh) {
                setRetryCount(prev => prev + 1);
                setTimeout(() => fetchActivities(), 2000 * (retryCount + 1));
            } else {
                setError('Không thể tải lịch sử hoạt động. Vui lòng thử lại.');
            }
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [projectId, retryCount]);

    // Manual refresh handler
    const handleRefresh = () => {
        setError(null);
        fetchActivities(true);
    };

    useEffect(() => {
        fetchActivities();
        // Refresh every 30 seconds
        const interval = setInterval(() => fetchActivities(), 30000);
        return () => {
            clearInterval(interval);
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [projectId]);

    // Toggle expand/collapse for activity details
    const toggleExpand = (id: number) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;
        
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get icon based on field name or action
    const getActivityIcon = (activity: Activity) => {
        const fieldName = activity.fieldName?.toLowerCase() || '';
        const action = activity.action.toLowerCase();
        
        if (fieldName.includes('progress') || action.includes('progress')) {
            return <TrendingUp size={16} className="text-blue-500" />;
        }
        if (fieldName.includes('status') || action.includes('status')) {
            return <CheckCircle size={16} className="text-green-500" />;
        }
        if (action.includes('created') || action.includes('tạo')) {
            return <FileText size={16} className="text-purple-500" />;
        }
        if (action.includes('approved') || action.includes('duyệt')) {
            return <CheckCircle size={16} className="text-green-500" />;
        }
        if (action.includes('rejected') || action.includes('từ chối')) {
            return <AlertCircle size={16} className="text-red-500" />;
        }
        return <Edit size={16} className="text-gray-500" />;
    };

    // Get color for activity type
    const getActivityColor = (activity: Activity) => {
        const action = activity.action.toLowerCase();
        
        if (action.includes('approved') || action.includes('completed') || action.includes('duyệt')) {
            return 'border-green-200 bg-green-50';
        }
        if (action.includes('rejected') || action.includes('từ chối')) {
            return 'border-red-200 bg-red-50';
        }
        if (action.includes('created') || action.includes('tạo')) {
            return 'border-purple-200 bg-purple-50';
        }
        return 'border-gray-200 bg-gray-50';
    };

    // Format field name to Vietnamese
    const formatFieldName = (fieldName: string | null) => {
        if (!fieldName) return '';
        
        const fieldMap: Record<string, string> = {
            'progress': 'Tiến độ',
            'status': 'Trạng thái',
            'name': 'Tên dự án',
            'description': 'Mô tả',
            'startDate': 'Ngày bắt đầu',
            'endDate': 'Ngày kết thúc',
            'duration': 'Thời gian',
            'value': 'Giá trị',
            'attachment': 'Tệp đính kèm',
            'manager': 'Quản lý',
            'implementers': 'Người thực hiện',
            'followers': 'Người theo dõi'
        };
        
        return fieldMap[fieldName] || fieldName;
    };

    // Format status value
    const formatStatusValue = (value: string | null) => {
        if (!value) return '';
        
        const statusMap: Record<string, string> = {
            'IN_PROGRESS': 'Đang thực hiện',
            'PENDING_APPROVAL': 'Chờ duyệt',
            'COMPLETED': 'Hoàn thành'
        };
        
        return statusMap[value] || value;
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="animate-spin text-blue-500" size={48} />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: '400px', maxHeight: '600px' }}>
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock size={20} className="text-blue-500 sm:w-6 sm:h-6" />
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800">Lịch sử hoạt động</h3>
                        <span className="text-xs sm:text-sm text-gray-500">({activities.length})</span>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50 touch-manipulation"
                        title="Làm mới"
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Activities List */}
            <div className="flex-1 overflow-y-auto p-4">
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {activities.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Clock size={48} className="mx-auto mb-4 text-gray-300" />
                        <p>Chưa có hoạt động nào</p>
                        <p className="text-sm">Lịch sử thay đổi sẽ hiển thị ở đây</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {activities.map((activity) => (
                            <div 
                                key={activity.id}
                                className={`border rounded-lg p-3 ${getActivityColor(activity)} transition-all`}
                            >
                                <div 
                                    className="flex items-start gap-3 cursor-pointer"
                                    onClick={() => toggleExpand(activity.id)}
                                >
                                    {/* Icon */}
                                    <div className="mt-1">
                                        {getActivityIcon(activity)}
                                    </div>
                                    
                                    {/* Content */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-800">{activity.user.name}</span>
                                            {activity.user.role === 'ADMIN' && (
                                                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs">
                                                    Admin
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-700">{activity.action}</p>
                                        <p className="text-xs text-gray-500 mt-1">{formatDate(activity.createdAt)}</p>
                                    </div>
                                    
                                    {/* Expand button */}
                                    {(activity.oldValue || activity.newValue) && (
                                        <button 
                                            className="p-1 hover:bg-gray-200 rounded"
                                            title={expanded.has(activity.id) ? 'Thu gọn' : 'Mở rộng'}
                                        >
                                            {expanded.has(activity.id) ? (
                                                <ChevronUp size={16} className="text-gray-500" />
                                            ) : (
                                                <ChevronDown size={16} className="text-gray-500" />
                                            )}
                                        </button>
                                    )}
                                </div>
                                
                                {/* Expanded details */}
                                {expanded.has(activity.id) && (activity.oldValue || activity.newValue) && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            {activity.fieldName && (
                                                <div className="col-span-2">
                                                    <span className="text-gray-500">Trường thay đổi: </span>
                                                    <span className="font-medium">{formatFieldName(activity.fieldName)}</span>
                                                </div>
                                            )}
                                            {activity.oldValue && (
                                                <div>
                                                    <p className="text-gray-500 mb-1">Giá trị cũ:</p>
                                                    <div className="p-2 bg-red-100 border border-red-200 rounded text-red-700">
                                                        {activity.fieldName === 'status' 
                                                            ? formatStatusValue(activity.oldValue)
                                                            : activity.oldValue}
                                                    </div>
                                                </div>
                                            )}
                                            {activity.newValue && (
                                                <div>
                                                    <p className="text-gray-500 mb-1">Giá trị mới:</p>
                                                    <div className="p-2 bg-green-100 border border-green-200 rounded text-green-700">
                                                        {activity.fieldName === 'status' 
                                                            ? formatStatusValue(activity.newValue)
                                                            : activity.newValue}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Refresh button */}
            <div className="p-3 sm:p-4 border-t border-gray-100">
                <button
                    onClick={handleRefresh}
                    disabled={loading || isRefreshing}
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 touch-manipulation"
                >
                    {isRefreshing ? 'Đang tải...' : 'Làm mới'}
                </button>
            </div>
        </div>
    );
};
