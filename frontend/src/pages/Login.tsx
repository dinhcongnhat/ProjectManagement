import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon, Loader2, ArrowRight, Cpu, Globe, Shield, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated Tech Background - Hidden on mobile for performance */}
            <div className="absolute inset-0 overflow-hidden hidden sm:block">
                {/* Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.03]" 
                    style={{
                        backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.5) 1px, transparent 1px)`,
                        backgroundSize: '50px 50px'
                    }}
                />
                
                {/* Floating Tech Icons */}
                <div className="absolute top-20 left-20 text-blue-200 animate-pulse">
                    <Cpu size={40} />
                </div>
                <div className="absolute top-40 right-32 text-cyan-200 animate-bounce" style={{ animationDuration: '3s' }}>
                    <Globe size={32} />
                </div>
                <div className="absolute bottom-32 left-32 text-blue-200 animate-pulse" style={{ animationDelay: '1s' }}>
                    <Shield size={36} />
                </div>
                <div className="absolute bottom-40 right-20 text-cyan-200 animate-bounce" style={{ animationDuration: '2.5s' }}>
                    <Zap size={28} />
                </div>
                
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
            <div className="max-w-md w-full relative z-10">
                {/* Glowing border effect - simplified on mobile */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 rounded-2xl opacity-75 blur-sm animate-pulse hidden sm:block" />
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 rounded-2xl opacity-50 hidden sm:block" />
                
                <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl shadow-blue-500/20 overflow-hidden">
                    <div className="p-6 lg:p-8">
                    <div className="text-center mb-6 lg:mb-8">
                        <div className="flex justify-center mb-4">
                            <img src="/Logo.png" alt="Logo" className="h-16 lg:h-20 w-auto" />
                        </div>
                        <h2 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2 tracking-tight">PROJECT MANAGEMENT</h2>
                        <p className="text-gray-500 text-sm lg:text-base">Đăng nhập để truy cập hệ thống quản lý dự án</p>
                    </div>

                    {error && (
                        <div className="mb-4 lg:mb-6 p-3 lg:p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Tên đăng nhập</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                    <UserIcon className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition-all duration-200 text-base"
                                    placeholder="Nhập tên đăng nhập"
                                    required
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Mật khẩu</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition-all duration-200 text-base"
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

                <div className="px-6 lg:px-8 py-3 lg:py-4 bg-gradient-to-r from-blue-50/50 to-cyan-50/50 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-blue-500" />
                        Được bảo vệ bởi hệ thống bảo mật cấp doanh nghiệp
                    </p>
                </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
