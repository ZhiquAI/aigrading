'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    BarChart3,
    ClipboardList,
    KeyRound,
    LayoutDashboard,
    LogOut,
    Menu,
    Plug,
    Settings,
    Target,
} from 'lucide-react';

// 侧边栏菜单项
const menuItems = [
    { icon: LayoutDashboard, label: '仪表盘', href: '/admin/dashboard' },
    { icon: KeyRound, label: '激活码', href: '/admin/codes' },
    { icon: BarChart3, label: '使用统计', href: '/admin/usage' },
    { icon: ClipboardList, label: '批改记录', href: '/admin/records' },
    { icon: Plug, label: 'API 管理', href: '/admin/api' },
    { icon: Settings, label: '设置', href: '/admin/settings' },
];

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        // 检查登录状态
        const token = localStorage.getItem('admin_token');
        if (!token && pathname !== '/admin') {
            router.push('/admin');
        }
    }, [pathname, router]);

    // 登录页面不需要布局
    if (pathname === '/admin') {
        return <>{children}</>;
    }

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        router.push('/admin');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <a
                href="#admin-main"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:bg-white focus:text-gray-900 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow"
            >
                跳到主内容
            </a>
            {/* 移动端遮罩 */}
            {sidebarOpen && (
                <button
                    type="button"
                    aria-label="关闭侧边栏"
                    className="fixed inset-0 bg-black/30 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* 侧边栏 */}
            <aside
                id="admin-sidebar"
                className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 shadow-sm transform transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Logo */}
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <Target className="w-5 h-5 text-white" aria-hidden />
                        </div>
                        <div>
                            <h1 className="text-gray-900 font-bold">智阅 AI</h1>
                            <p className="text-gray-400 text-xs">管理后台</p>
                        </div>
                    </div>
                </div>

                {/* 菜单 */}
                <nav className="p-4 space-y-1">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }`}
                            >
                                <Icon className="w-4 h-4" aria-hidden />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* 退出 */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                        type="button"
                    >
                        <LogOut className="w-4 h-4" aria-hidden />
                        <span>退出登录</span>
                    </button>
                </div>
            </aside>

            {/* 主内容区 */}
            <main id="admin-main" tabIndex={-1} className="flex-1 min-w-0">
                {/* 顶栏 */}
                <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden p-2 text-gray-500 hover:text-gray-900"
                        aria-label="打开侧边栏"
                        aria-controls="admin-sidebar"
                        aria-expanded={sidebarOpen}
                        type="button"
                    >
                        <Menu className="w-6 h-6" aria-hidden />
                    </button>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-gray-500">系统正常</span>
                    </div>
                </header>

                {/* 页面内容 */}
                <div className="p-6">{children}</div>
            </main>
        </div>
    );
}
