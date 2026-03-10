import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import styled from '@emotion/styled';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import { useDialog } from '../components/ui/Dialog';
import { EditSubProjectModal } from '../components/EditSubProjectModal';
import {
    CheckCircle, Clock, AlertCircle, Sparkles,
    ArrowRight, Briefcase, ListTodo, Target, CalendarClock, Quote,
    Columns3, FolderKanban, Users, ClipboardList, Eye, TrendingUp,
    Pencil, Trash2, ChevronDown, ChevronRight, X, Save, Loader2
} from 'lucide-react';

const MOTIVATIONAL_QUOTES = [
    'Việc hôm nay chớ để ngày mai',
    'Hãy suy nghĩ như một khách hàng',
    'Chỉ hành động mới tạo ra kết quả',
    'Đừng mong chờ kết quả mới nếu bạn lặp đi lặp lại cách làm cũ',
    'Làm việc đừng có em tưởng, phải có lương tâm và trách nhiệm',
];

/* ── Emotion Styled Components ── */

const Container = styled(motion.div)`
  display: flex; flex-direction: column; gap: 20px;
  height: fit-content;
  @media (min-width: 640px) { gap: 24px; }
`;

const WelcomeBanner = styled(motion.div)`
  position: relative;
  background: linear-gradient(135deg, #2563eb 0%, #4f46e5 40%, #7c3aed 100%);
  border-radius: 16px; padding: 24px; color: white; overflow: hidden;
  box-shadow: 0 10px 40px -10px rgba(37, 99, 235, 0.4);
  @media (min-width: 640px) { padding: 32px; border-radius: 20px; }
  @media (min-width: 1024px) { padding: 40px; border-radius: 24px; }
  &::before {
    content: ''; position: absolute; top: -50%; right: -20%;
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
    border-radius: 50%;
  }
`;

const StatsGrid = styled.div`
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); }
  @media (min-width: 640px) { gap: 16px; }
`;

const StatCardStyled = styled(motion.div)`
  background: #ffffff; border-radius: 16px; padding: 16px;
  border: 1px solid #f1f5f9; position: relative; overflow: hidden;
  transition: all 0.3s; cursor: pointer;
  &:hover { box-shadow: 0 8px 30px -8px rgba(0,0,0,0.12); transform: translateY(-2px); }
  .dark & { background: #1e293b; border-color: #334155; }
  @media (min-width: 640px) { padding: 20px; border-radius: 20px; }
`;

const StatIconWrap = styled.div<{ gradient: string }>`
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 12px;
  color: white; background: ${(p: any) => p.gradient};
  box-shadow: 0 4px 12px rgba(0,0,0,0.15); flex-shrink: 0;
  @media (min-width: 640px) { width: 48px; height: 48px; }
`;

const StatValue = styled.span`
  font-size: 28px; font-weight: 800; color: #0f172a;
  line-height: 1; letter-spacing: -0.02em;
  .dark & { color: #f8fafc; }
  @media (min-width: 640px) { font-size: 32px; }
`;

const StatLabel = styled.p`
  font-size: 12px; font-weight: 500; color: #64748b; margin-top: 4px;
  .dark & { color: #94a3b8; }
  @media (min-width: 640px) { font-size: 13px; }
`;

const ProgressTrack = styled.div`
  height: 6px; background: #e2e8f0; border-radius: 999px;
  overflow: hidden; margin-top: 10px;
  .dark & { background: #334155; }
  @media (min-width: 640px) { height: 8px; margin-top: 12px; }
`;

const ProgressFill = styled(motion.div) <{ gradient: string }>`
  height: 100%; border-radius: 999px; background: ${(p: any) => p.gradient};
`;

const QuickActionCard = styled(Link)`
  display: flex; align-items: center; gap: 14px;
  background: #ffffff; border-radius: 16px;
  padding: 16px; border: 1px solid #f1f5f9;
  text-decoration: none; transition: all 0.3s;
  &:hover { box-shadow: 0 8px 30px -8px rgba(0,0,0,0.12); transform: translateY(-2px); border-color: #bfdbfe; }
  &:active { transform: scale(0.98); }
  .dark & { background: #1e293b; border-color: #334155; &:hover { border-color: rgba(59,130,246,0.3); } }
  @media (min-width: 640px) { padding: 20px; border-radius: 20px; }
`;

