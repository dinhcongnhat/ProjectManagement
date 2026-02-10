import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import styled from '@emotion/styled';
import {
    LayoutDashboard, CheckSquare, ListTodo, FolderOpen, Columns3,
    LogOut, X, Menu, Bell, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ChatPopup from '../components/ChatPopup';
import UserProfilePopup from '../components/UserProfilePopup';
import NotificationList from '../components/NotificationList';
import api from '../config/api';
import { useWebSocket } from '../hooks/useWebSocket';

/* ── Emotion styled components ── */

const LayoutWrapper = styled.div`
  display: flex;
  height: 100vh;
  height: 100dvh;
  background: #f8fafc;
  overflow: hidden;
  position: relative;
  .dark & { background: #0f172a; }
`;

const SidebarDesktop = styled.aside`
  display: none;
  @media (min-width: 1024px) {
    display: flex;
    flex-direction: column;
    width: 260px;
    min-width: 260px;
    height: 100vh;
    height: 100dvh;
    position: fixed;
    left: 0; top: 0;
    z-index: 50;
    background: #ffffff;
    border-right: 1px solid #e2e8f0;
    .dark & { background: #1e293b; border-right-color: #334155; }
  }
`;

const MobileOverlay = styled(motion.div)`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  z-index: 55;
  @media (min-width: 1024px) { display: none; }
`;

const MobileSidebar = styled(motion.aside)`
  position: fixed; left: 0; top: 0;
  width: 280px; max-width: 85vw;
  height: 100vh; height: 100dvh;
  z-index: 60;
  background: #ffffff;
  box-shadow: 4px 0 24px rgba(0,0,0,0.12);
  display: flex; flex-direction: column;
  .dark & { background: #1e293b; }
  @media (min-width: 1024px) { display: none; }
`;

const ContentArea = styled.div`
  flex: 1;
  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh;
  overflow: hidden;
  @media (min-width: 1024px) { margin-left: 260px; }
`;

const HeaderBar = styled.header`
  display: flex; align-items: center;
  height: calc(56px + env(safe-area-inset-top, 0px));
  padding: 0 12px;
  padding-top: env(safe-area-inset-top, 0px);
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  position: sticky; top: 0; z-index: 40;
  gap: 8px; flex-shrink: 0;
  .dark & { background: #1e293b; border-bottom-color: #334155; }
  @media (min-width: 768px) { height: 64px; padding: 0 16px; padding-top: 0; gap: 8px; }
  @media (min-width: 1024px) { padding: 0 24px; padding-top: 0; }
`;

const MainContentStyled = styled.main`
  flex: 1;
  overflow-y: auto; overflow-x: hidden;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  @media (min-width: 768px) { padding: 24px; padding-bottom: 24px; }
  @media (min-width: 1024px) { padding: 32px; padding-bottom: 32px; }
`;

const IconBtn = styled(motion.button)`
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 12px;
  border: none; cursor: pointer; position: relative;
  background: #f1f5f9; color: #475569;
  transition: background 0.2s, color 0.2s;
  flex-shrink: 0;
  &:hover { background: #e2e8f0; }
  &:active { background: #cbd5e1; }
  .dark & { background: #334155; color: #cbd5e1; &:hover { background: #475569; } }
  @media (min-width: 768px) { width: 40px; height: 40px; }
`;

const BadgeEl = styled(motion.span)`
  position: absolute; top: -2px; right: -2px;
  min-width: 18px; height: 18px; padding: 0 5px;
  background: #ef4444; color: white;
  font-size: 10px; font-weight: 700;
  border-radius: 9px; display: flex;
  align-items: center; justify-content: center;
`;

const SidebarLogo = styled.div`
  padding: 20px 16px 16px;
  padding-top: calc(env(safe-area-inset-top, 0px) + 20px);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  border-bottom: 1px solid #f1f5f9;
  .dark & { border-bottom-color: #334155; }
`;

const SidebarNavSection = styled.div`
  padding: 8px 12px;
`;

const SidebarNavLabel = styled.p`
  font-size: 11px; font-weight: 600; color: #94a3b8;
  text-transform: uppercase; letter-spacing: 0.05em;
  padding: 8px 12px 4px;
  .dark & { color: #64748b; }
`;

const SidebarNavLinkStyled = styled(NavLink)`
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 12px;
  font-size: 14px; font-weight: 500;
  color: #475569; text-decoration: none;
  transition: all 0.2s; margin-bottom: 2px;
  border: 1px solid transparent;
  white-space: nowrap;
  &:hover { background: #f8fafc; color: #3b82f6; border-color: #e2e8f0; }
  &.active { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; font-weight: 600; }
  .dark & {
    color: #cbd5e1;
    &:hover { background: #334155; color: #60a5fa; border-color: #475569; }
    &.active { background: rgba(59,130,246,0.15); color: #60a5fa; border-color: rgba(59,130,246,0.3); }
  }
`;

const NavIconWrap = styled.div<{ $active?: boolean }>`
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  transition: all 0.2s;
  background: ${p => p.$active ? '#3b82f6' : '#f1f5f9'};
  color: ${p => p.$active ? '#ffffff' : '#64748b'};
  .dark & {
    background: ${p => p.$active ? '#3b82f6' : '#334155'};
    color: ${p => p.$active ? '#ffffff' : '#94a3b8'};
  }
`;

const LogoutBtn = styled.button`
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 12px;
  font-size: 14px; font-weight: 500;
  color: #475569; width: 100%; text-align: left;
  border: none; background: none; cursor: pointer;
  transition: all 0.2s;
  &:hover { background: #fef2f2; color: #dc2626; }
  .dark & { color: #cbd5e1; &:hover { background: rgba(239,68,68,0.15); color: #f87171; } }
`;

const NotificationPanel = styled(motion.div)`
  position: fixed; z-index: 90;
  inset: 56px 0 0 0;
  @media (min-width: 768px) {
    position: absolute; inset: auto;
    top: 100%; right: 0; margin-top: 8px;
    width: 400px; max-height: 80vh;
    border-radius: 16px; overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    z-index: 100;
  }
`;

/* ── Animation ── */
const pageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
    exit: { opacity: 0, y: -6, transition: { duration: 0.18 } }
};

