import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Frown, RefreshCw, Download, X, ChevronDown, Trash2, Sparkles } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from './Toast';
import { syncRecords, getLocalRecords, saveLocalRecords, deleteRecordFromServer, getLastSyncTime, RecordSyncStatus } from '@/services/record-sync';
import { useAppStore } from '@/stores/useAppStore';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';


interface HistoryRecord {
    id: string;
    questionNo?: string;
    questionKey?: string;
    name?: string;
    score: number;
    maxScore: number;
    timestamp: number;
    comment?: string; // AI 评语（Markdown 表格格式）
    breakdown?: { label: string; score: number; max: number; comment?: string }[];
    isHidden?: boolean; // 软删除标记
}

const HistoryView: React.FC = () => {
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [selectedQuestion, setSelectedQuestion] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showHidden, setShowHidden] = useState(false); // 是否显示已隐藏/清除的记录
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);

    // 同步相关状态
    const { isOfficial } = useAppStore();
    const [syncStatus, setSyncStatus] = useState<RecordSyncStatus>('idle');
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(getLastSyncTime());
    const [syncMessage, setSyncMessage] = useState<string>('');

    // 加载历史记录
    const loadHistory = async (): Promise<HistoryRecord[]> => {
        try {
            // 优先从统一的新 Key 加载
            let records = getLocalRecords() as any as HistoryRecord[];

            // 如果新 Key 没数据，尝试从旧 Key 迁移
            if (records.length === 0) {
                const oldSaved = localStorage.getItem('grading_history');
                if (oldSaved) {
                    try {
                        const oldRecords = JSON.parse(oldSaved);
                        if (Array.isArray(oldRecords) && oldRecords.length > 0) {
                            console.log('[History] Migrating records from grading_history to grading_records_v2');
                            records = oldRecords;
                            saveLocalRecords(records as any);
                        }
                    } catch (e) {
                        console.warn('[History] Migration failed:', e);
                    }
                }
            }
            return records;
        } catch (e) {
            return [];
        }
    };

    const saveHistory = async (newHistory: HistoryRecord[]) => {
        setHistory(newHistory);
        saveLocalRecords(newHistory as any);
    };

    // 执行手动同步
    const handleSync = async () => {
        if (!isOfficial) return;
        const result = await syncRecords({
            onStatusChange: (status, msg) => {
                setSyncStatus(status);
                if (msg) setSyncMessage(msg);
                if (status === 'success') {
                    setLastSyncTime(getLastSyncTime());
                    load(); // 同步成功后重新加载
                }
            }
        });
        if (!result.success) {
            toast.error(result.message || '同步失败');
        }
    };

    const load = async () => {
        setIsLoading(true);
        const data = await loadHistory();
        setHistory(data);
        setIsLoading(false);

        // 默认选中第一个题目（如果有）
        if (data.length > 0 && !selectedQuestion) {
            const firstKey = data[0].questionKey || data[0].questionNo || '';
            if (firstKey) {
                setSelectedQuestion(firstKey);
            }
        }
    };

    useEffect(() => {
        load();
        // 如果是正式会员，进页面自动同步一次
        if (isOfficial) {
            handleSync();
        }
    }, [isOfficial]);

    // 点击外部关闭下拉菜单
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isDropdownOpen]);



    // 提取唯一题目列表（按题号聚合）
    const uniqueQuestions = useMemo(() => {
        // Map<题号/GroupKey, { key: string, label: string, count: number, originalKeys: Set<string> }>
        const groupMap = new Map<string, { key: string; label: string; count: number; originalKeys: Set<string> }>();
        let uncategorizedCount = 0;

        history.forEach(item => {
            const rawKey = item.questionKey || item.questionNo || '';
            if (rawKey) {
                // 尝试提取标准化题号作为 GroupKey
                const label = item.questionNo || rawKey.split(':').pop() || rawKey;
                // 提取数字部分作为分组依据，例如 "22"
                const numMatch = label.match(/(\d+)/);
                const groupKey = numMatch ? numMatch[1] : label; // 如果没有数字，就用 label 本身

                const existing = groupMap.get(groupKey);
                if (existing) {
                    existing.count++;
                    existing.originalKeys.add(rawKey);
                } else {
                    groupMap.set(groupKey, {
                        key: groupKey, // 现在的 key 是题号（如 "22"）
                        label: numMatch ? `${numMatch[1]}` : label,
                        count: 1,
                        originalKeys: new Set([rawKey])
                    });
                }
            } else {
                uncategorizedCount++;
            }
        });

        const result = Array.from(groupMap.values()).sort((a, b) => {
            // 尝试按数字排序
            const numA = parseInt(a.key);
            const numB = parseInt(b.key);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.key.localeCompare(b.key);
        });

        // 如果有无题号的记录，添加"未分类"组
        if (uncategorizedCount > 0) {
            result.push({
                key: '__uncategorized__',
                label: '未分类',
                count: uncategorizedCount,
                originalKeys: new Set()
            });
        }

        return result;
    }, [history]);

    // 当题目列表更新时，自动修正选中的题目 Key (处理合并同类项的情况)
    useEffect(() => {
        if (!selectedQuestion || uniqueQuestions.length === 0) return;

        // 如果当前选中的已经是合法的 GroupKey，无需操作
        if (uniqueQuestions.some(g => g.key === selectedQuestion)) return;

        // 尝试查找 selectedQuestion (作为 originalKey) 属于哪个 Group
        const group = uniqueQuestions.find(g => g.originalKeys.has(selectedQuestion));
        if (group) {
            setSelectedQuestion(group.key);
        }
    }, [uniqueQuestions, selectedQuestion]);

    // 根据筛选展示的历史记录（支持按题号分组筛选）
    const filteredHistory = useMemo(() => {
        let list = history;

        // 1. 题目筛选
        if (selectedQuestion) {
            if (selectedQuestion === '__uncategorized__') {
                list = list.filter(item => !item.questionKey && !item.questionNo);
            } else {
                // selectedQuestion 现在是 groupKey (如 "22")
                // 我们需要找到该组对应的所有 originalKeys
                const group = uniqueQuestions.find(g => g.key === selectedQuestion);
                if (group) {
                    list = list.filter(item => {
                        const k = item.questionKey || item.questionNo || '';
                        return group.originalKeys.has(k);
                    });
                } else {
                    // Fallback: 如果找不到组，尝试直接匹配（兼容旧状态）
                    list = list.filter(item =>
                        (item.questionKey || item.questionNo) === selectedQuestion
                    );
                }
            }
        }

        // 2. 隐藏记录过滤
        if (!showHidden) {
            list = list.filter(item => !item.isHidden);
        }

        return list;
    }, [history, selectedQuestion, showHidden, uniqueQuestions]);

    // 虚拟滚动配置 - 启用动态高度测量
    const virtualizer = useVirtualizer({
        count: filteredHistory.length,
        getScrollElement: () => listContainerRef.current,
        estimateSize: (index) => {
            // 展开的项目预估更高
            const record = filteredHistory[index];
            if (record && expandedId === record.id && record.breakdown?.length) {
                return 64 + record.breakdown.length * 60; // 基础高度 + 每个 breakdown 项
            }
            return 64; // 默认行高
        },
        overscan: 5, // 预渲染额外行数
    });

    // 当展开状态变化时，重新测量所有项目
    useEffect(() => {
        virtualizer.measure();
    }, [expandedId]);

    // 执行清除重复操作（软删除）
    const handleCleanRepeats = () => {
        if (!selectedQuestion) return;

        // 复用 filteredHistory 的逻辑来获取目标记录，但需要忽略 isHidden 过滤
        let targetRecords: HistoryRecord[] = [];

        if (selectedQuestion === '__uncategorized__') {
            targetRecords = history.filter(item => !item.questionKey && !item.questionNo);
        } else {
            const group = uniqueQuestions.find(g => g.key === selectedQuestion);
            if (group) {
                targetRecords = history.filter(item => {
                    const k = item.questionKey || item.questionNo || '';
                    return group.originalKeys.has(k);
                });
            } else {
                // Fallback
                targetRecords = history.filter(item =>
                    (item.questionKey || item.questionNo) === selectedQuestion
                );
            }
        }

        if (targetRecords.length === 0) return;

        // 按时间戳去重（保留最新记录）
        const seen = new Map<string, HistoryRecord>();
        const toHideIds = new Set<string>();

        // 使用时间戳进行去重：相同时间戳（秒级）的记录视为重复
        for (const record of targetRecords) {
            if (record.isHidden) continue;

            // 使用秒级时间戳作为去重 key
            const key = Math.floor(record.timestamp / 1000).toString();
            const existing = seen.get(key);
            if (!existing) {
                seen.set(key, record);
            } else {
                // 保留较新的记录
                if (record.timestamp > existing.timestamp) {
                    toHideIds.add(existing.id);
                    seen.set(key, record);
                } else {
                    toHideIds.add(record.id);
                }
            }
        }

        if (toHideIds.size === 0) {
            toast.info('当前没有发现重复的记录。');
            return;
        }

        if (confirm(`发现了 ${toHideIds.size} 条重复的旧记录。是否将其清除？\n（清除后将不再显示，但导出时依然包含这些记录）`)) {
            const newHistory = history.map(item => {
                if (toHideIds.has(item.id)) {
                    return { ...item, isHidden: true };
                }
                return item;
            });
            saveHistory(newHistory);
        }
    };

    // 删除指定题目的所有记录
    const handleDeleteQuestion = async (questionKey: string) => {
        const group = uniqueQuestions.find(g => g.key === questionKey);
        if (!group) return;

        const questionLabel = group.label;
        const count = group.count;

        if (!confirm(`确定要删除"第${questionLabel}题"的所有 ${count} 条记录吗?\n\n此操作不可恢复!`)) {
            return;
        }

        // 找到所有属于该题目的记录
        let newHistory: HistoryRecord[];
        if (questionKey === '__uncategorized__') {
            newHistory = history.filter(item => item.questionKey || item.questionNo);
        } else {
            newHistory = history.filter(item => {
                const k = item.questionKey || item.questionNo || '';
                return !group.originalKeys.has(k);
            });
        }

        await saveHistory(newHistory);

        // 如果是正式版，同步删除云端记录
        if (isOfficial) {
            if (questionKey === '__uncategorized__') {
                // 未分类记录删除不支持批量（需要循环或后端支持，暂时静默）
            } else {
                deleteRecordFromServer({ questionKey });
            }
        }

        // 如果删除的是当前选中的题目,切换到第一个剩余题目
        if (selectedQuestion === questionKey) {
            const remaining = await loadHistory();
            if (remaining.length > 0) {
                const firstKey = remaining[0].questionKey || remaining[0].questionNo || '';
                setSelectedQuestion(firstKey);
            } else {
                setSelectedQuestion('');
            }
        }

        setIsDropdownOpen(false);
    };



    // 计算统计数据
    const stats = useMemo(() => {
        if (filteredHistory.length === 0) {
            return { count: 0, avgScore: 0, scoreRate: 0 };
        }
        const count = filteredHistory.length;
        const totalScore = filteredHistory.reduce((acc, curr) => acc + Number(curr.score || 0), 0);
        const totalMaxScore = filteredHistory.reduce((acc, curr) => acc + Number(curr.maxScore || 0), 0);
        const avgScore = totalScore / count;
        const scoreRate = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
        return { count, avgScore, scoreRate };
    }, [filteredHistory]);

    // 导出记录 (导出当前筛选题目的所有记录，包含已隐藏的)
    const handleExport = () => {
        // 获取当前题目的所有记录（忽略 isHidden）
        let exportList = history;
        if (selectedQuestion) {
            if (selectedQuestion === '__uncategorized__') {
                exportList = exportList.filter(item => !item.questionKey && !item.questionNo);
            } else {
                exportList = exportList.filter(item =>
                    item.questionKey === selectedQuestion || item.questionNo === selectedQuestion
                );
            }
        }

        if (exportList.length === 0) {
            toast.warning('暂无可导出的记录');
            return;
        }
        const headers = ['序号', '时间', '题目', '得分', '满分', '得分率', '状态'];
        const rows = exportList.map((h, idx) => {
            const ts = Number(h.timestamp);
            const time = Number.isFinite(ts) && ts > 0 ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '';
            const questionNo = h.questionNo || h.questionKey?.split(':').pop() || '-';
            const rate = h.maxScore > 0 ? ((h.score / h.maxScore) * 100).toFixed(1) + '%' : '-';
            const status = h.isHidden ? '已清除' : '正常';
            return [idx + 1, time, questionNo, h.score, h.maxScore, rate, status];
        });
        const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `批改记录_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // 格式化时间
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

    // 获取题目颜色
    const getQuestionColor = (questionNo: string) => {
        const num = parseInt(questionNo.replace(/\D/g, '')) || 0;
        const colors = [
            { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-600' },
            { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-600' },
            { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-600' },
            { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-600' },
        ];
        return colors[num % colors.length];
    };

    // 获取分数颜色
    const getScoreColor = (score: number, maxScore: number) => {
        if (maxScore === 0) return 'text-gray-800';
        const rate = score / maxScore;
        if (rate >= 1) return 'text-green-600';
        if (rate >= 0.8) return 'text-blue-600';
        if (rate >= 0.6) return 'text-gray-800';
        return 'text-orange-600';
    };

    // 渲染评分详情（breakdown）
    const renderBreakdown = (breakdown: { label: string; score: number; max: number; comment?: string }[]) => {
        if (!breakdown || breakdown.length === 0) return null;
        return (
            <div className="mt-3 space-y-2 pt-3 border-t border-gray-100">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">评分详情</div>
                {breakdown.map((item, idx) => {
                    const isFull = item.score === item.max;
                    const isZero = item.score === 0;
                    const percent = item.max > 0 ? (item.score / item.max) * 100 : 0;

                    const colorTheme = isFull
                        ? { bg: 'bg-green-50', border: 'border-green-100', dot: 'bg-green-500', bar: 'bg-green-500', barBg: 'bg-green-100', score: 'text-green-600', reason: 'text-green-700' }
                        : isZero
                            ? { bg: 'bg-red-50', border: 'border-red-100', dot: 'bg-red-500', bar: 'bg-red-400', barBg: 'bg-red-100', score: 'text-red-600', reason: 'text-red-700' }
                            : { bg: 'bg-orange-50', border: 'border-orange-100', dot: 'bg-orange-500', bar: 'bg-orange-400', barBg: 'bg-orange-100', score: 'text-orange-600', reason: 'text-orange-700' };

                    return (
                        <div key={idx} className={`p-2.5 rounded-lg ${colorTheme.bg} border ${colorTheme.border}`}>
                            <div className="flex justify-between items-center mb-1.5">
                                <div className="flex items-center">
                                    <div className={`w-1.5 h-1.5 rounded-full ${colorTheme.dot} mr-1.5`}></div>
                                    <span className="text-xs font-medium text-gray-700">{item.label}</span>
                                </div>
                                <div className="flex items-center">
                                    <span className={`font-mono text-xs font-bold ${colorTheme.score}`}>{item.score}</span>
                                    <span className="text-[10px] text-gray-400 ml-0.5">/{item.max}</span>
                                </div>
                            </div>
                            <div className={`h-1 w-full ${colorTheme.barBg} rounded-full overflow-hidden mb-1.5`}>
                                <div
                                    className={`h-full ${colorTheme.bar} rounded-full transition-all duration-300`}
                                    style={{ width: `${percent}%` }}
                                ></div>
                            </div>
                            {item.comment && (
                                <p className={`text-[10px] ${colorTheme.reason} leading-relaxed`}>
                                    {item.comment}
                                </p>
                            )}
                            {!item.comment && isFull && (
                                <p className={`text-[10px] ${colorTheme.reason} leading-relaxed`}>回答正确，符合评分标准。</p>
                            )}
                            {!item.comment && isZero && (
                                <p className={`text-[10px] ${colorTheme.reason} leading-relaxed`}>未作答或答案不符合标准。</p>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-500">
                <div className="flex flex-col items-center">
                    <Frown className="w-12 h-12 mb-3 text-gray-300" />
                    <p className="text-sm">暂无批改记录</p>
                    <p className="text-xs mt-1">完成批改后，记录将显示在这里</p>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
            {/* 题目选择和操作栏 */}
            <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100 shrink-0">
                <div className="flex items-center gap-2">
                    {/* 自定义题目下拉菜单 */}
                    <div ref={dropdownRef} className="relative flex-1">
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="w-full text-sm bg-white rounded-lg px-3 py-2.5 border-2 border-blue-400 text-blue-700 font-bold focus:ring-2 focus:ring-blue-200 outline-none flex items-center justify-between hover:bg-blue-50/30 transition-colors"
                        >
                            <span>
                                {uniqueQuestions.find(q => q.key === selectedQuestion)
                                    ? `第${uniqueQuestions.find(q => q.key === selectedQuestion)?.label}题 (${uniqueQuestions.find(q => q.key === selectedQuestion)?.count}份)`
                                    : '选择题目'
                                }
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-blue-300 rounded-lg shadow-xl max-h-64 overflow-y-auto z-50 animate-in slide-in-from-top-2 duration-200">
                                {uniqueQuestions.map(q => (
                                    <div
                                        key={q.key}
                                        className={`group flex items-center justify-between transition-colors ${q.key === selectedQuestion
                                            ? 'bg-blue-600 text-white font-bold'
                                            : 'text-gray-700 hover:bg-blue-50'
                                            }`}
                                    >
                                        <button
                                            onClick={() => { setSelectedQuestion(q.key); setIsDropdownOpen(false); }}
                                            className="flex-1 px-3 py-2.5 text-left text-sm flex items-center justify-between"
                                        >
                                            <span>第{q.label}题</span>
                                            <span className={`text-xs ${q.key === selectedQuestion ? 'text-blue-100' : 'text-gray-400'}`}>{q.count}份</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteQuestion(q.key);
                                            }}
                                            className={`px-2 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity ${q.key === selectedQuestion
                                                ? 'text-white hover:text-red-200'
                                                : 'text-gray-400 hover:text-red-500'
                                                }`}
                                            title="删除该题所有记录"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>

                    {/* 导出按钮 */}
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium transition-colors"
                        title="导出当前题目完整记录"
                    >
                        <Download className="w-4 h-4" />
                    </button>

                    {/* 正式会员同步按钮 */}
                    {isOfficial && (
                        <button
                            onClick={handleSync}
                            disabled={syncStatus === 'syncing'}
                            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-white font-bold text-xs transition-all shadow-sm ${syncStatus === 'syncing'
                                ? 'bg-blue-400 cursor-not-allowed animate-pulse'
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-95 border-blue-500'
                                }`}
                            title={lastSyncTime ? `上次同步: ${new Date(lastSyncTime).toLocaleString()}` : "立即同步云端记录"}
                        >
                            <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                            {syncStatus === 'syncing' ? '正在同步' : '同步'}
                        </button>
                    )}
                </div>

                {/* 同步状态展示（正式版） */}
                {isOfficial && (syncStatus !== 'idle' || lastSyncTime) && (
                    <div className="mt-2 flex items-center justify-between px-1">
                        <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'success' ? 'bg-green-500' : syncStatus === 'error' ? 'bg-red-500' : 'bg-blue-500 animate-pulse'}`}></div>
                            <span className="text-[10px] text-gray-500">
                                {syncStatus === 'syncing' ? syncMessage :
                                    syncStatus === 'success' ? '云端同步已完成' :
                                        syncStatus === 'error' ? '同步失败，请重试' : '云端同步已就绪'}
                            </span>
                        </div>
                        {lastSyncTime && syncStatus !== 'syncing' && (
                            <span className="text-[9px] text-gray-400 italic">
                                上次 {format(new Date(lastSyncTime), 'HH:mm', { locale: zhCN })}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
                        <div className="text-2xl font-black text-gray-800">{stats.count}</div>
                        <div className="text-[10px] text-gray-400">已批改</div>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
                        <div className="text-2xl font-black text-blue-600">{stats.avgScore.toFixed(1)}</div>
                        <div className="text-[10px] text-gray-400">平均分</div>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
                        <div className="text-2xl font-black text-green-600">{stats.scoreRate.toFixed(0)}%</div>
                        <div className="text-[10px] text-gray-400">得分率</div>
                    </div>
                </div>

                {/* Record List - 按题目分组显示 */}
                {selectedQuestion ? (
                    // 单题筛选模式：显示序号 #1, #2, #3...
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                        <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between bg-blue-50/50 sticky top-0 z-10">
                            <span className="text-sm font-bold text-blue-600">
                                第{selectedQuestion.replace(/\D/g, '') || '?'}题
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400">共 {filteredHistory.length} 条</span>
                            </div>
                        </div>

                        {/* 虚拟滚动列表容器 */}
                        <div
                            ref={listContainerRef}
                            className="overflow-y-auto"
                            style={{ maxHeight: 'calc(100vh - 280px)' }}
                        >
                            <div
                                style={{
                                    height: `${virtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative',
                                }}
                            >
                                {virtualizer.getVirtualItems().map((virtualRow) => {
                                    const record = filteredHistory[virtualRow.index];
                                    const idx = virtualRow.index;
                                    const isFullScore = record.score >= record.maxScore && record.maxScore > 0;
                                    const colors = isFullScore
                                        ? { bg: 'bg-green-50', text: 'text-green-600' }
                                        : { bg: 'bg-blue-50', text: 'text-blue-600' };
                                    const isExpanded = expandedId === record.id;
                                    const hasBreakdown = record.breakdown && record.breakdown.length > 0;
                                    const hasComment = !!record.comment; // 新增：检查是否有 comment
                                    const isExpandable = hasBreakdown || hasComment; // 任一存在即可展开
                                    const isSoftDeleted = !!record.isHidden;

                                    return (
                                        <div
                                            key={`${virtualRow.index}-${record.id}`}
                                            ref={virtualizer.measureElement}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                transform: `translateY(${virtualRow.start}px)`,
                                            }}
                                            data-index={virtualRow.index}
                                        >
                                            <div className={`border-b border-gray-50 ${isSoftDeleted ? 'opacity-60 grayscale bg-gray-50/50' : ''}`}>
                                                <div
                                                    onClick={() => isExpandable && setExpandedId(isExpanded ? null : record.id)}
                                                    className={`px-4 py-3 flex items-center justify-between transition-colors ${isExpandable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center ${colors.text} text-xs font-bold`}>
                                                            #{idx + 1}
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="text-[10px] text-gray-400">{formatTime(record.timestamp)}</div>
                                                            {isFullScore && (
                                                                <span className="text-[9px] text-green-500 bg-green-50 px-1 py-0.5 rounded border border-green-100">★满分</span>
                                                            )}
                                                            {record.name && <span className="text-[10px] text-gray-400">· {record.name}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`text-lg font-black ${getScoreColor(record.score, record.maxScore)}`}>
                                                            {record.score}<span className="text-xs text-gray-400">/{record.maxScore}</span>
                                                        </div>
                                                        {isExpandable && (
                                                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                        )}
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className="px-4 pb-3 animate-in slide-in-from-top-2 duration-200">
                                                        {hasBreakdown && renderBreakdown(record.breakdown!)}
                                                        {!hasBreakdown && hasComment && (
                                                            <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                                                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">评分理由</div>
                                                                <div className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                                                                    {record.comment}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    // 全部题目模式：按题目分组显示
                    <div className="space-y-3">
                        {uniqueQuestions.map(q => {
                            // 特殊处理"未分类"组
                            const questionRecords = q.key === '__uncategorized__'
                                ? history.filter(item => !item.questionKey && !item.questionNo)
                                    .sort((a, b) => b.timestamp - a.timestamp)
                                : history.filter(
                                    item => item.questionKey === q.key || item.questionNo === q.key
                                ).sort((a, b) => b.timestamp - a.timestamp);

                            if (questionRecords.length === 0) return null;

                            const isUncategorized = q.key === '__uncategorized__';
                            const colors = isUncategorized
                                ? { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' }
                                : getQuestionColor(q.label);
                            const qNum = isUncategorized ? '?' : (q.label.replace(/\D/g, '').slice(-2) || '?');
                            const avgScore = questionRecords.reduce((acc, r) => acc + r.score, 0) / questionRecords.length;
                            const avgMax = questionRecords.reduce((acc, r) => acc + r.maxScore, 0) / questionRecords.length;

                            return (
                                <div key={q.key} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                    {/* 题目组标题 */}
                                    <div className={`px-4 py-2.5 border-b border-gray-50 flex items-center justify-between ${colors.bg}/30`}>
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <span className={`text-sm font-bold ${colors.text}`}>
                                                    {isUncategorized ? '未分类' : `第${qNum}题`}
                                                </span>
                                                <span className="text-[10px] text-gray-400 ml-2">
                                                    均分 {avgScore.toFixed(1)}/{avgMax.toFixed(0)}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-gray-400">{q.count} 条</span>
                                    </div>

                                    {/* 该题的记录列表（最多显示3条） */}
                                    {questionRecords.slice(0, 3).map((record, idx) => {
                                        const isFullScore = record.score >= record.maxScore && record.maxScore > 0;
                                        const isExpanded = expandedId === record.id;
                                        const hasBreakdown = record.breakdown && record.breakdown.length > 0;

                                        return (
                                            <div key={record.id} className="border-b border-gray-50">
                                                <div
                                                    onClick={() => hasBreakdown && setExpandedId(isExpanded ? null : record.id)}
                                                    className={`px-4 py-2.5 flex items-center justify-between transition-colors ${hasBreakdown ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-gray-300 w-4">#{idx + 1}</span>
                                                        <div className="text-[10px] text-gray-400">{formatTime(record.timestamp)}</div>
                                                        {isFullScore && (
                                                            <span className="text-[9px] text-green-500 bg-green-50 px-1 py-0.5 rounded">★</span>
                                                        )}
                                                        {record.name && <span className="text-[10px] text-gray-400">· {record.name}</span>}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`text-sm font-bold ${getScoreColor(record.score, record.maxScore)}`}>
                                                            {record.score}<span className="text-xs text-gray-400">/{record.maxScore}</span>
                                                        </div>
                                                        {hasBreakdown && (
                                                            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                        )}
                                                    </div>
                                                </div>
                                                {isExpanded && record.breakdown && (
                                                    <div className="px-4 pb-3 animate-in slide-in-from-top-2 duration-200">
                                                        {renderBreakdown(record.breakdown)}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* 查看更多按钮 */}
                                    {questionRecords.length > 3 && (
                                        <button
                                            onClick={() => setSelectedQuestion(q.key)}
                                            className="w-full py-2 text-center text-[11px] text-blue-500 hover:text-blue-700 hover:bg-blue-50/50 font-medium transition-colors"
                                        >
                                            查看全部 {q.count} 条记录 →
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default HistoryView;
