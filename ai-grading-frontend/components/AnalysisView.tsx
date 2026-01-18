import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Download, CheckCircle2, AlertCircle, X, Sparkles, FileSpreadsheet, FileText, ChevronDown, BookOpen } from 'lucide-react';
import { generateGradingInsight } from '../services/geminiService';
import { toast } from './Toast';

// 注册 Chart.js 组件
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);



interface HistoryRecord {
    id: string;
    questionNo?: string;
    questionKey?: string;
    name?: string;
    score: number;
    maxScore: number;
    timestamp: number;
    breakdown?: { label: string; score: number; max: number; comment?: string }[];
    platform?: string;
    comment?: string;
}

interface QuestionOption {
    key: string;
    label: string;
    count: number;
}

interface KnowledgePoint {
    name: string;
    scoreRate: number;
    count: number;
}

const AnalysisView: React.FC = () => {
    const [insight, setInsight] = useState("正在生成 AI 分析...");
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [selectedQuestion, setSelectedQuestion] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<{
        avgScore: number;
        passRate: number;
        excellentRate: number;
        scoreRate: number;
        count: number;
        maxScore: number;
        distribution: { name: string; value: number; color: string }[];
        knowledgePoints: KnowledgePoint[];
    } | null>(null);

    // 加载历史记录
    const loadHistory = async (): Promise<HistoryRecord[]> => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                const wrap = await chrome.storage.local.get(['grading_history']);
                return Array.isArray(wrap?.grading_history) ? wrap.grading_history : [];
            }
            const saved = localStorage.getItem('grading_history');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    };

    // 提取唯一的题目列表
    const uniqueQuestions = useMemo((): QuestionOption[] => {
        const questionMap = new Map<string, QuestionOption>();
        history.forEach(item => {
            const key = item.questionKey || item.questionNo || '';
            if (key) {
                const questionNo = item.questionNo || key.split(':').pop() || key;
                const existing = questionMap.get(questionNo);
                if (existing) {
                    existing.count++;
                } else {
                    questionMap.set(questionNo, {
                        key: questionNo,
                        label: `第${questionNo}题`,
                        count: 1
                    });
                }
            }
        });
        // 按题号数字排序，并过滤掉第1题
        return Array.from(questionMap.values())
            .filter(q => q.key !== '1') // 排除第1题
            .sort((a, b) => {
                const numA = parseInt(a.key);
                const numB = parseInt(b.key);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.key.localeCompare(b.key);
            });
    }, [history]);

    // 计算统计数据
    const calculateStats = async (questionFilter?: string) => {
        setIsLoading(true);
        const allList = await loadHistory();
        setHistory(allList);

        // 根据题目筛选
        let list = allList;
        if (questionFilter) {
            list = allList.filter(item => {
                const qNo = item.questionNo || item.questionKey?.split(':').pop() || '';
                return qNo === questionFilter;
            });
        }

        if (!Array.isArray(list) || list.length === 0) {
            setStats(null);
            setInsight("暂无数据，请先进行阅卷。");
            setIsLoading(false);
            return;
        }

        const count = list.length;
        const totalScore = list.reduce((acc, curr) => acc + Number(curr.score || 0), 0);
        const avgScore = totalScore / count;
        const maxScore = Number(list[0]?.maxScore || 10);

        // 计算各项比率
        const passThreshold = maxScore * 0.6;
        const excellentThreshold = maxScore * 0.9;
        const passCount = list.filter(s => Number(s.score || 0) >= passThreshold).length;
        const excellentCount = list.filter(s => Number(s.score || 0) >= excellentThreshold).length;
        const passRate = (passCount / count) * 100;
        const excellentRate = (excellentCount / count) * 100;
        const scoreRate = avgScore / maxScore;

        // 成绩分布
        const buckets = [0, 0, 0, 0];
        list.forEach(s => {
            const ratio = Number(s.score || 0) / Math.max(1, Number(s.maxScore || maxScore));
            if (ratio < 0.6) buckets[0]++;
            else if (ratio < 0.75) buckets[1]++;
            else if (ratio < 0.9) buckets[2]++;
            else buckets[3]++;
        });

        const distribution = [
            { name: '待加油', value: buckets[0], color: '#ef4444' },
            { name: '及格', value: buckets[1], color: '#f97316' },
            { name: '良好', value: buckets[2], color: '#3b82f6' },
            { name: '优秀', value: buckets[3], color: '#22c55e' },
        ];

        // 知识点分析（从 breakdown 提取）
        const knowledgeMap = new Map<string, { total: number; earned: number; count: number }>();
        list.forEach(item => {
            if (item.breakdown && Array.isArray(item.breakdown)) {
                item.breakdown.forEach(bp => {
                    const name = bp.label || '未知知识点';
                    const existing = knowledgeMap.get(name);
                    const earned = Number(bp.score || 0);
                    const total = Number(bp.max || 0);
                    if (existing) {
                        existing.total += total;
                        existing.earned += earned;
                        existing.count++;
                    } else {
                        knowledgeMap.set(name, { total, earned, count: 1 });
                    }
                });
            }
        });

        const knowledgePoints: KnowledgePoint[] = Array.from(knowledgeMap.entries())
            .map(([name, data]) => ({
                name,
                scoreRate: data.total > 0 ? (data.earned / data.total) : 0,
                count: data.count
            }))
            .sort((a, b) => a.scoreRate - b.scoreRate) // 低分在前，便于发现问题
            .slice(0, 5); // 只显示前5个

        setStats({
            avgScore,
            passRate,
            excellentRate,
            scoreRate,
            count,
            maxScore,
            distribution,
            knowledgePoints
        });

        // 生成 AI 洞察
        const aiText = await generateGradingInsight(avgScore, passRate);
        setInsight(aiText);
        setIsLoading(false);
    };

    useEffect(() => {
        calculateStats();
    }, []);

    // 导出 CSV
    const exportCSV = async () => {
        const allList = await loadHistory();
        const list = selectedQuestion
            ? allList.filter((item: HistoryRecord) => {
                const qNo = item.questionNo || item.questionKey?.split(':').pop() || '';
                return qNo === selectedQuestion;
            })
            : allList;

        if (!list.length) {
            toast.warning('暂无可导出的记录');
            return;
        }

        const headers = ['时间', '题目', '得分', '满分', '得分率', '评语', '得分点明细'];
        const rows = list.map((h: HistoryRecord) => {
            const ts = Number(h.timestamp);
            const time = Number.isFinite(ts) && ts > 0 ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '';
            const score = Number(h.score || 0);
            const maxScore = Number(h.maxScore || 0);
            const rate = maxScore > 0 ? ((score / maxScore) * 100).toFixed(1) + '%' : '-';

            let breakdownStr = '-';
            if (h.breakdown && Array.isArray(h.breakdown)) {
                breakdownStr = h.breakdown.map(b => `${b.label}:${b.score}/${b.max}`).join('; ');
            }

            return [
                time,
                h.questionNo || h.questionKey?.split(':').pop() || '-',
                score,
                maxScore,
                rate,
                (h.comment || '').replace(/[\n\r,]/g, ' '),
                breakdownStr
            ];
        });

        const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const questionLabel = selectedQuestion ? `第${selectedQuestion}题` : '全部';
        a.download = `考情分析_${questionLabel}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // 导出 JSON
    const exportJSON = async () => {
        const allList = await loadHistory();
        const list = selectedQuestion
            ? allList.filter((item: HistoryRecord) => {
                const qNo = item.questionNo || item.questionKey?.split(':').pop() || '';
                return qNo === selectedQuestion;
            })
            : allList;

        if (!list.length) {
            toast.warning('暂无可导出的记录');
            return;
        }

        const questionLabel = selectedQuestion ? `第${selectedQuestion}题` : '全部';
        const exportData = {
            version: '2.0',
            exportTime: new Date().toISOString(),
            question: questionLabel,
            stats: stats,
            records: list
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `考情分析_${questionLabel}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Chart.js 配置
    const chartData = useMemo(() => {
        if (!stats) return null;
        return {
            labels: stats.distribution.map(d => d.name),
            datasets: [{
                label: '人数',
                data: stats.distribution.map(d => d.value),
                backgroundColor: stats.distribution.map(d => d.color),
                borderRadius: 6,
                barThickness: 40
            }]
        };
    }, [stats]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context: { parsed: { y: number } }) => `${context.parsed.y} 人`
                }
            }
        },
        scales: {
            y: { display: false, beginAtZero: true },
            x: {
                grid: { display: false },
                ticks: { font: { size: 11 } }
            }
        }
    };

    // 获取得分率颜色
    const getScoreRateColor = (rate: number) => {
        if (rate >= 0.85) return 'bg-green-500';
        if (rate >= 0.7) return 'bg-blue-500';
        if (rate >= 0.6) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const getScoreRateTextColor = (rate: number) => {
        if (rate >= 0.85) return 'text-green-600';
        if (rate >= 0.7) return 'text-blue-600';
        if (rate >= 0.6) return 'text-orange-600';
        return 'text-red-600';
    };

    // 空状态
    if (!stats && !isLoading) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-500">
                <div className="flex flex-col items-center">
                    <PieChartIcon className="w-16 h-16 text-gray-200 mb-4" strokeWidth={1.5} />
                    <p className="text-sm font-medium">暂无阅卷数据</p>
                    <p className="text-xs mt-1 text-gray-400">请先在「智能批改」页面进行阅卷</p>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
            {/* 筛选栏 */}
            <div className="px-4 py-2.5 bg-white border-b border-gray-100 flex items-center gap-3 shrink-0">
                {/* 题目切换 - 横向滚动 */}
                <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => {
                            setSelectedQuestion('');
                            calculateStats('');
                        }}
                        className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${selectedQuestion === ''
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        全部
                    </button>
                    {uniqueQuestions.slice(0, 6).map(q => (
                        <button
                            key={q.key}
                            onClick={() => {
                                setSelectedQuestion(q.key);
                                calculateStats(q.key);
                            }}
                            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${selectedQuestion === q.key
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            第{q.key}题
                        </button>
                    ))}
                </div>

                {/* 导出按钮 */}
                <ExportDropdown onExportCSV={exportCSV} onExportJSON={exportJSON} />
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : stats && (
                    <>
                        {/* 题目标题 */}
                        <div className="bg-gray-100 rounded-xl p-4">
                            <h2 className="text-lg font-bold text-gray-800">
                                {selectedQuestion ? `第${selectedQuestion}题 深度分析` : '整体考情分析'}
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">
                                共批改 {stats.count} 份答卷 · 满分 {stats.maxScore} 分
                            </p>
                        </div>

                        {/* 核心指标 */}
                        <div className="grid grid-cols-4 gap-2">
                            <MetricCard label="平均分" value={stats.avgScore.toFixed(1)} color="text-gray-800" />
                            <MetricCard
                                label="及格率"
                                value={`${stats.passRate.toFixed(0)}%`}
                                color={stats.passRate >= 60 ? "text-green-600" : "text-red-600"}
                            />
                            <MetricCard
                                label="优秀率"
                                value={`${stats.excellentRate.toFixed(0)}%`}
                                color={stats.excellentRate >= 20 ? "text-emerald-600" : "text-orange-600"}
                            />
                            <MetricCard
                                label="得分率"
                                value={stats.scoreRate.toFixed(2)}
                                color="text-blue-600"
                            />
                        </div>

                        {/* 知识点分析 */}
                        {stats.knowledgePoints.length > 0 && (
                            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-blue-600" />
                                    知识点分析
                                </h3>
                                <div className="space-y-3">
                                    {stats.knowledgePoints.map((kp, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-gray-700 truncate max-w-[180px]">{kp.name}</span>
                                                <span className={`font-medium ${getScoreRateTextColor(kp.scoreRate)}`}>
                                                    {(kp.scoreRate * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${getScoreRateColor(kp.scoreRate)} rounded-full transition-all duration-500`}
                                                    style={{ width: `${kp.scoreRate * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 成绩分布图 */}
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-800 mb-3">📊 成绩分布</h3>
                            <div style={{ height: '160px' }}>
                                {chartData && <Bar data={chartData} options={chartOptions} />}
                            </div>
                        </div>

                        {/* AI 教学建议 */}
                        <div className="bg-white rounded-xl p-4 border-l-4 border-emerald-500 shadow-sm">
                            <h3 className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                AI 教学建议
                            </h3>
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                                {insight}
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// 导出下拉菜单组件
const ExportDropdown = ({ onExportCSV, onExportJSON }: {
    onExportCSV: () => void;
    onExportJSON: () => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
                <Download className="w-3.5 h-3.5" />
                导出
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                    <button
                        onClick={() => { onExportCSV(); setIsOpen(false); }}
                        className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        导出 CSV
                    </button>
                    <button
                        onClick={() => { onExportJSON(); setIsOpen(false); }}
                        className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        导出 JSON
                    </button>
                </div>
            )}
        </div>
    );
};

// 指标卡片组件
const MetricCard = ({ label, value, color }: { label: string; value: string; color: string }) => (
    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
        <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
        <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
);

export default AnalysisView;
