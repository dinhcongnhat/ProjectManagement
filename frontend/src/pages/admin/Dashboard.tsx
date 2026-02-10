import { useState, useEffect } from 'react';
import {
    Users, FolderKanban, CheckCircle2, AlertCircle,
    TrendingUp, Sparkles, ArrowRight, ChevronDown, ChevronRight,
    CornerDownRight, BarChart3, Target, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import styled from '@emotion/styled';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';

interface Project {
    id: number;
    name: string;
    progress: number;
    status: string;
    parent?: any;
    children?: Project[];
    code?: string;
}

/* ── Emotion Styled Components ── */

const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  @media (min-width: 640px) { gap: 24px; }
`;

const WelcomeBanner = styled(motion.div)`
  position: relative;
  background: linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%);
  border-radius: 16px;
  padding: 24px;
  color: white;
  overflow: hidden;
  box-shadow: 0 10px 40px -10px rgba(37, 99, 235, 0.4);

  @media (min-width: 640px) { padding: 32px; border-radius: 20px; }
  @media (min-width: 1024px) { padding: 40px; border-radius: 24px; }

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -20%;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
    border-radius: 50%;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -30%;
    left: -10%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
    border-radius: 50%;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  @media (min-width: 768px) { gap: 16px; }
  @media (min-width: 1024px) { grid-template-columns: repeat(4, 1fr); gap: 20px; }
`;

const StatCardStyled = styled(motion.div)`
  background: #ffffff;
  border-radius: 16px;
  padding: 16px;
  border: 1px solid #f1f5f9;
  position: relative;
  overflow: hidden;
  transition: all 0.3s;
  cursor: default;

  &:hover {
    box-shadow: 0 8px 30px -8px rgba(0,0,0,0.12);
    transform: translateY(-2px);
  }

  .dark & {
    background: #1e293b;
    border-color: #334155;
    &:hover { box-shadow: 0 8px 30px -8px rgba(0,0,0,0.4); }
  }

  @media (min-width: 640px) { padding: 20px; border-radius: 20px; }
  @media (min-width: 1024px) { padding: 24px; }
`;

const StatIconWrap = styled.div<{ gradient: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  color: white;
  background: ${p => p.gradient};
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  flex-shrink: 0;

  @media (min-width: 640px) { width: 48px; height: 48px; border-radius: 14px; }
`;

const StatValue = styled.span`
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1;
  letter-spacing: -0.02em;
  .dark & { color: #f8fafc; }
  @media (min-width: 640px) { font-size: 32px; }
  @media (min-width: 1024px) { font-size: 36px; }
`;

const StatLabel = styled.p`
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  margin-top: 4px;
  .dark & { color: #94a3b8; }
  @media (min-width: 640px) { font-size: 13px; }
`;

const ProjectsCard = styled(motion.div)`
  background: #ffffff;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid #f1f5f9;
  .dark & { background: #1e293b; border-color: #334155; }
  @media (min-width: 640px) { padding: 24px; border-radius: 20px; }
  @media (min-width: 1024px) { padding: 28px; }
`;

const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 8px;
  .dark & { color: #f8fafc; }
  @media (min-width: 640px) { font-size: 18px; }
`;

const ViewAllLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #3b82f6;
  text-decoration: none;
  transition: color 0.2s;
  &:hover { color: #2563eb; }
  .dark & { color: #60a5fa; &:hover { color: #93bbfd; } }
`;

const ProgressBarTrack = styled.div`
  height: 8px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
  .dark & { background: #334155; }
  @media (min-width: 640px) { height: 10px; }
`;

const ProgressBarFill = styled.div<{ width: number; gradient: string }>`
  height: 100%;
  border-radius: 999px;
  background: ${p => p.gradient};
  width: ${p => p.width}%;
  transition: width 0.6s ease;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  border-radius: 16px;
  background: #f8fafc;
  .dark & { background: #0f172a; }
`;

/* ── Animation variants ── */
const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } }
};

const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