/* ── Nav items ── */
const navItems = [
    { icon: LayoutDashboard, label: 'Tổng quan', path: '/', mobileLabel: 'Tổng quan' },
    { icon: CheckSquare, label: 'Quản lý công việc', path: '/projects', mobileLabel: 'Dự án' },
    { icon: Columns3, label: 'Làm việc nhóm', path: '/kanban', mobileLabel: 'Nhóm' },
    { icon: ListTodo, label: 'Công việc cá nhân', path: '/my-tasks', mobileLabel: 'Việc tôi' },
    { icon: FolderOpen, label: 'Thư mục', path: '/folders', mobileLabel: 'Thư mục' },
];

/* ── Main Layout Component ── */
const MainLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const notifRef = useRef<HTMLDivElement>(null);

    const location = useLocation();
    const navigate = useNavigate();
    const { logout, user, token } = useAuth();
    const { socketRef, connected } = useWebSocket(token);

    // Close sidebar on route change
    useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

    // Click outside notification panel
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Fetch unread count
    useEffect(() => {
        if (!user) return;
        const fetchCount = async () => {
            try {
                const res = await api.get('/notifications/unread-count');
                setUnreadCount(res.data.unreadCount);
            } catch { /* ignore */ }
        };
        fetchCount();
        const iv = setInterval(fetchCount, 30000);
        return () => clearInterval(iv);
    }, [user]);

    // Socket real-time notification
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || !connected) return;
        const handler = () => setUnreadCount(p => p + 1);
        socket.on('new_notification', handler);
        return () => { socket.off('new_notification', handler); };
    }, [socketRef, connected]);

    const handleLogout = () => { logout(); navigate('/login'); };

    const closeNotifications = () => {
        setShowNotifications(false);
        api.get('/notifications/unread-count').then(res => setUnreadCount(res.data.unreadCount)).catch(() => { });
    };

    return (
        <LayoutWrapper>
            {/* Desktop Sidebar */}
            <SidebarDesktop>
                <SidebarContentInner items={navItems} onNavClick={() => { }} onLogout={handleLogout} showClose={false} />
            </SidebarDesktop>

            {/* Mobile Sidebar */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        <MobileOverlay
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setSidebarOpen(false)}
                        />
                        <MobileSidebar
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        >
                            <SidebarContentInner
                                items={navItems}
                                onNavClick={() => setSidebarOpen(false)}
                                onLogout={handleLogout}
                                showClose
                                onClose={() => setSidebarOpen(false)}
                            />
                        </MobileSidebar>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <ContentArea>
                <HeaderBar>
                    <IconBtn
                        className="hidden md:flex lg:!hidden"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        whileTap={{ scale: 0.9 }}
                    >
                        <Menu size={20} />
                    </IconBtn>
                    <div style={{ flex: 1 }} />
                    <ChatPopup />
                    <div style={{ position: 'relative' }} ref={notifRef}>
                        <IconBtn onClick={() => setShowNotifications(!showNotifications)} whileTap={{ scale: 0.9 }}>
                            <Bell size={20} />
                            <AnimatePresence>
                                {unreadCount > 0 && (
                                    <BadgeEl
                                        initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                    >
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </BadgeEl>
                                )}
                            </AnimatePresence>
                        </IconBtn>
                        <AnimatePresence>
                            {showNotifications && (
                                <>
                                    <motion.div
                                        className="md:hidden fixed inset-0 bg-black/20 z-[80]"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        onClick={() => setShowNotifications(false)}
                                    />
                                    <NotificationPanel
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                    >
                                        <NotificationList onClose={closeNotifications} />
                                    </NotificationPanel>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                    <UserProfilePopup />
                </HeaderBar>

                <MainContentStyled>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            variants={pageVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="max-w-7xl mx-auto w-full"
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </MainContentStyled>
            </ContentArea>
        </LayoutWrapper>
    );
};

/* ── Sidebar Content (shared) ── */
interface SidebarContentInnerProps {
    items: typeof navItems;
    onNavClick: () => void;
    onLogout: () => void;
    showClose: boolean;
    onClose?: () => void;
}

const SidebarContentInner = ({ items, onNavClick, onLogout, showClose, onClose }: SidebarContentInnerProps) => (
    <>
        <SidebarLogo>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <img src="/Logo.png" alt="JTSC" style={{ height: 52, objectFit: 'contain' }} />
                {showClose && (
                    <IconBtn onClick={onClose} whileTap={{ scale: 0.85 }} style={{ position: 'absolute', right: 0 }}>
                        <X size={20} />
                    </IconBtn>
                )}
            </div>
            <div style={{ textAlign: 'center', width: '100%' }}>
                <p className="text-xs font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 dark:from-orange-400 dark:via-pink-500 dark:to-orange-400 bg-clip-text text-transparent animate-gradientShift bg-[length:200%_auto]">
                    Lắng nghe từ tâm
                </p>
                <p className="text-xs font-semibold bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 dark:from-pink-500 dark:via-orange-400 dark:to-pink-500 bg-clip-text text-transparent animate-gradientShift bg-[length:200%_auto] animation-delay-200">
                    Kiến tạo vươn tầm
                </p>
            </div>
        </SidebarLogo>
        <SidebarNavSection style={{ flex: 1, overflowY: 'auto' }}>
            <SidebarNavLabel>Menu</SidebarNavLabel>
            {items.map(item => (
                <SidebarNavLinkStyled key={item.path} to={item.path} end={item.path === '/'} onClick={onNavClick}>
                    {({ isActive }: { isActive: boolean }) => (
                        <>
                            <NavIconWrap $active={isActive}><item.icon size={18} /></NavIconWrap>
                            <span>{item.label}</span>
                            {isActive && <ChevronRight size={16} style={{ opacity: 0.5, marginLeft: 'auto' }} />}
                        </>
                    )}
                </SidebarNavLinkStyled>
            ))}
        </SidebarNavSection>
        <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9' }} className="dark:!border-slate-700 pb-safe">
            <LogoutBtn onClick={onLogout}>
                <NavIconWrap $active={false}><LogOut size={18} /></NavIconWrap>
                <span>Đăng xuất</span>
            </LogoutBtn>
        </div>
    </>
);

export default MainLayout;
