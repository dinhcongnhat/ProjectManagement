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

/* ══════════════════════════════════════════════════════════════
   Emotion styled — fully rebuilt for iOS PWA edge-to-edge
   ══════════════════════════════════════════════════════════════ */

/**
 * The root layout uses a 100dvh approach instead of position:fixed+inset
 * to avoid iOS standalone-mode bottom-gap bugs.
 * Background matches the app color so even if there IS a sub-pixel gap
 * it's invisible.
 */
const LayoutWrapper = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  background: #f8fafc;
  overflow: hidden;
  margin: 0; padding: 0;
  .dark & { background: #0f172a; }
`;

/* ── Desktop sidebar ── */
const SidebarDesktop = styled.aside`
  display: none;
  @media (min-width: 1024px) {
    display: flex; flex-direction: column;
    width: 260px; min-width: 260px;
    height: 100vh; height: 100dvh;
    position: fixed; left: 0; top: 0; z-index: 50;
    background: #ffffff;
    border-right: 1px solid #e2e8f0;
    .dark & { background: #1e293b; border-right-color: #334155; }
  }
`;

/* ── Mobile sidebar overlay ── */
const MobileOverlay = styled(motion.div)`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  z-index: 55;
  @media (min-width: 1024px) { display: none; }
`;

/* ── Mobile sidebar ── */
const MobileSidebar = styled(motion.aside)`
  position: fixed; left: 0; top: 0;
  width: 280px; max-width: 85vw;
  height: 100%; height: 100dvh;
  z-index: 60;
  background: #ffffff;
  box-shadow: 4px 0 24px rgba(0,0,0,0.12);
  display: flex; flex-direction: column;
  padding-top: env(safe-area-inset-top, 0px);
  .dark & { background: #1e293b; }
  @media (min-width: 1024px) { display: none; }
`;

/* ── Content area (header + scroll area) ── */
const ContentArea = styled.div`
  flex: 1;
  display: flex; flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background: #f8fafc;
  .dark & { background: #0f172a; }
  @media (min-width: 1024px) { margin-left: 260px; }
`;

/* ── Header bar — compact on mobile ── */
const HeaderBar = styled.header`
  display: flex; align-items: center;
  height: 48px;
  padding: 0 12px;
  padding-left: max(12px, env(safe-area-inset-left, 0px));
  padding-right: max(12px, env(safe-area-inset-right, 0px));
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  gap: 6px;
  z-index: 40;
  .dark & { background: #1e293b; border-bottom-color: #334155; }
  @media (min-width: 768px) { height: 56px; padding: 0 16px; gap: 8px; }
  @media (min-width: 1024px) { height: 60px; padding: 0 24px; }

  /* iOS PWA: add status-bar inset ONLY in standalone mode */
  @media (display-mode: standalone) {
    padding-top: env(safe-area-inset-top, 0px);
    height: calc(48px + env(safe-area-inset-top, 0px));
    @media (min-width: 768px) { height: calc(56px + env(safe-area-inset-top, 0px)); }
    @media (min-width: 1024px) { height: calc(60px + env(safe-area-inset-top, 0px)); }
  }
  @supports (-webkit-touch-callout: none) {
    padding-top: env(safe-area-inset-top, 0px);
    height: calc(48px + env(safe-area-inset-top, 0px));
    @media (min-width: 768px) { height: calc(56px + env(safe-area-inset-top, 0px)); }
    @media (min-width: 1024px) { height: calc(60px + env(safe-area-inset-top, 0px)); }
  }
`;

/* ── Main scrollable content — NO bottom safe-area padding ── */
const MainContentStyled = styled.main`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  padding: 12px;
  padding-left: max(12px, env(safe-area-inset-left, 0px));
  padding-right: max(12px, env(safe-area-inset-right, 0px));
  @media (min-width: 768px) { padding: 20px; }
  @media (min-width: 1024px) { padding: 32px; }
`;

/* ── Compact icon button ── */
const IconBtn = styled(motion.button)`
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 10px;
  border: none; cursor: pointer; position: relative;
  background: #f1f5f9; color: #475569;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
  &:hover { background: #e2e8f0; }
  &:active { background: #cbd5e1; }
  .dark & { background: #334155; color: #cbd5e1; &:hover { background: #475569; } }
  @media (min-width: 768px) { width: 38px; height: 38px; border-radius: 12px; }
`;

const BadgeEl = styled(motion.span)`
  position: absolute; top: -3px; right: -3px;
  min-width: 17px; height: 17px; padding: 0 4px;
  background: #ef4444; color: white;
  font-size: 10px; font-weight: 700;
  border-radius: 9px; display: flex;
  align-items: center; justify-content: center;
`;

/* ── Sidebar internals (unchanged from original) ── */
const SidebarLogo = styled.div`
  padding: 20px 16px 16px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  border-bottom: 1px solid #f1f5f9;
  .dark & { border-bottom-color: #334155; }
`;

const SidebarNavSection = styled.div`padding: 8px 12px;`;

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
  inset: 48px 0 0 0;
  @media (min-width: 768px) {
    position: absolute; inset: auto;
    top: 100%; right: 0; margin-top: 8px;
    width: 400px; max-height: 80vh;
    border-radius: 16px; overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    z-index: 100;
  }
`;

/* ── page transition ── */
const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
    exit: { opacity: 0, y: -4, transition: { duration: 0.15 } }
};

/* ── Nav items ── */
const navItems = [
    { icon: LayoutDashboard, label: 'Tổng quan', path: '/', mobileLabel: 'Tổng quan' },
    { icon: CheckSquare, label: 'Quản lý dự án', path: '/projects', mobileLabel: 'Dự án' },
    { icon: Columns3, label: 'Làm việc nhóm', path: '/kanban', mobileLabel: 'Nhóm' },
    { icon: ListTodo, label: 'Công việc cá nhân', path: '/my-tasks', mobileLabel: 'Việc tôi' },
    { icon: FolderOpen, label: 'Thư mục', path: '/folders', mobileLabel: 'Thư mục' },
];

/* ══════════════════════════════════════════════════════════════
   Main Layout Component
   ══════════════════════════════════════════════════════════════ */
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
                        className="flex lg:!hidden"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        whileTap={{ scale: 0.9 }}
                    >
                        <Menu size={18} />
                    </IconBtn>
                    <div style={{ flex: 1 }} />
                    <ChatPopup />
                    <div style={{ position: 'relative' }} ref={notifRef}>
                        <IconBtn onClick={() => setShowNotifications(!showNotifications)} whileTap={{ scale: 0.9 }}>
                            <Bell size={18} />
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
                            style={{ minHeight: 0 }}
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
                <img src="/Logo.png" alt="JTSC" style={{ height: 80, maxWidth: '100%', objectFit: 'contain' }} />
                {showClose && (
                    <IconBtn onClick={onClose} whileTap={{ scale: 0.85 }} style={{ position: 'absolute', right: 0 }}>
                        <X size={20} />
                    </IconBtn>
                )}
            </div>
            <div style={{ textAlign: 'center', width: '100%' }}>
                <p className="text-xs font-bold bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 dark:from-red-500 dark:via-yellow-400 dark:to-red-500 bg-clip-text text-transparent animate-gradientShift bg-[length:200%_auto] tracking-wide uppercase drop-shadow-sm">
                    Lắng nghe từ tâm
                </p>
                <p className="text-xs font-bold bg-gradient-to-r from-yellow-600 via-red-600 to-yellow-600 dark:from-yellow-400 dark:via-red-500 dark:to-yellow-400 bg-clip-text text-transparent animate-gradientShift bg-[length:200%_auto] animation-delay-200 tracking-wide uppercase drop-shadow-sm">
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
        <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9' }} className="dark:!border-slate-700">
            <LogoutBtn onClick={onLogout}>
                <NavIconWrap $active={false}><LogOut size={18} /></NavIconWrap>
                <span>Đăng xuất</span>
            </LogoutBtn>
        </div>
    </>
);

export default MainLayout;
