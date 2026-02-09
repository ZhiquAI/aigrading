'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, Search, Sparkles } from 'lucide-react';
import AdminPageHeader from '../_components/AdminPageHeader';
import AdminFilterBar from '../_components/AdminFilterBar';
import { adminTokens } from '../_styles/tokens';
import CodeList from './components/CodeList';
import CreateCodeModal from './components/CreateCodeModal';

const FILTER_OPTIONS = ['all', 'unused', 'used'];

function CodesPageContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [codes, setCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [filter, setFilter] = useState(() => {
        const value = searchParams.get('filter') ?? 'all';
        return FILTER_OPTIONS.includes(value) ? value : 'all';
    }); // all, unused, used
    const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');

    useEffect(() => {
        const nextFilter = searchParams.get('filter') ?? 'all';
        const nextQuery = searchParams.get('q') ?? '';
        if (nextFilter !== filter) setFilter(nextFilter);
        if (nextQuery !== searchTerm) setSearchTerm(nextQuery);
    }, [searchParams, filter, searchTerm]);

    useEffect(() => {
        const params = new URLSearchParams();
        if (filter !== 'all') params.set('filter', filter);
        if (searchTerm) params.set('q', searchTerm);
        const next = params.toString();
        const current = searchParams.toString();
        if (next !== current) {
            router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
        }
    }, [filter, searchTerm, searchParams, router, pathname]);

    const fetchCodes = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ filter });
            if (searchTerm) params.append('search', searchTerm);

            const res = await fetch(`/api/admin/codes?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setCodes(data.data.codes);
            }
        } catch (error) {
            console.error('Fetch codes error:', error);
        } finally {
            setLoading(false);
        }
    }, [filter, searchTerm]);

    const handleExportCodes = async () => {
        const params = new URLSearchParams({ filter });
        if (searchTerm) params.append('search', searchTerm);

        const url = `/api/admin/codes/export?${params.toString()}`;
        const token = localStorage.getItem('admin_token');

        try {
            const res = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                const blob = await res.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `activation_codes_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(downloadUrl);
                document.body.removeChild(a);
            } else {
                alert('导出失败');
            }
        } catch (error) {
            console.error('Export error:', error);
            alert('网络错误，请稍后重试');
        }
    };

    useEffect(() => {
        fetchCodes();
    }, [fetchCodes]);

    return (
        <div className={adminTokens.page}>
            <AdminPageHeader
                title="激活码管理"
                subtitle="管理系统的所有激活码、充值卡及机构授权"
                actions={(
                    <>
                        <button
                            onClick={handleExportCodes}
                            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-medium shadow-sm"
                            type="button"
                        >
                            <Download className="w-4 h-4" aria-hidden />
                            <span>导出 CSV</span>
                        </button>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                            type="button"
                        >
                            <Sparkles className="w-4 h-4" aria-hidden />
                            <span className="font-medium">生成激活码</span>
                        </button>
                    </>
                )}
            />

            <AdminFilterBar>
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex-1 min-w-[200px]">
                    <label htmlFor="code-search" className="sr-only">搜索激活码</label>
                    <Search className="w-4 h-4 text-gray-400" aria-hidden />
                    <input
                        id="code-search"
                        name="search"
                        type="text"
                        placeholder="搜索激活码…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm w-full p-0 text-gray-900 placeholder-gray-400"
                        autoComplete="off"
                        aria-label="搜索激活码"
                    />
                </div>

                <div className="flex gap-2">
                    {FILTER_OPTIONS.map((option) => (
                        <button
                            key={option}
                            onClick={() => setFilter(option)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === option
                                ? 'bg-gray-900 text-white'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                }`}
                            type="button"
                            aria-pressed={filter === option}
                        >
                            {option === 'all' && '全部'}
                            {option === 'unused' && '未使用'}
                            {option === 'used' && '已使用'}
                        </button>
                    ))}
                </div>
            </AdminFilterBar>

            {/* 列表 */}
            <CodeList codes={codes} loading={loading} onRefresh={fetchCodes} />

            {/* 弹窗 */}
            <CreateCodeModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => {
                    fetchCodes();
                    // 显示成功提示可以加在这里
                }}
            />
        </div>
    );
}

export default function CodesPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">加载中...</div>}>
            <CodesPageContent />
        </Suspense>
    );
}
