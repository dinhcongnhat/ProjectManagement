import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon, Loader2, ArrowRight, Cpu, Globe, Shield, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config/api';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            login(data.token, data.user);

            // Redirect based on role
            if (data.user.role === 'ADMIN') {
                navigate('/admin');
            } else {
                navigate('/my-tasks');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred during login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`fixed inset-0 overflow-y-auto flex items-center justify-center p-4 z-50 ${isDark
            ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
            : 'bg-gradient-to-br from-blue-50 via-white to-cyan-50'
            }`}>
            {/* Animated Tech Background - Hidden on mobile for performance */}
            <div className="absolute inset-0 overflow-hidden hidden sm:block">
                {/* Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(${isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(59, 130, 246, 0.5)'} 1px, transparent 1px), linear-gradient(90deg, ${isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(59, 130, 246, 0.5)'} 1px, transparent 1px)`,
                        backgroundSize: '50px 50px'
                    }}
                />

                {/* Floating Tech Icons */}
                <motion.div
                    className="absolute top-20 left-20 text-blue-200"
                    animate={{
                        y: [0, -10, 0],
                        rotate: [0, 5, 0]
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: 'easeInOut'
                    }}
                >
                    <Cpu size={40} />
                </motion.div>
                <motion.div
                    className="absolute top-40 right-32 text-cyan-200"
                    animate={{
                        y: [0, 15, 0],
                        x: [0, 5, 0]
                    }}
                    transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: 'easeInOut'
                    }}
                >
                    <Globe size={32} />
                </motion.div>
                <motion.div
                    className="absolute bottom-32 left-32 text-blue-200"
                    animate={{
                        y: [0, -15, 0],
                        rotate: [0, -5, 0]
                    }}
                    transition={{
                        duration: 6,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: 1
                    }}
                >
                    <Shield size={36} />
                </motion.div>
                <motion.div
                    className="absolute bottom-40 right-20 text-cyan-200"
                    animate={{
                        y: [0, 12, 0],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut'
                    }}
                >
                    <Zap size={28} />
                </motion.div>

                {/* Gradient Orbs */}
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-cyan-400/20 to-blue-400/20 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-blue-300/10 to-cyan-300/10 rounded-full blur-3xl" />

                {/* Connecting Lines */}
                <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#3B82F6" />
                            <stop offset="100%" stopColor="#06B6D4" />
                        </linearGradient>
                    </defs>
                    <line x1="10%" y1="20%" x2="30%" y2="40%" stroke="url(#lineGradient)" strokeWidth="1" />
                    <line x1="70%" y1="10%" x2="90%" y2="30%" stroke="url(#lineGradient)" strokeWidth="1" />
                    <line x1="20%" y1="70%" x2="40%" y2="90%" stroke="url(#lineGradient)" strokeWidth="1" />
                    <line x1="60%" y1="80%" x2="85%" y2="60%" stroke="url(#lineGradient)" strokeWidth="1" />
                    <circle cx="10%" cy="20%" r="3" fill="#3B82F6" className="animate-pulse" />
                    <circle cx="30%" cy="40%" r="3" fill="#06B6D4" className="animate-pulse" />
                    <circle cx="70%" cy="10%" r="3" fill="#3B82F6" className="animate-pulse" />
                    <circle cx="90%" cy="30%" r="3" fill="#06B6D4" className="animate-pulse" />
                </svg>
            </div>

            {/* Login Card */}
            <motion.div
                className="max-w-md w-full relative z-10"
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                    duration: 0.5,
                    ease: 'easeOut'
                }}
            >
                <div className={`relative backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden ${isDark
                    ? 'bg-gray-800/90 shadow-gray-900/50'
                    : 'bg-white/90 shadow-blue-500/20'
                    }`}>
                    <div className="p-6 lg:p-8">
                        <div className="text-center mb-6 lg:mb-8">
                            <div className="flex justify-center mb-4">
                                <img src="/Logo.png" alt="Logo" className="h-24 lg:h-28 w-auto" />
                            </div>
                            <h2 className={`text-2xl lg:text-3xl font-bold bg-clip-text text-transparent mb-2 tracking-tight ${isDark
                                ? 'bg-gradient-to-r from-orange-400 to-pink-500'
                                : 'bg-gradient-to-r from-blue-600 to-cyan-600'
                                }`}>PROJECT MANAGEMENT</h2>
                            <p className={isDark ? 'text-gray-400 text-sm lg:text-base' : 'text-gray-500 text-sm lg:text-base'}>Đăng nhập để truy cập hệ thống quản lý dự án</p>
                        </div>

                        {error && (
                            <div className="mb-4 lg:mb-6 p-3 lg:p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5">
                            <div className="space-y-2">
                                <label className={`text-sm font-medium ml-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Tên đăng nhập</label>
                                <div className="relative group">
                                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-blue-500 transition-colors ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        <UserIcon className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className={`w-full pl-11 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 text-base ${isDark
                                            ? 'bg-gray-700/50 border-gray-600 text-gray-100 placeholder-gray-500 focus:bg-gray-700'
                                            : 'bg-gray-50/50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white'
                                            } border`}
                                        placeholder="Nhập tên đăng nhập"
                                        required
                                        autoComplete="username"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className={`text-sm font-medium ml-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Mật khẩu</label>
                                <div className="relative group">
                                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-blue-500 transition-colors ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        <Lock className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={`w-full pl-11 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 text-base ${isDark
                                            ? 'bg-gray-700/50 border-gray-600 text-gray-100 placeholder-gray-500 focus:bg-gray-700'
                                            : 'bg-gray-50/50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white'
                                            } border`}
                                        placeholder="••••••••"
                                        required
                                        autoComplete="current-password"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 active:from-blue-700 active:to-cyan-700 text-white font-semibold py-3.5 lg:py-4 rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group touch-target"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Đăng nhập
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    <div className={`px-6 lg:px-8 py-3 lg:py-4 border-t text-center ${isDark
                        ? 'bg-gradient-to-r from-gray-700/50 to-gray-700/30 border-gray-700'
                        : 'bg-gradient-to-r from-blue-50/50 to-cyan-50/50 border-gray-100'
                        }`}>
                        <p className={`text-xs flex items-center justify-center gap-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <Shield className={`w-3.5 h-3.5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                            Được bảo vệ bởi hệ thống bảo mật cấp doanh nghiệp
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;

