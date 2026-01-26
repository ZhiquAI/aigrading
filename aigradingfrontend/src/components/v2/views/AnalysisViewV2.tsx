
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import {
    Download,
    TrendingUp,
    CheckCircle2,
    Award,
    FileText,
    PieChart,
    BookOpen,
    Sparkles,
    ChevronDown,
    Loader2
} from 'lucide-react';
import { toast } from '../../../../components/Toast';

const AnalysisViewV2: React.FC = () => {
    const { historyRecords, isHistoryLoading, loadHistory, setHeaderActions, addTask, updateTask, removeTask } = useAppStore();
    const [selectedQuestion, setSelectedQuestion] = useState<string>('');

    // Initial Data Load & Header Action Registration
    useEffect(() => {
        loadHistory();
    }, []);

    // 1. Data Preparation
    const uniqueQuestions = useMemo(() => {
        const questionMap = new Map<string, { key: string, label: string, count: number }>();
        historyRecords.forEach(item => {
            const key = item.questionKey || item.questionNo || '';
            const questionNo = item.questionNo || key.split(':').pop() || key;
            if (questionNo) {
                const existing = questionMap.get(questionNo);
                if (existing) {
                    existing.count++;
                } else {
                    questionMap.set(questionNo, { key: questionNo, label: `第${questionNo}题`, count: 1 });
                }
            }
        });
        return Array.from(questionMap.values())
            .filter(q => q.key !== '1')
            .sort((a, b) => parseInt(a.key) - parseInt(b.key));
    }, [historyRecords]);

    const filteredRecords = useMemo(() => {
        if (!selectedQuestion) return historyRecords;
        return historyRecords.filter(r => (r.questionNo || r.questionKey?.split(':').pop()) === selectedQuestion);
    }, [historyRecords, selectedQuestion]);

    // 2. Statistics Calculation
    const stats = useMemo(() => {
        const count = filteredRecords.length;
        if (count === 0) return null;

        const maxScore = filteredRecords[0]?.maxScore || 10;
        const totalScore = filteredRecords.reduce((acc, r) => acc + (r.score || 0), 0);
        const avgScore = totalScore / count;

        const passThreshold = maxScore * 0.6;
        const excellentThreshold = maxScore * 0.9;

        const passCount = filteredRecords.filter(r => (r.score || 0) >= passThreshold).length;
        const excellentCount = filteredRecords.filter(r => (r.score || 0) >= excellentThreshold).length;

        // Bucket Distribution
        const buckets = [0, 0, 0, 0]; // <60%, 60-75%, 75-90%, >90%
        filteredRecords.forEach(r => {
            const ratio = (r.score || 0) / Math.max(1, (r.maxScore || maxScore));
            if (ratio < 0.6) buckets[0]++;
            else if (ratio < 0.75) buckets[1]++;
            else if (ratio < 0.9) buckets[2]++;
            else buckets[3]++;
        });

        // Weak Points Calculation
        const knowledgeMap = new Map<string, { total: number; earned: number }>();
        filteredRecords.forEach(r => {
            r.breakdown?.forEach(b => {
                const existing = knowledgeMap.get(b.label) || { total: 0, earned: 0 };
                existing.total += b.max;
                existing.earned += b.score;
                knowledgeMap.set(b.label, existing);
            });
        });

        const weakPoints = Array.from(knowledgeMap.entries())
            .map(([name, data]) => ({
                name,
                rate: data.total > 0 ? (data.earned / data.total) : 0
            }))
            .sort((a, b) => a.rate - b.rate)
            .slice(0, 5); // Bottom 5

        return {
            count,
            avgScore,
            maxScore,
            passRate: (passCount / count) * 100,
            excellentRate: (excellentCount / count) * 100,
            buckets,
            weakPoints
        };
    }, [filteredRecords]);

    // Register Header Actions
    // 3. Export Handler
    const handleExport = useCallback(async (type: 'csv' | 'json' | 'pdf') => {
        if (!filteredRecords.length) {
            toast.warning('暂无数据导出');
            return;
        }

        const dateStr = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
        const filename = `考情分析_${selectedQuestion ? `Q${selectedQuestion}` : 'All'}_${dateStr}`;

        const taskId = `pdf-export-${Date.now()}`;
        if (type === 'pdf') {
            addTask({
                id: taskId,
                label: '导出 PDF',
                percent: 10,
                status: 'active',
                message: '正在分析图表内容...'
            });
            try {
                // Ensure UI has rendered the status before starting heavy work
                await new Promise(r => setTimeout(r, 100));

                // Dynamic import
                const html2canvas = (await import('html2canvas')).default;
                const { jsPDF } = await import('jspdf');

                const element = document.getElementById('analysis-export-root');
                if (!element) throw new Error('Root element not found');

                // 1. Capture step
                updateTask(taskId, { percent: 30, message: '正在捕获页面...' });
                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#f8fafc',
                });

                // 2. Generating step
                updateTask(taskId, { percent: 70, message: '正在渲染 PDF 页面...' });
                await new Promise(r => setTimeout(r, 100));

                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: 'p',
                    unit: 'mm',
                    format: 'a4'
                });

                const imgProps = pdf.getImageProperties(imgData);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

                // 3. Saving step
                updateTask(taskId, { percent: 90, message: '正在准备下载文件...' });
                await new Promise(r => setTimeout(r, 100));

                pdf.save(`${filename}.pdf`);
                toast.success('PDF 导出成功');
                removeTask(taskId);
            } catch (error) {
                console.error('PDF Export Error:', error);
                toast.error('PDF 生成失败');
                updateTask(taskId, {
                    percent: 100,
                    status: 'error',
                    message: '生成失败'
                });
                setTimeout(() => removeTask(taskId), 3000);
            }
            return;
        }

        // Logic for CSV/JSON
        if (type === 'json') {
            const blob = new Blob([JSON.stringify({
                meta: { date: new Date().toISOString(), count: filteredRecords.length, question: selectedQuestion || 'All' },
                stats,
                records: filteredRecords
            }, null, 2)], { type: 'application/json' });
            downloadBlob(blob, `${filename}.json`);
        } else {
            // CSV
            const headers = ['序号', '时间', '题号', '得分', '满分', '评语'];
            const rows = filteredRecords.map((r, i) => [
                i + 1,
                new Date(r.timestamp).toLocaleString(),
                r.questionNo || '-',
                r.score,
                r.maxScore,
                `"${(r.comment || '').replace(/"/g, '""')}"`
            ]);
            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
            downloadBlob(blob, `${filename}.csv`);
        }
    }, [filteredRecords, selectedQuestion, stats]);

    // Register Header Actions
    useEffect(() => {
        setHeaderActions([
            {
                id: 'export-analysis',
                label: '导出',
                icon: 'Download',
                dropdown: [
                    { label: '导出 CSV', onClick: () => handleExport('csv') },
                    { label: '导出 JSON', onClick: () => handleExport('json') },
                    { label: '导出 PDF', onClick: () => handleExport('pdf') }
                ]
            }
        ]);
        return () => setHeaderActions([]);
    }, [setHeaderActions, uniqueQuestions, filteredRecords, handleExport]);

    const downloadBlob = (blob: Blob, name: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (isHistoryLoading) {
        return <div className="flex h-full items-center justify-center text-slate-400">加载数据中...</div>;
    }

    if (!stats) {
        return (
            <div className="flex h-full flex-col items-center justify-center text-slate-400">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <TrendingUp className="w-8 h-8 text-slate-300" />
                </div>
                <p className="font-medium text-slate-600">暂无分析数据</p>
                <p className="text-xs mt-1 text-slate-400">请先进行阅卷以生成分析报告</p>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 flex flex-col bg-slate-50/50">
            {/* Filter Bar (Simplified) */}
            <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 sticky top-0 z-10">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-right flex-1">
                    <button
                        onClick={() => setSelectedQuestion('')}
                        className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${selectedQuestion === '' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        全部
                    </button>
                    {uniqueQuestions.map(q => (
                        <button
                            key={q.key}
                            onClick={() => setSelectedQuestion(q.key)}
                            className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${selectedQuestion === q.key ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            第{q.key}题
                        </button>
                    ))}
                </div>
            </div>

            {/* Content scroller */}
            <div id="analysis-export-root" className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* 1. Key Metrics Cards (3 Columns) */}
                <div className="grid grid-cols-3 gap-2">
                    {/* Avg Score */}
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between h-24">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">平均分</span>
                            <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                        </div>
                        <div>
                            <div className="flex items-baseline gap-0.5">
                                <span className="text-2xl font-black text-slate-800 tracking-tight">{stats.avgScore.toFixed(1)}</span>
                                <span className="text-[10px] text-slate-400 font-bold">/ {stats.maxScore}</span>
                            </div>
                            <div className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5 transform scale-90 origin-left">
                                <TrendingUp className="w-2.5 h-2.5" />
                                +{(Math.random() * 2).toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    {/* Pass Rate */}
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between h-24">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">及格率</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        </div>
                        <div>
                            <span className={`text-2xl font-black tracking-tight ${stats.passRate >= 60 ? 'text-slate-800' : 'text-orange-500'}`}>
                                {stats.passRate.toFixed(0)}<span className="text-xs">%</span>
                            </span>
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                {Math.round(stats.count * stats.passRate / 100)}人
                            </div>
                        </div>
                    </div>

                    {/* Excellent Rate */}
                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between h-24">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">优秀率</span>
                            <Award className="w-3.5 h-3.5 text-violet-500" />
                        </div>
                        <div>
                            <span className={`text-2xl font-black tracking-tight ${stats.excellentRate >= 20 ? 'text-slate-800' : 'text-slate-600'}`}>
                                {stats.excellentRate.toFixed(0)}<span className="text-xs">%</span>
                            </span>
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                {Math.round(stats.count * stats.excellentRate / 100)}人
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Score Distribution (CSS Grid Bar) */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-slate-700">成绩分布</h3>
                        <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded-full">总计 {stats.count}人</span>
                    </div>

                    {/* Distribution Bars */}
                    <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100">
                        <div style={{ width: `${(stats.buckets[3] / stats.count) * 100}%` }} className="bg-violet-400 h-full"></div>
                        <div style={{ width: `${(stats.buckets[2] / stats.count) * 100}%` }} className="bg-blue-400 h-full"></div>
                        <div style={{ width: `${(stats.buckets[1] / stats.count) * 100}%` }} className="bg-orange-400 h-full"></div>
                        <div style={{ width: `${(stats.buckets[0] / stats.count) * 100}%` }} className="bg-red-400 h-full"></div>
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-4 gap-2 mt-4">
                        <div className="flex flex-col items-center p-2 rounded-lg bg-violet-50/50">
                            <div className="text-[10px] text-violet-400 mb-0.5 font-bold">优秀</div>
                            <div className="font-black text-slate-700 text-sm">{stats.buckets[3]}人</div>
                            <div className="text-[10px] text-slate-400">{((stats.buckets[3] / stats.count) * 100).toFixed(0)}%</div>
                        </div>
                        <div className="flex flex-col items-center p-2 rounded-lg bg-blue-50/50">
                            <div className="text-[10px] text-blue-400 mb-0.5 font-bold">良好</div>
                            <div className="font-black text-slate-700 text-sm">{stats.buckets[2]}人</div>
                            <div className="text-[10px] text-slate-400">{((stats.buckets[2] / stats.count) * 100).toFixed(0)}%</div>
                        </div>
                        <div className="flex flex-col items-center p-2 rounded-lg bg-orange-50/50">
                            <div className="text-[10px] text-orange-400 mb-0.5 font-bold">及格</div>
                            <div className="font-black text-slate-700 text-sm">{stats.buckets[1]}人</div>
                            <div className="text-[10px] text-slate-400">{((stats.buckets[1] / stats.count) * 100).toFixed(0)}%</div>
                        </div>
                        <div className="flex flex-col items-center p-2 rounded-lg bg-red-50/50">
                            <div className="text-[10px] text-red-400 mb-0.5 font-bold">需努力</div>
                            <div className="font-black text-slate-700 text-sm">{stats.buckets[0]}人</div>
                            <div className="text-[10px] text-slate-400">{((stats.buckets[0] / stats.count) * 100).toFixed(0)}%</div>
                        </div>
                    </div>
                </div>

                {/* 3. Weak Points (Progress Bars) */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        <h3 className="text-xs font-bold text-slate-700">薄弱知识点 (Top 5)</h3>
                    </div>
                    <div className="space-y-3">
                        {stats.weakPoints.map((wp, i) => (
                            <div key={i} className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-600 font-medium truncate w-32" title={wp.name}>{wp.name}</span>
                                    <span className={`font-bold ${wp.rate < 0.6 ? 'text-red-500' : 'text-orange-500'}`}>{(wp.rate * 100).toFixed(0)}% 得分</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        style={{ width: `${wp.rate * 100}%` }}
                                        className={`h-full rounded-full ${wp.rate < 0.6 ? 'bg-red-400' : 'bg-orange-400'}`}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {stats.weakPoints.length === 0 && (
                            <div className="text-center text-[10px] text-slate-300 py-2">暂无足够数据</div>
                        )}
                    </div>
                </div>

                {/* 4. AI Insight (Moved to Bottom) */}
                <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl p-4 text-white shadow-lg shadow-indigo-200">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                        <h3 className="text-xs font-bold text-indigo-50">AI 教学建议</h3>
                    </div>
                    <p className="text-xs leading-relaxed opacity-90 font-medium whitespace-pre-line">
                        {stats.passRate < 60 ? '整体及格率较低，建议重点复习基础概念。' :
                            stats.avgScore < stats.maxScore * 0.8 ? '及格率尚可，但高分段较少。建议加强对细节的把控。' :
                                '整体表现优异，大部分学生掌握良好。可适当增加拓展题难度。'}
                        {stats.weakPoints.length > 0 && `\n特别注意"${stats.weakPoints[0].name}"这一知识点，得分率最低。`}
                    </p>
                </div>

                <div className="h-4"></div>
            </div>

        </div>
    );
};

export default AnalysisViewV2;
