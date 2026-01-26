import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement,
    Filler,
    ChartEvent,
    ActiveElement
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { 
    BarChart3, 
    PieChart as PieChartIcon, 
    TrendingUp, 
    Download, 
    CheckCircle2, 
    AlertCircle, 
    X, 
    Sparkles, 
    FileSpreadsheet, 
    FileText, 
    ChevronDown, 
    BookOpen,
    BrainCircuit,
    Award,
    ChevronRight,
    Users
} from 'lucide-react';
import { generateGradingInsight } from '../services/geminiService';
import { toast } from './Toast';

// 按需注册 Chart.js 组件以优化体积
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    PointElement,
    LineElement,
    Filler
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
    avgScore: number;
    maxScore: number;
}

const AnalysisView: React.FC = () => {
    const [insight, setInsight] = useState("正在生成 AI 分析…");
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [selectedQuestion, setSelectedQuestion] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    
    // 图表交互状态
    const [filterCategory, setFilterCategory] = useState<{name: string, color: string, min: number, max: number} | null>(null);
    const [showStudentList, setShowStudentList] = useState(false);

    const [stats, setStats] = useState<{
        avgScore: number;
        passRate: number;
        excellentRate: number;
        scoreRate: number;
        count: number;
        maxScore: number;
        distribution: { name: string; value: number; color: string; minRate: number; maxRate: number }[];
        knowledgePoints: KnowledgePoint[];
        trend: { label: string; score: number }[];
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
        return Array.from(questionMap.values())
            .filter(q => q.key !== '1')
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
            { name: '需努力', value: buckets[0], color: '#f87171', minRate: 0, maxRate: 0.6 },
            { name: '及格', value: buckets[1], color: '#fb923c', minRate: 0.6, maxRate: 0.75 },
            { name: '良好', value: buckets[2], color: '#60a5fa', minRate: 0.75, maxRate: 0.9 },
            { name: '优秀', value: buckets[3], color: '#4ade80', minRate: 0.9, maxRate: 1.01 }, // 1.01 to include 100%
        ];

        // 知识点分析
        const knowledgeMap = new Map<string, { total: number; earned: number; count: number }>();
        list.forEach(item => {
            if (item.breakdown && Array.isArray(item.breakdown)) {
                item.breakdown.forEach(bp => {
                    const name = bp.label || '其他';
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
                count: data.count,
                avgScore: data.earned / data.count,
                maxScore: data.total / data.count
            }))
            .sort((a, b) => a.scoreRate - b.scoreRate)
            .slice(0, 5); // 取前5个

        // 简单的趋势 (最近 20 条)
        const trend = list
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-20)
            .map(item => ({
                label: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                score: item.score
            }));

        setStats({
            avgScore,
            passRate,
            excellentRate,
            scoreRate,
            count,
            maxScore,
            distribution,
            knowledgePoints,
            trend
        });

        // 生成 AI 洞察
        if (count > 0) {
            // 使用 setTimeout 避免阻塞渲染
            setTimeout(async () => {
                const aiText = await generateGradingInsight(avgScore, passRate);
                setInsight(aiText);
            }, 500);
        } else {
            setInsight("暂无足够数据生成分析。");
        }
        
        setIsLoading(false);
    };

    useEffect(() => {
        calculateStats();
    }, []);

    // 筛选学生列表
    const filteredStudents = useMemo(() => {
        if (!stats || !filterCategory) return [];
        
        // 获取当前筛选范围的学生
        let list = history;
        if (selectedQuestion) {
            list = list.filter(item => {
                const qNo = item.questionNo || item.questionKey?.split(':').pop() || '';
                return qNo === selectedQuestion;
            });
        }
        
        return list.filter(s => {
            const max = s.maxScore || stats.maxScore;
            const ratio = s.score / Math.max(1, max);
            return ratio >= filterCategory.min && ratio < filterCategory.max;
        }).sort((a, b) => b.score - a.score);
    }, [history, selectedQuestion, filterCategory, stats]);


    // 导出功能
    const handleExport = (type: 'csv' | 'json') => {
        if (!stats) return;
        const list = selectedQuestion
            ? history.filter(item => {
                const qNo = item.questionNo || item.questionKey?.split(':').pop() || '';
                return qNo === selectedQuestion;
            })
            : history;

        if (!list.length) {
            toast.warning('暂无可导出的记录');
            return;
        }

        const questionLabel = selectedQuestion ? `第${selectedQuestion}题` : '全部';
        const dateStr = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
        const filename = `考情分析_${questionLabel}_${dateStr}`;

        if (type === 'csv') {
            const headers = ['时间', '题目', '得分', '满分', '得分率', '评语', '得分点明细'];
            const rows = list.map(h => {
                const time = new Date(h.timestamp).toLocaleString();
                const rate = h.maxScore > 0 ? ((h.score / h.maxScore) * 100).toFixed(1) + '%' : '-';
                const breakdownStr = h.breakdown?.map(b => `${b.label}:${b.score}/${b.max}`).join('; ') || '-';
                return [time, h.questionNo || '-', h.score, h.maxScore, rate, (h.comment || '').replace(/[\n\r]/g, ' '), breakdownStr];
            });
            const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
            downloadFile(blob, `${filename}.csv`);
        } else {
            const exportData = { version: '2.0', exportTime: new Date().toISOString(), question: questionLabel, stats, records: list };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            downloadFile(blob, `${filename}.json`);
        }
    };

    const downloadFile = (blob: Blob, name: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Chart Options
    const doughnutData = useMemo(() => ({
        labels: stats?.distribution.map(d => d.name) || [],
        datasets: [{
            data: stats?.distribution.map(d => d.value) || [],
            backgroundColor: stats?.distribution.map(d => d.color) || [],
            borderWidth: 0,
            hoverOffset: 8
        }]
    }), [stats]);

    const handleChartClick = (event: ChartEvent, elements: ActiveElement[]) => {
        if (elements.length > 0 && stats) {
            const index = elements[0].index;
            const category = stats.distribution[index];
            if (category.value > 0) {
                setFilterCategory({
                    name: category.name,
                    color: category.color,
                    min: category.minRate,
                    max: category.maxRate
                });
                setShowStudentList(true);
            }
        }
    };

    const barData = useMemo(() => ({
        labels: stats?.knowledgePoints.map(k => k.name.length > 6 ? k.name.substring(0, 5) + '...' : k.name) || [],
        datasets: [{
            label: '得分率',
            data: stats?.knowledgePoints.map(k => k.scoreRate * 100) || [],
            backgroundColor: (ctx: any) => {
                const val = ctx.raw as number;
                if (val < 60) return '#f87171'; // red
                if (val < 80) return '#fb923c'; // orange
                return '#60a5fa'; // blue
            },
            borderRadius: 8,
            barThickness: 16,
        }]
    }), [stats]);

    const lineData = useMemo(() => ({
        labels: stats?.trend.map(t => t.label) || [],
        datasets: [{
            label: '得分趋势',
            data: stats?.trend.map(t => t.score) || [],
            borderColor: '#6366f1', // indigo
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 2,
            pointHoverRadius: 4
        }]
    }), [stats]);

    if (!stats && !isLoading) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500">
                <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <PieChartIcon className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">暂无数据分析</h3>
                <p className="text-xs mt-2 text-gray-400">请先进行阅卷以生成分析报告</p>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
            {/* Header / Filter Bar */}
            <div className="px-5 py-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between shrink-0 z-10 sticky top-0">
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar mask-right pr-4">
                    <button
                        onClick={() => { setSelectedQuestion(''); calculateStats(''); }}
                        className={`shrink-0 px-4 py-1.5 text-xs font-bold rounded-full transition-all shadow-sm ${selectedQuestion === ''
                            ? 'bg-slate-800 text-white shadow-slate-300 dark:shadow-none'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                        }`}
                    >
                        全部题目
                    </button>
                    {uniqueQuestions.slice(0, 8).map(q => (
                        <button
                            key={q.key}
                            onClick={() => { setSelectedQuestion(q.key); calculateStats(q.key); }}
                            className={`shrink-0 px-4 py-1.5 text-xs font-bold rounded-full transition-all shadow-sm ${selectedQuestion === q.key
                                ? 'bg-indigo-600 text-white shadow-indigo-200'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                            }`}
                        >
                            第{q.key}题
                        </button>
                    ))}
                </div>
                <ExportDropdown onExportCSV={() => handleExport('csv')} onExportJSON={() => handleExport('json')} />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4">
                        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-xs font-medium text-indigo-500 animate-pulse">正在分析数据...</p>
                    </div>
                ) : stats && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        {/* 1. Overview Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard 
                                label="平均分" 
                                value={stats.avgScore.toFixed(1)} 
                                subValue={`/ ${stats.maxScore}`} 
                                icon={TrendingUp} 
                                color="indigo"
                            />
                            <StatCard 
                                label="及格率" 
                                value={`${stats.passRate.toFixed(0)}%`} 
                                icon={CheckCircle2} 
                                color={stats.passRate >= 60 ? 'emerald' : 'orange'}
                            />
                             <StatCard 
                                label="优秀率" 
                                value={`${stats.excellentRate.toFixed(0)}%`} 
                                icon={Award} 
                                color={stats.excellentRate >= 20 ? 'violet' : 'slate'}
                            />
                            <StatCard 
                                label="已阅卷" 
                                value={stats.count.toString()} 
                                icon={FileText} 
                                color="blue"
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* 2. Score Distribution (Doughnut) */}
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        <PieChartIcon className="w-4 h-4 text-indigo-500" />
                                        成绩分布
                                    </h3>
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">点击图表查看详情</span>
                                </div>
                                <div className="h-48 relative flex items-center justify-center">
                                    <Doughnut 
                                        data={doughnutData} 
                                        options={{
                                            cutout: '70%',
                                            onClick: handleChartClick,
                                            plugins: { 
                                                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } },
                                                tooltip: {
                                                    callbacks: {
                                                        label: (ctx) => ` ${ctx.formattedValue}人 (${Math.round((ctx.raw as number / stats.count) * 100)}%)`
                                                    }
                                                }
                                            }
                                        }} 
                                    />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-xs text-slate-400 font-medium">总人数</span>
                                        <span className="text-2xl font-black text-slate-800 dark:text-white">{stats.count}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Knowledge Points (Bar) */}
                            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-blue-500" />
                                        薄弱知识点分析
                                    </h3>
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-bold">得分率后5名</span>
                                </div>
                                <div className="space-y-3">
                                    {stats.knowledgePoints.map((kp, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-700 dark:text-slate-300 font-medium truncate w-32">{kp.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-400 text-[10px]">{kp.avgScore.toFixed(1)}/{kp.maxScore.toFixed(0)}分</span>
                                                    <span className={`font-bold w-8 text-right ${
                                                        kp.scoreRate < 0.6 ? 'text-red-500' : 
                                                        kp.scoreRate < 0.8 ? 'text-orange-500' : 'text-blue-500'
                                                    }`}>
                                                        {(kp.scoreRate * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                                        kp.scoreRate < 0.6 ? 'bg-red-400' : 
                                                        kp.scoreRate < 0.8 ? 'bg-orange-400' : 'bg-blue-400'
                                                    }`}
                                                    style={{ width: `${kp.scoreRate * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 4. Trend Chart (Line) - Only show if enough data */}
                        {stats.trend.length > 5 && (
                             <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                                        批改趋势
                                    </h3>
                                </div>
                                <div className="h-40 w-full">
                                    <Line 
                                        data={lineData} 
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                            scales: {
                                                x: { grid: { display: false }, ticks: { display: false } },
                                                y: { beginAtZero: true, grid: { color: '#f1f5f9' } }
                                            }
                                        }} 
                                    />
                                </div>
                             </div>
                        )}

                         {/* 5. AI Insight (Moved to Bottom) */}
                         <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/20 group">
                            <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-700">
                                <BrainCircuit className="w-32 h-32" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
                                    AI 教学建议
                                </h3>
                                <div className="text-sm text-indigo-50 leading-relaxed font-medium whitespace-pre-wrap opacity-90">
                                    {insight}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Student List Modal (Drawer) */}
            {showStudentList && filterCategory && (
                <div className="absolute inset-0 z-50 flex flex-col bg-white dark:bg-slate-900 animate-in slide-in-from-bottom duration-300">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setShowStudentList(false)}
                                className="p-2 -ml-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                            >
                                <ChevronDown className="w-5 h-5 text-slate-500" />
                            </button>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: filterCategory.color }}></span>
                                    {filterCategory.name}名单
                                </h3>
                                <p className="text-xs text-slate-500">共 {filteredStudents.length} 人</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setShowStudentList(false)}
                            className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg"
                        >
                            关闭
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2">
                        {filteredStudents.length > 0 ? (
                            <div className="space-y-2">
                                {filteredStudents.map((student, idx) => (
                                    <div key={student.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 dark:text-white text-sm">
                                                    {student.name || '考生'}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {new Date(student.timestamp).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-black text-lg text-slate-800 dark:text-white">
                                                {student.score}
                                                <span className="text-xs text-slate-400 font-normal">/{student.maxScore}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                                <Users className="w-8 h-8 mb-2 opacity-50" />
                                <p className="text-xs">该区间暂无学生</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Components

const StatCard = ({ label, value, subValue, icon: Icon, color = 'blue' }: any) => {
    const colorMap: any = {
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        violet: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
        slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between h-28 group hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                <div className={`p-1.5 rounded-lg ${colorMap[color]} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{value}</span>
                {subValue && <span className="text-xs text-slate-400 font-bold">{subValue}</span>}
            </div>
        </div>
    );
};

const ExportDropdown = ({ onExportCSV, onExportJSON }: { onExportCSV: () => void; onExportJSON: () => void; }) => {
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
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
                <Download className="w-3.5 h-3.5" />
                <span>导出数据</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <button
                        onClick={() => { onExportCSV(); setIsOpen(false); }}
                        className="w-full px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                        导出 CSV 表格
                    </button>
                    <div className="h-[1px] bg-slate-100 dark:bg-slate-700 mx-2"></div>
                    <button
                        onClick={() => { onExportJSON(); setIsOpen(false); }}
                        className="w-full px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                        导出 JSON 数据
                    </button>
                </div>
            )}
        </div>
    );
};

export default AnalysisView;
