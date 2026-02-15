import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import styled from '@emotion/styled';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import {
    CheckCircle, Clock, AlertCircle, Sparkles,
    ArrowRight, Briefcase, ListTodo, Target, CalendarClock, Quote
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
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
  @media (min-width: 640px) { gap: 16px; }
`;

const StatCardStyled = styled(motion.div)`
  background: #ffffff; border-radius: 16px; padding: 16px;
  border: 1px solid #f1f5f9; position: relative; overflow: hidden;
  transition: all 0.3s;
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
    const [activities, setActivities] = useState<any[]>([]);
    const [stats, setStats] = useState({ todo: 0, inProgress: 0, completed: 0 });
    const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
    const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length));

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
        const fetchStats = async () => {
            try {
                const response = await fetch(`${API_URL}/tasks`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await response.json();
                setStats({
                    todo: data.filter((t: any) => t.status === 'TODO').length,
                    inProgress: data.filter((t: any) => t.status === 'IN_PROGRESS').length,
                    completed: data.filter((t: any) => t.status === 'COMPLETED').length,
                });
            } catch (error) { console.error('Error fetching stats:', error); }
        };
        if (token) fetchStats();
    }, [token]);

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

    const totalTasks = stats.todo + stats.inProgress + stats.completed;

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

    const statCards = [
        { icon: CheckCircle, label: 'Cần làm', value: stats.todo, gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)', barGradient: 'linear-gradient(90deg, #3b82f6, #6366f1)' },
        { icon: Clock, label: 'Đang làm', value: stats.inProgress, gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', barGradient: 'linear-gradient(90deg, #f59e0b, #d97706)' },
        { icon: Target, label: 'Hoàn thành', value: stats.completed, gradient: 'linear-gradient(135deg, #10b981, #059669)', barGradient: 'linear-gradient(90deg, #10b981, #059669)' },
    ];

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
                                        fontSize: 'clamp(13px, 2vw, 15px)', fontWeight: 700, lineHeight: 1.5,
                                        textAlign: 'center', fontStyle: 'italic',
                                        background: 'linear-gradient(90deg, #fde047, #f59e0b, #ef4444, #f59e0b, #fde047)',
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
                        <StatCardStyled key={i} variants={itemVariants}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                                <StatIconWrap gradient={stat.gradient}><stat.icon size={18} /></StatIconWrap>
                                <StatValue>{stat.value}</StatValue>
                            </div>
                            <StatLabel>{stat.label}</StatLabel>
                            <ProgressTrack>
                                <ProgressFill
                                    gradient={stat.barGradient}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${totalTasks > 0 ? (stat.value / totalTasks) * 100 : 0}%` }}
                                    transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                                />
                            </ProgressTrack>
                        </StatCardStyled>
                    ))}
                </StatsGrid>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <motion.div variants={itemVariants}>
                        <QuickActionCard to="/projects">
                            <StatIconWrap gradient="linear-gradient(135deg, #8b5cf6, #a855f7)"><Briefcase size={20} /></StatIconWrap>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">Dự án của tôi</p>
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Xem và quản lý dự án</p>
                            </div>
                            <ArrowRight size={18} className="text-gray-400 shrink-0" />
                        </QuickActionCard>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <QuickActionCard to="/my-tasks">
                            <StatIconWrap gradient="linear-gradient(135deg, #06b6d4, #0891b2)"><ListTodo size={20} /></StatIconWrap>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">Công việc của tôi</p>
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Xem tất cả công việc</p>
                            </div>
                            <ArrowRight size={18} className="text-gray-400 shrink-0" />
                        </QuickActionCard>
                    </motion.div>
                </div>

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
        </>
    );
};

export default UserDashboard;