/* ── Sub-Components ── */
const StatCard = ({ icon: Icon, label, value, gradient }: {
    icon: React.ComponentType<{ size?: number }>;
    label: string;
    value: number;
    gradient: string;
}) => (
    <StatCardStyled variants={itemVariants}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <StatIconWrap gradient={gradient}><Icon size={20} /></StatIconWrap>
            <StatValue>{value}</StatValue>
        </div>
        <StatLabel>{label}</StatLabel>
    </StatCardStyled>
);

const ProjectItem = ({ project, isChild = false }: { project: Project; isChild?: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasChildren = project.children && project.children.length > 0;

    const getStatusGradient = (status: string) => {
        if (status === 'COMPLETED') return 'linear-gradient(90deg, #10b981, #059669)';
        if (status === 'PENDING_APPROVAL') return 'linear-gradient(90deg, #f59e0b, #d97706)';
        return 'linear-gradient(90deg, #3b82f6, #6366f1)';
    };

    const getStatusColor = (status: string) => {
        if (status === 'COMPLETED') return '#059669';
        if (status === 'PENDING_APPROVAL') return '#d97706';
        return '#3b82f6';
    };

    return (
        <div>
            <div className={`relative p-3 sm:p-4 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-700 ${isChild ? 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700' : 'bg-gray-50 dark:bg-gray-800/30'}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        {isChild && <CornerDownRight size={16} className="text-gray-400 shrink-0" />}
                        {hasChildren && !isChild && (
                            <button
                                onClick={(e) => { e.preventDefault(); setIsExpanded(!isExpanded); }}
                                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-400 transition-colors shrink-0"
                            >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                        )}
                        {!hasChildren && !isChild && <div style={{ width: 28 }} />}
                        <Link to={`/admin/projects/${project.id}`} className="flex-1 min-w-0">
                            <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base truncate block">
                                {project.name}
                            </span>
                            {project.code && (
                                <span className="text-xs text-gray-400 dark:text-gray-500">{project.code}</span>
                            )}
                        </Link>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: getStatusColor(project.status), flexShrink: 0 }}>
                        {project.progress}%
                    </span>
                </div>
                <Link to={`/admin/projects/${project.id}`} className="block">
                    <ProgressBarTrack>
                        <ProgressBarFill width={project.progress} gradient={getStatusGradient(project.status)} />
                    </ProgressBarTrack>
                </Link>
            </div>
            {hasChildren && isExpanded && (
                <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-100 dark:border-gray-700 ml-3">
                    {project.children?.map(child => (
                        <ProjectItem key={child.id} project={child} isChild />
                    ))}
                </div>
            )}
        </div>
    );
};

/* ── Main Dashboard Component ── */
const Dashboard = () => {
    const [stats, setStats] = useState({ totalProjects: 0, totalUsers: 0, completedProjects: 0, pendingProjects: 0 });
    const [projects, setProjects] = useState<Project[]>([]);
    const { token, user } = useAuth();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [projectsRes, usersRes] = await Promise.all([
                    fetch(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } })
                ]);
                if (projectsRes.ok && usersRes.ok) {
                    const projectsData = await projectsRes.json();
                    const usersData = await usersRes.json();
                    const completed = projectsData.filter((p: Project) => p.status === 'COMPLETED').length;
                    const pending = projectsData.filter((p: Project) => p.status === 'PENDING_APPROVAL').length;
                    const rootProjects = projectsData.filter((p: Project) => !p.parent);
                    setStats({ totalProjects: projectsData.length, totalUsers: usersData.length, completedProjects: completed, pendingProjects: pending });
                    setProjects(rootProjects.slice(0, 5));
                }
            } catch (error) { console.error('Error fetching stats:', error); }
        };
        if (token) fetchStats();
    }, [token]);

    const completionRate = stats.totalProjects > 0
        ? Math.round((stats.completedProjects / stats.totalProjects) * 100)
        : 0;

    const statCards = [
        { icon: FolderKanban, label: 'Tổng dự án', value: stats.totalProjects, gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)' },
        { icon: Users, label: 'Thành viên', value: stats.totalUsers, gradient: 'linear-gradient(135deg, #8b5cf6, #a855f7)' },
        { icon: CheckCircle2, label: 'Hoàn thành', value: stats.completedProjects, gradient: 'linear-gradient(135deg, #10b981, #059669)' },
        { icon: AlertCircle, label: 'Chờ duyệt', value: stats.pendingProjects, gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    ];

    return (
        <>
            <Helmet>
                <title>Tổng quan - JTSC Project</title>
                <meta property="og:title" content="Bảng điều khiển quản trị - JTSC Project" />
                <meta property="og:description" content="Hệ thống quản lý dự án JTSC - Bảng điều khiển quản trị" />
                <meta property="og:type" content="website" />
            </Helmet>

            <motion.div variants={containerVariants} initial="hidden" animate="visible">
                <DashboardContainer>
                    {/* Welcome Banner */}
                    <WelcomeBanner variants={itemVariants}>
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                                <motion.div
                                    style={{
                                        padding: 12,
                                        background: 'rgba(255,255,255,0.15)',
                                        backdropFilter: 'blur(8px)',
                                        borderRadius: 14,
                                        flexShrink: 0
                                    }}
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                >
                                    <Sparkles size={24} />
                                </motion.div>
                                <div style={{ minWidth: 0 }}>
                                    <h1 style={{ fontSize: 'clamp(20px, 5vw, 32px)', fontWeight: 800, lineHeight: 1.2, marginBottom: 4 }}>
                                        Xin chào, {user?.name}!
                                    </h1>
                                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
                                        Bảng điều khiển quản trị
                                    </p>
                                </div>
                            </div>

                            {/* Quick stats in banner */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 20 }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    background: 'rgba(255,255,255,0.12)', borderRadius: 10,
                                    padding: '8px 14px', backdropFilter: 'blur(4px)'
                                }}>
                                    <BarChart3 size={16} style={{ color: '#86efac' }} />
                                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>{stats.totalProjects} dự án</span>
                                </div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    background: 'rgba(255,255,255,0.12)', borderRadius: 10,
                                    padding: '8px 14px', backdropFilter: 'blur(4px)'
                                }}>
                                    <Users size={16} style={{ color: '#93c5fd' }} />
                                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>{stats.totalUsers} thành viên</span>
                                </div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    background: 'rgba(255,255,255,0.12)', borderRadius: 10,
                                    padding: '8px 14px', backdropFilter: 'blur(4px)'
                                }}>
                                    <Target size={16} style={{ color: '#fde047' }} />
                                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>{completionRate}% hoàn thành</span>
                                </div>
                            </div>
                        </div>
                    </WelcomeBanner>

                    {/* Stats Grid */}
                    <StatsGrid>
                        {statCards.map((stat, i) => (
                            <StatCard key={i} {...stat} />
                        ))}
                    </StatsGrid>

                    {/* Project Progress */}
                    <ProjectsCard variants={itemVariants}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <SectionTitle>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: 32, height: 32, borderRadius: 8,
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: 'white'
                                }}>
                                    <TrendingUp size={16} />
                                </div>
                                Tiến độ dự án
                            </SectionTitle>
                            <ViewAllLink to="/admin/projects">
                                <span className="hidden sm:inline">Xem tất cả</span>
                                <span className="sm:hidden">Xem</span>
                                <ArrowRight size={14} />
                            </ViewAllLink>
                        </div>

                        {projects.length === 0 ? (
                            <EmptyState>
                                <div style={{
                                    width: 56, height: 56, borderRadius: '50%',
                                    background: '#f1f5f9', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', marginBottom: 12
                                }}>
                                    <FolderKanban size={24} className="text-gray-400" />
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Chưa có dự án nào</p>
                                <Link to="/admin/create-project" className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                                    <Zap size={14} /> Tạo dự án mới
                                </Link>
                            </EmptyState>
                        ) : (
                            <div className="space-y-3">
                                {projects.map(project => (
                                    <ProjectItem key={project.id} project={project} />
                                ))}
                            </div>
                        )}
                    </ProjectsCard>
                </DashboardContainer>
            </motion.div>
        </>
    );
};

export default Dashboard;