const SectionCard = styled(motion.div)`
  background: #ffffff; border-radius: 16px; padding: 20px; border: 1px solid #f1f5f9;
  .dark & { background: #1e293b; border-color: #334155; }
  @media (min-width: 640px) { padding: 24px; border-radius: 20px; }
`;

const SectionTitle = styled.h2`
  font-size: 16px; font-weight: 700; color: #0f172a;
  display: flex; align-items: center; gap: 8px;
  .dark & { color: #f8fafc; }
  @media (min-width: 640px) { font-size: 18px; }
`;

const BoardCard = styled(motion.div) <{ bg?: string }>`
  border-radius: 12px; padding: 16px; cursor: pointer;
  background: ${(p: any) => p.bg || '#0079bf'};
  color: white; min-height: 100px; position: relative; overflow: hidden;
  transition: all 0.3s;
  &:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.2); }
  &::before {
    content: ''; position: absolute; top: -30%; right: -20%;
    width: 120px; height: 120px;
    background: rgba(255,255,255,0.1); border-radius: 50%;
  }
`;

const ProjectStatusBadge = styled.span<{ status: string }>`
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
  ${(p: any) => {
        switch (p.status) {
            case 'IN_PROGRESS': return 'background: #dbeafe; color: #1d4ed8;';
            case 'PENDING_APPROVAL': return 'background: #fef3c7; color: #92400e;';
            case 'COMPLETED': return 'background: #d1fae5; color: #065f46;';
            default: return 'background: #f1f5f9; color: #475569;';
        }
    }}
  .dark & {
    ${(p: any) => {
        switch (p.status) {
            case 'IN_PROGRESS': return 'background: rgba(59,130,246,0.2); color: #60a5fa;';
            case 'PENDING_APPROVAL': return 'background: rgba(245,158,11,0.2); color: #fbbf24;';
            case 'COMPLETED': return 'background: rgba(16,185,129,0.2); color: #34d399;';
            default: return 'background: rgba(100,116,139,0.2); color: #94a3b8;';
        }
    }}
  }
`;

/* ── Animation ── */
const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } }
};
const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

