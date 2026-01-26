import React, { useEffect, useState, useMemo } from 'react';
import { Download, Search, LayoutGrid, List, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Bot } from 'lucide-react';
import { useAppStore, HistoryRecord } from '@/stores/useAppStore';

const RecordsViewV2: React.FC = () => {
    const { historyRecords, loadHistory, isHistoryLoading, deleteHistoryRecord, setHeaderActions } = useAppStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Initial load & Header Action Registration
    useEffect(() => {
        loadHistory();

        // Register Export Action
        setHeaderActions([
            {
                id: 'export-history',
                label: '导出记录',
                icon: 'Download',
                onClick: handleExport
            }
        ]);

        return () => setHeaderActions([]);
    }, []);

    // Filter Logic
    const filteredRecords = useMemo(() => {
        if (!searchTerm) return historyRecords;
        const lower = searchTerm.toLowerCase();
        return historyRecords.filter(r => {
            const hasKeyword = r.comment?.toLowerCase().includes(lower) ||
                r.breakdown?.some(b => b.label.toLowerCase().includes(lower));
            return hasKeyword;
        });
    }, [historyRecords, searchTerm]);

    // Format helpers
    const formatTime = (ts: number) => {
        const now = Date.now();
        const diff = now - ts;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}小时前`;
        const days = Math.floor(hours / 24);
        return `${days}天前`;
    };

    const getScoreColor = (score: number, max: number) => {
        const ratio = max > 0 ? score / max : 0;
        if (ratio >= 0.85) return 'text-green-600';
        if (ratio >= 0.6) return 'text-orange-500';
        return 'text-red-500';
    };

    const handleExport = () => {
        const headers = ['序号', '时间', '题目', '得分', '满分', 'AI评语'];
        const rows = filteredRecords.map((h, idx) => {
            const ts = Number(h.timestamp);
            const time = Number.isFinite(ts) && ts > 0 ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '';
            const questionNo = h.questionNo || '-';

            // Escape quotes for CSV
            const safeComment = (h.comment || '').replace(/"/g, '""');

            return [filteredRecords.length - idx, time, questionNo, h.score, h.maxScore, `"${safeComment}"`];
        });

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `grading_records_${new Date().getTime()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Filter Bar (Simplified) */}
            <div className="px-4 py-3 bg-white border-b border-slate-200/60 shadow-sm z-10 shrink-0 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="搜索评论关键词..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-400"
                    />
                </div>

                <div className="shrink-0">
                    <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-lg font-bold border border-slate-100">
                        {filteredRecords.length} 条
                    </span>
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
                {isHistoryLoading ? (
                    <div className="text-center py-10 text-slate-400 text-sm">加载中...</div>
                ) : filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-400 mt-10">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-200">
                            <div className="w-8 h-8 text-slate-300" >
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" /><path d="M3 3v9h9" /><path d="M12 7v5l4 2" /></svg>
                            </div>
                        </div>
                        <h3 className="text-sm font-bold text-slate-600">暂无阅卷记录</h3>
                        <p className="text-xs mt-2 text-slate-400 max-w-[200px] text-center leading-relaxed">
                            点击底部 <span className="font-bold text-indigo-500">阅卷</span> 按钮开始批改<br />
                            您的评估记录将自动保存至此
                        </p>
                    </div>
                ) : (
                    filteredRecords.map((record, index) => {
                        const isExpanded = expandedId === record.id;
                        // Reverse index for display #
                        const displayIndex = filteredRecords.length - index;

                        return (
                            <div key={record.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-indigo-100">
                                {/* Summary Row */}
                                <div
                                    className="flex items-center p-3 cursor-pointer select-none"
                                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                                >
                                    {/* ID & Time */}
                                    <div className="w-16 shrink-0">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-mono font-bold text-slate-400">#{String(displayIndex).padStart(3, '0')}</span>
                                            <span className="text-[10px] text-slate-400">{formatTime(record.timestamp)}</span>
                                        </div>
                                    </div>

                                    {/* Question No (Optional) */}
                                    {record.questionNo && (
                                        <div className="w-12 shrink-0 text-xs font-medium text-slate-500">
                                            Q{record.questionNo}
                                        </div>
                                    )}

                                    {/* Score */}
                                    <div className="w-20 shrink-0 flex flex-col items-center">
                                        <div className="flex items-baseline gap-0.5">
                                            <span className={`text-lg font-bold ${getScoreColor(record.score, record.maxScore)}`}>
                                                {record.score}
                                            </span>
                                            <span className="text-xs text-slate-300">/{record.maxScore}</span>
                                        </div>
                                    </div>

                                    {/* Breakdown Mini Bars */}
                                    <div className="flex-1 flex gap-0.5 h-6 items-end px-2 opacity-80">
                                        {(record.breakdown || []).map((b, idx) => {
                                            const pct = b.max > 0 ? (b.score / b.max) * 100 : 0;
                                            // Green if full, Orange/Red if partial/zero
                                            const barColor = pct === 100 ? 'bg-green-400' : (pct === 0 ? 'bg-red-300' : 'bg-orange-300');
                                            return (
                                                <div key={idx} className="flex-1 h-full bg-slate-100 rounded-sm relative group/bar min-w-[4px]">
                                                    <div
                                                        className={`absolute bottom-0 w-full rounded-sm ${barColor}`}
                                                        style={{ height: `${pct}%` }}
                                                    ></div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Toggle Icon */}
                                    <div className="w-8 flex justify-end">
                                        {isExpanded ?
                                            <ChevronUp className="w-4 h-4 text-indigo-500" /> :
                                            <ChevronDown className="w-4 h-4 text-slate-300" />
                                        }
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-1 bg-slate-50/50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                                        <div className="flex flex-col gap-4 mt-2">
                                            {/* AI Comment */}
                                            {record.comment && (
                                                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Bot className="w-3.5 h-3.5 text-indigo-500" />
                                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">AI 评分理由</h4>
                                                    </div>
                                                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                        {record.comment}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Breakdown Details */}
                                            {record.breakdown && record.breakdown.length > 0 && (
                                                <div className="space-y-2 pl-1">
                                                    {record.breakdown.map((item, i) => (
                                                        <div key={i} className="flex items-center text-xs">
                                                            <div className="w-24 text-slate-500 truncate" title={item.label}>{item.label}</div>
                                                            <div className="w-16 font-mono font-bold text-slate-700 text-right pr-4">
                                                                {item.score} <span className="text-slate-300 font-normal">/ {item.max}</span>
                                                            </div>
                                                            <div className="flex-1">
                                                                {/* Maybe show short comment here if available */}
                                                                {item.comment && <span className="text-slate-400 italic scale-90 origin-left inline-block">{item.comment}</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex justify-end gap-2 mt-1">
                                                <button
                                                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm('确定要移除这条记录吗？')) {
                                                            deleteHistoryRecord(record.id);
                                                        }
                                                    }}
                                                >
                                                    移除记录
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default RecordsViewV2;