/* ── Component ── */
const UserDashboard = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const { showConfirm, showSuccess, showError } = useDialog();
    const [activities, setActivities] = useState<any[]>([]);
    const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
    const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length));
    const [dashboardData, setDashboardData] = useState<any>(null);

    // Edit/Delete state
    const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [editFormData, setEditFormData] = useState({ name: '', priority: 'NORMAL', status: 'IN_PROGRESS', description: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    // Sub-project edit
    const [showEditSubModal, setShowEditSubModal] = useState(false);
    const [editingSubProject, setEditingSubProject] = useState<any>(null);

    // Auto-cycle quotes every 8 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setQuoteIndex(prev => {
                let next: number;
                do { next = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length); } while (next === prev && MOTIVATIONAL_QUOTES.length > 1);
                return next;
            });
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (user?.role === 'ADMIN') navigate('/admin', { replace: true });
    }, [user, navigate]);

    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const response = await fetch(`${API_URL}/activities?limit=5`, { headers: { Authorization: `Bearer ${token}` } });
                if (response.ok) { const data = await response.json(); setActivities(data.activities); }
            } catch (error) { console.error('Error fetching activities:', error); }
        };
        if (token) fetchActivities();
    }, [token]);

    useEffect(() => {
        const fetchUpcomingDeadlines = async () => {
            try {
                const response = await fetch(`${API_URL}/kanban/cards/upcoming`, { headers: { Authorization: `Bearer ${token}` } });
                if (response.ok) {
                    const data = await response.json();
                    setUpcomingDeadlines(data);
                }
            } catch (error) { console.error('Error fetching upcoming deadlines:', error); }
        };
        if (token) fetchUpcomingDeadlines();
    }, [token]);

    // Fetch comprehensive dashboard stats
    const fetchDashboardData = async () => {
        try {
            const response = await fetch(`${API_URL}/projects/dashboard/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setDashboardData(data);
            }
        } catch (error) { console.error('Error fetching dashboard stats:', error); }
    };

    useEffect(() => {
        if (token) fetchDashboardData();
    }, [token]);

    // Fetch users for edit modals
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await response.json();
                if (Array.isArray(data)) setUsers(data);
            } catch (error) { console.error('Error fetching users:', error); }
        };
        if (token) fetchUsers();
    }, [token]);

    // ── Project CRUD handlers ──
    const openEditProjectModal = (project: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingProject(project);
        setEditFormData({
            name: project.name || '',
            priority: project.priority || 'NORMAL',
            status: project.status || 'IN_PROGRESS',
            description: project.description || '',
        });
        setShowEditModal(true);
    };

    const handleUpdateProject = async () => {
        if (!editingProject) return;
        setIsSaving(true);
        try {
            const response = await fetch(`${API_URL}/projects/${editingProject.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(editFormData),
            });
            if (response.ok) {
                setShowEditModal(false);
                setEditingProject(null);
                fetchDashboardData();
                showSuccess('Cập nhật dự án thành công!');
            } else {
                showError('Cập nhật dự án thất bại');
            }
        } catch (error) {
            showError('Lỗi kết nối server');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteProject = async (project: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const childrenCount = project.children?.length || 0;
        const message = childrenCount > 0
            ? `Dự án "${project.name}" có ${childrenCount} dự án con. Xóa dự án sẽ xóa TẤT CẢ dự án con bên trong. Bạn có chắc chắn?`
            : `Bạn có chắc chắn muốn xóa dự án "${project.name}"?`;

        const confirmed = await showConfirm(message);
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/projects/${project.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const result = await response.json();
                if (result.deletedChildren > 0) {
                    showSuccess(`Đã xóa dự án và ${result.deletedChildren} dự án con`);
                } else {
                    showSuccess('Đã xóa dự án thành công');
                }
                fetchDashboardData();
            } else {
                showError('Xóa dự án thất bại');
            }
        } catch (error) {
            showError('Lỗi kết nối server');
        }
    };

    const handleDeleteSubProject = async (subProject: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const confirmed = await showConfirm(`Bạn có chắc chắn muốn xóa dự án con "${subProject.name}"?`);
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/projects/${subProject.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                showSuccess('Đã xóa dự án con thành công');
                fetchDashboardData();
            } else {
                showError('Xóa dự án con thất bại');
            }
        } catch (error) {
            showError('Lỗi kết nối server');
        }
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'Vừa xong';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} phút trước`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} giờ trước`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days} ngày trước`;
        return date.toLocaleDateString('vi-VN');
    };

    const formatDeadline = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMs < 0) return { text: 'Đã quá hạn', urgent: true };
        if (diffHours < 24) return { text: `Còn ${diffHours} giờ`, urgent: true };
        if (diffDays === 1) return { text: 'Ngày mai', urgent: true };
        if (diffDays <= 3) return { text: `Còn ${diffDays} ngày`, urgent: true };
        if (diffDays <= 7) return { text: `Còn ${diffDays} ngày`, urgent: false };
        return { text: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }), urgent: false };
    };

    const getActivityIcon = (activity: any) => {
        const action = activity.action;
        const activityType = activity.activityType;
        if (activityType === 'MESSAGE') return <Sparkles size={16} className="text-indigo-600" />;
        if (activityType === 'TASK') return <ListTodo size={16} className="text-cyan-600" />;
        if (action?.includes('CREATE')) return <Sparkles size={16} className="text-green-600" />;
        if (action?.includes('UPDATE')) return <Briefcase size={16} className="text-blue-600" />;
        if (action?.includes('DELETE')) return <AlertCircle size={16} className="text-red-600" />;
        return <Clock size={16} className="text-gray-600" />;
    };

    const getActivityText = (activity: any) => {
        const activityType = activity.activityType;
        if (activityType === 'MESSAGE') {
            const map: Record<string, string> = {
                'TEXT': 'đã gửi tin nhắn trong', 'IMAGE': 'đã gửi hình ảnh trong',
                'VIDEO': 'đã gửi video trong', 'FILE': 'đã gửi tệp đính kèm trong',
                'VOICE': 'đã gửi tin nhắn thoại trong', 'TEXT_WITH_FILE': 'đã gửi tin nhắn có tệp trong',
            };
            return (
                <span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{activity.user?.name || 'Ai đó'}</span>{' '}
                    <span className="text-gray-600 dark:text-gray-400">{map[activity.messageType] || 'đã gửi tin nhắn trong'}</span>{' '}
                    <Link to={`/projects/${activity.project?.id}`} className="font-medium text-blue-600 hover:underline">
                        {activity.project?.name || 'dự án'}
                    </Link>
                </span>
            );
        }
        if (activityType === 'TASK') {
            const isNew = activity.action === 'CREATE_TASK';
            return (
                <span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{activity.user?.name || 'Ai đó'}</span>{' '}
                    <span className="text-gray-600 dark:text-gray-400">{isNew ? 'được giao công việc' : 'cập nhật công việc'}</span>{' '}
                    <span className="font-medium text-gray-800 dark:text-gray-200">"{activity.newValue}"</span>
                    {activity.project && (
                        <> trong <Link to={`/projects/${activity.project.id}`} className="font-medium text-blue-600 hover:underline">{activity.project.name}</Link></>
                    )}
                </span>
            );
        }
        const actionMap: Record<string, string> = {
            'CREATE_PROJECT': 'đã tạo dự án', 'UPDATE_PROJECT': 'đã cập nhật dự án',
            'DELETE_PROJECT': 'đã xóa dự án', 'UPDATE_STATUS': 'đã cập nhật trạng thái',
        };
        return (
            <span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{activity.user?.name || 'Ai đó'}</span>{' '}
                <span className="text-gray-600 dark:text-gray-400">{actionMap[activity.action] || activity.action}</span>{' '}
                <Link to={`/projects/${activity.project?.id}`} className="font-medium text-blue-600 hover:underline">
                    {activity.project?.name || 'dự án'}
                </Link>
            </span>
        );
    };

    const kanbanStats = dashboardData?.kanbanStats || { canLam: 0, dangLam: 0, canReview: 0, hoanThanh: 0 };
    const statCards = [
        { icon: CheckCircle, label: 'Cần làm', value: kanbanStats.canLam + (dashboardData?.taskStats?.todo || 0), gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)', barGradient: 'linear-gradient(90deg, #3b82f6, #6366f1)', filterStatus: 'TODO' },
        { icon: Clock, label: 'Đang làm', value: kanbanStats.dangLam + (dashboardData?.taskStats?.inProgress || 0), gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', barGradient: 'linear-gradient(90deg, #f59e0b, #d97706)', filterStatus: 'IN_PROGRESS' },
        { icon: Eye, label: 'Cần review', value: kanbanStats.canReview + (dashboardData?.projectStats?.pendingApproval || 0), gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', barGradient: 'linear-gradient(90deg, #8b5cf6, #7c3aed)', filterStatus: 'REVIEW' },
        { icon: Target, label: 'Hoàn thành', value: kanbanStats.hoanThanh + (dashboardData?.taskStats?.completed || 0), gradient: 'linear-gradient(135deg, #10b981, #059669)', barGradient: 'linear-gradient(90deg, #10b981, #059669)', filterStatus: 'COMPLETED' },
    ];

    const totalItems = statCards.reduce((sum, s) => sum + s.value, 0);

    const getStatusText = (status: string) => {
        switch (status) {
            case 'IN_PROGRESS': return 'Đang thực hiện';
            case 'PENDING_APPROVAL': return 'Chờ duyệt';
            case 'COMPLETED': return 'Hoàn thành';
            default: return status;
        }
    };

    return (
        <>
            <Helmet>
                <title>Tổng quan - JTSC Project</title>
                <meta property="og:title" content="Tổng quan công việc - JTSC Project" />
                <meta property="og:description" content="Quản lý công việc hiệu quả với JTSC Project" />
                <meta property="og:type" content="website" />
            </Helmet>

            <Container variants={containerVariants} initial="hidden" animate="visible">
                {/* Welcome Banner */}
                <WelcomeBanner variants={itemVariants}>
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                        {/* Left: Greeting */}
                        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                                <motion.div
                                    style={{ padding: 12, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', borderRadius: 14, flexShrink: 0 }}
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                >
                                    <Sparkles size={24} />
                                </motion.div>
                                <div style={{ minWidth: 0 }}>
                                    <h1 style={{ fontSize: 'clamp(20px, 5vw, 32px)', fontWeight: 800, lineHeight: 1.2, marginBottom: 4 }}>
                                        Xin chào, {user?.name}!
                                    </h1>
                                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>Tổng quan công việc của bạn</p>
                                </div>
                            </div>

                        </div>

                        {/* Right: Motivational Quote */}
                        <div style={{
                            width: 320, minWidth: 320, flexShrink: 0, height: 80,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
                            borderRadius: 16, padding: '20px 24px', position: 'relative', overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.15)',
                        }}>
                            <Quote size={20} style={{ position: 'absolute', top: 10, left: 12, opacity: 0.3, color: '#fde047' }} />
                            <Quote size={16} style={{ position: 'absolute', bottom: 10, right: 12, opacity: 0.2, color: '#ef4444', transform: 'rotate(180deg)' }} />
                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={quoteIndex}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.5 }}
                                    style={{
                                        position: 'absolute', left: 24, right: 24, top: 0, bottom: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 'clamp(14px, 2vw, 16px)', fontWeight: 900, lineHeight: 1.5,
                                        textAlign: 'center', fontStyle: 'italic', letterSpacing: '0.5px',
                                        background: 'linear-gradient(90deg, #fef08a, #f59e0b, #f87171, #f59e0b, #fef08a)',
                                        backgroundSize: '200% auto',
                                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                        animation: 'gradientShift 4s linear infinite',
                                    }}
                                >
                                    "{MOTIVATIONAL_QUOTES[quoteIndex]}"
                                </motion.p>
                            </AnimatePresence>
                        </div>
                    </div>
                </WelcomeBanner>

                {/* Stats Grid */}
                <StatsGrid>
                    {statCards.map((stat, i) => (
                        <StatCardStyled key={i} variants={itemVariants} onClick={() => navigate(`/my-tasks?status=${stat.filterStatus}`)}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                                <StatIconWrap gradient={stat.gradient}><stat.icon size={18} /></StatIconWrap>
                                <StatValue>{stat.value}</StatValue>
                            </div>
                            <StatLabel>{stat.label}</StatLabel>
                            <ProgressTrack>
                                <ProgressFill
                                    gradient={stat.barGradient}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${totalItems > 0 ? (stat.value / totalItems) * 100 : 0}%` }}
                                    transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                                />
                            </ProgressTrack>
                        </StatCardStyled>
                    ))}
                </StatsGrid>

                {/* Quick Actions - 3 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <motion.div variants={itemVariants}>
                        <QuickActionCard to="/projects">
                            <StatIconWrap gradient="linear-gradient(135deg, #8b5cf6, #a855f7)"><Briefcase size={20} /></StatIconWrap>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">Quản lý dự án</p>
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                                    {dashboardData?.projectStats?.total || 0} dự án
                                </p>
                            </div>
                            <ArrowRight size={18} className="text-gray-400 shrink-0" />
                        </QuickActionCard>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <QuickActionCard to="/kanban">
                            <StatIconWrap gradient="linear-gradient(135deg, #0ea5e9, #0284c7)"><Columns3 size={20} /></StatIconWrap>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">Làm việc nhóm</p>
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                                    {dashboardData?.totalBoards || 0} bảng
                                </p>
                            </div>
                            <ArrowRight size={18} className="text-gray-400 shrink-0" />
                        </QuickActionCard>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <QuickActionCard to="/my-tasks">
                            <StatIconWrap gradient="linear-gradient(135deg, #06b6d4, #0891b2)"><ListTodo size={20} /></StatIconWrap>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">Công việc cá nhân</p>
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                                    {dashboardData?.taskStats?.personal || 0} cá nhân, {dashboardData?.taskStats?.assigned || 0} được giao
                                </p>
                            </div>
                            <ArrowRight size={18} className="text-gray-400 shrink-0" />
                        </QuickActionCard>
                    </motion.div>
                </div>

                {/* ========== LÀM VIỆC NHÓM (Kanban Boards) ========== */}
                {dashboardData?.boards && dashboardData.boards.length > 0 && (
                    <SectionCard variants={itemVariants}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <SectionTitle>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: 'white' }}>
                                    <FolderKanban size={16} />
                                </div>
                                Làm việc nhóm
                            </SectionTitle>
                            <Link to="/kanban" className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700">
                                Xem tất cả ({dashboardData.totalBoards})
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {dashboardData.boards.map((board: any, index: number) => {
                                const totalCards = board.lists?.reduce((sum: number, l: any) => sum + (l._count?.cards || 0), 0) || 0;
                                return (
                                    <BoardCard
                                        key={board.id}
                                        bg={board.background || '#0079bf'}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.05 }}
                                        onClick={() => navigate(`/kanban?board=${board.id}`)}
                                    >
                                        <div style={{ position: 'relative', zIndex: 1 }}>
                                            <h3 className="font-bold text-sm truncate mb-2">{board.title}</h3>
                                            <div className="flex items-center gap-3 text-xs opacity-80">
                                                <span className="flex items-center gap-1">
                                                    <Columns3 size={12} />
                                                    {board.lists?.length || 0} cột
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <ClipboardList size={12} />
                                                    {totalCards} thẻ
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Users size={12} />
                                                    {board._count?.members || 0}
                                                </span>
                                            </div>
                                            {board.lists && board.lists.length > 0 && (
                                                <div className="mt-3 flex gap-1">
                                                    {board.lists.map((list: any) => (
                                                        <div key={list.id} className="flex-1 bg-white/20 rounded px-1.5 py-1 text-center">
                                                            <div className="text-[10px] opacity-70 truncate">{list.title}</div>
                                                            <div className="text-xs font-bold">{list._count?.cards || 0}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </BoardCard>
                                );
                            })}
                        </div>
                    </SectionCard>
                )}

                {/* ========== QUẢN LÝ DỰ ÁN ========== */}
                {dashboardData?.projects && dashboardData.projects.length > 0 && (
                    <SectionCard variants={itemVariants}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <SectionTitle>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #8b5cf6, #a855f7)', color: 'white' }}>
                                    <Briefcase size={16} />
                                </div>
                                Quản lý dự án
                            </SectionTitle>
                            <Link to="/projects" className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700">
                                Xem tất cả ({dashboardData.projectStats?.total || 0})
                            </Link>
                        </div>

                        {/* Project Stats Mini */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                            {[
                                { label: 'Đang thực hiện', value: dashboardData.projectStats?.inProgress || 0, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                                { label: 'Chờ duyệt', value: dashboardData.projectStats?.pendingApproval || 0, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                                { label: 'Hoàn thành', value: dashboardData.projectStats?.completed || 0, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
                                { label: 'Dự án con', value: dashboardData.projectStats?.subProjects || 0, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
                            ].map((item, i) => (
                                <div key={i} className={`${item.bg} rounded-xl p-3 text-center`}>
                                    <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
                                    <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Recent Projects List */}
                        <div className="space-y-1">
                            {dashboardData.projects.slice(0, 8).map((project: any, index: number) => {
                                const isExpanded = expandedProjectId === project.id;
                                const hasChildren = project.children && project.children.length > 0;
                                return (
                                    <div key={project.id}>
                                        <motion.div
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.06 }}
                                            onClick={() => navigate(`/projects/${project.id}`)}
                                        >
                                            {/* Expand toggle for sub-projects */}
                                            {hasChildren ? (
                                                <button
                                                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0 transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); setExpandedProjectId(isExpanded ? null : project.id); }}
                                                    title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                                                >
                                                    {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                                                </button>
                                            ) : (
                                                <div className="w-[22px] shrink-0" />
                                            )}

                                            <div className={`p-2 rounded-lg shrink-0 ${project.priority === 'HIGH' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                                                <Briefcase size={16} className={project.priority === 'HIGH' ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[120px] sm:max-w-none">{project.name}</p>
                                                    <ProjectStatusBadge status={project.status}>
                                                        {getStatusText(project.status)}
                                                    </ProjectStatusBadge>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">{project.code}</span>
                                                    {project.manager && (
                                                        <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
                                                            • {project.manager.name}
                                                        </span>
                                                    )}
                                                    {hasChildren && (
                                                        <span className="text-xs text-indigo-500 dark:text-indigo-400">
                                                            • {project.children.length} dự án con
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="shrink-0 flex items-center gap-2">
                                                <div className="w-16 sm:w-20">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{Math.round(project.progress || 0)}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${project.status === 'COMPLETED' ? 'bg-green-500' : project.status === 'PENDING_APPROVAL' ? 'bg-amber-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${project.progress || 0}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                {/* Edit & Delete buttons */}
                                                <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        title="Chỉnh sửa"
                                                        onClick={(e) => openEditProjectModal(project, e)}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        title="Xóa"
                                                        onClick={(e) => handleDeleteProject(project, e)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                <ArrowRight size={14} className="text-gray-400 shrink-0" />
                                            </div>
                                        </motion.div>

                                        {/* Expanded sub-projects */}
                                        <AnimatePresence>
                                            {isExpanded && hasChildren && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="ml-4 sm:ml-9 pl-2 sm:pl-3 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-1 py-1">
                                                        {project.children.map((child: any) => (
                                                            <div
                                                                key={child.id}
                                                                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group/sub"
                                                                onClick={() => navigate(`/projects/${child.id}`)}
                                                            >
                                                                <div className={`p-1.5 rounded-md shrink-0 ${child.priority === 'HIGH' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                                                    <Briefcase size={12} className={child.priority === 'HIGH' ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{child.name}</p>
                                                                        <ProjectStatusBadge status={child.status}>
                                                                            {getStatusText(child.status)}
                                                                        </ProjectStatusBadge>
                                                                    </div>
                                                                    {child.code && (
                                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500">{child.code}</span>
                                                                    )}
                                                                </div>
                                                                <div className="shrink-0 flex items-center gap-2">
                                                                    <div className="w-12 sm:w-16">
                                                                        <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all ${child.status === 'COMPLETED' ? 'bg-green-500' : child.status === 'PENDING_APPROVAL' ? 'bg-amber-500' : 'bg-blue-500'}`}
                                                                                style={{ width: `${child.progress || 0}%` }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    {/* Sub-project Edit & Delete */}
                                                                    <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover/sub:opacity-100 transition-opacity">
                                                                        <button
                                                                            title="Chỉnh sửa dự án con"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setEditingSubProject(child);
                                                                                setShowEditSubModal(true);
                                                                            }}
                                                                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                                                        >
                                                                            <Pencil size={12} />
                                                                        </button>
                                                                        <button
                                                                            title="Xóa dự án con"
                                                                            onClick={(e) => handleDeleteSubProject(child, e)}
                                                                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </SectionCard>
                )}

                {/* ========== CÔNG VIỆC CÁ NHÂN ========== */}
                {dashboardData?.taskStats && (
                    <SectionCard variants={itemVariants}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <SectionTitle>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: 'white' }}>
                                    <ClipboardList size={16} />
                                </div>
                                Công việc cá nhân
                            </SectionTitle>
                            <Link to="/my-tasks" className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700">Quản lý</Link>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                                <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-800/50 rounded-full mx-auto mb-2">
                                    <ListTodo size={18} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{dashboardData.taskStats.todo}</div>
                                <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">Cần làm</div>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
                                <div className="flex items-center justify-center w-10 h-10 bg-amber-100 dark:bg-amber-800/50 rounded-full mx-auto mb-2">
                                    <TrendingUp size={18} className="text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{dashboardData.taskStats.inProgress}</div>
                                <div className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">Đang làm</div>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                                <div className="flex items-center justify-center w-10 h-10 bg-green-100 dark:bg-green-800/50 rounded-full mx-auto mb-2">
                                    <CheckCircle size={18} className="text-green-600 dark:text-green-400" />
                                </div>
                                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{dashboardData.taskStats.completed}</div>
                                <div className="text-xs text-green-600/70 dark:text-green-400/70 mt-0.5">Hoàn thành</div>
                            </div>
                        </div>
                    </SectionCard>
                )}

                {/* Upcoming Deadlines */}
                {upcomingDeadlines.length > 0 && (
                    <SectionCard variants={itemVariants}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <SectionTitle>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white' }}>
                                    <CalendarClock size={16} />
                                </div>
                                Sắp đến hạn
                            </SectionTitle>
                            <Link to="/kanban" className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700">Xem Kanban</Link>
                        </div>
                        <div className="space-y-2">
                            {upcomingDeadlines.slice(0, 5).map((card: any, index: number) => {
                                const deadline = formatDeadline(card.dueDate);
                                return (
                                    <motion.div
                                        key={card.id}
                                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.06 }}
                                        onClick={() => navigate(`/kanban?board=${card.list?.board?.id}`)}
                                    >
                                        <div className={`p-2 rounded-lg shrink-0 ${deadline.urgent ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                                            <CalendarClock size={16} className={deadline.urgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{card.title}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {card.list?.title} • {card.list?.board?.title}
                                            </p>
                                        </div>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${deadline.urgent
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                                            }`}>
                                            {deadline.text}
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </SectionCard>
                )}

                {/* Recent Activities */}
                <SectionCard variants={itemVariants}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <SectionTitle>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
                                <Clock size={16} />
                            </div>
                            Hoạt động gần đây
                        </SectionTitle>
                        <Link to="/activities" className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700">Xem tất cả</Link>
                    </div>

                    {activities.length > 0 ? (
                        <div className="space-y-3">
                            {activities.map((activity, index) => (
                                <motion.div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }}>
                                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg shrink-0">{getActivityIcon(activity)}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{getActivityText(activity)}</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatTimeAgo(activity.createdAt)}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/30 rounded-xl">
                            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Clock size={20} className="text-gray-400" />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Chưa có hoạt động nào gần đây</p>
                        </div>
                    )}
                </SectionCard>
            </Container>

            {/* ========== EDIT PROJECT MODAL ========== */}
            <AnimatePresence>
                {showEditModal && editingProject && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="absolute inset-0 bg-black/50" onClick={() => setShowEditModal(false)} />
                        <motion.div
                            className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 z-10"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 10 }}
                        >
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Pencil size={18} className="text-blue-600" />
                                    Chỉnh sửa dự án
                                </h3>
                                <button onClick={() => setShowEditModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                    <X size={18} className="text-gray-500" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên dự án</label>
                                    <input
                                        type="text"
                                        value={editFormData.name}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trạng thái</label>
                                        <select
                                            value={editFormData.status}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        >
                                            <option value="IN_PROGRESS">Đang thực hiện</option>
                                            <option value="PENDING_APPROVAL">Chờ duyệt</option>
                                            <option value="COMPLETED">Hoàn thành</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Độ ưu tiên</label>
                                        <select
                                            value={editFormData.priority}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, priority: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        >
                                            <option value="NORMAL">Bình thường</option>
                                            <option value="HIGH">Cao</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mô tả</label>
                                    <textarea
                                        rows={3}
                                        value={editFormData.description}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleUpdateProject}
                                    disabled={isSaving || !editFormData.name.trim()}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ========== EDIT SUB-PROJECT MODAL ========== */}
            <EditSubProjectModal
                isOpen={showEditSubModal}
                onClose={() => { setShowEditSubModal(false); setEditingSubProject(null); }}
                onSuccess={fetchDashboardData}
                subProject={editingSubProject}
                users={users}
            />
        </>
    );
};

export default UserDashboard;
