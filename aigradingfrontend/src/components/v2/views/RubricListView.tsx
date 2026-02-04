import React, { useState, useMemo, useRef } from 'react';
import {
    Search, Folder, FileText, Download, Upload, Plus,
    ChevronRight, Zap
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/components/Toast';

interface RubricListViewProps {
    onCreateNew: () => void;
    onSelectRubric: (questionKey: string) => void;
}

interface GroupedRubric {
    examId: string | null;
    examName: string;
    rubrics: Array<{
        id: string;
        questionNo: string;
        alias: string;
        subject?: string;
        pointCount: number;
        totalScore: number;
        keywords: string[];
    }>;
}

export default function RubricListView({ onCreateNew, onSelectRubric }: RubricListViewProps) {
    const { exams, rubricLibrary, rubricData, setRubricConfig, saveRubric } = useAppStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedExams, setExpandedExams] = useState<Set<string>>(new Set(['all']));
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 导入 JSON 文件
    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);

                // 验证 JSON 格式
                if (!json.answerPoints || !Array.isArray(json.answerPoints)) {
                    toast.error('JSON 格式错误：缺少 answerPoints 数组');
                    return;
                }

                // 构建细则配置
                const questionNo = json.questionNo || `Q${Date.now().toString().slice(-4)}`;
                const questionKey = `imported:${questionNo}-${Date.now()}`;

                const rubricConfig = {
                    questionNo,
                    alias: json.title || `第${questionNo}题`,
                    subject: json.subject || '历史',
                    type: 'short_answer' as const,
                    anchorKeywords: json.answerPoints.flatMap((p: any) => p.keywords || []).slice(0, 5),
                    points: json.answerPoints.map((p: any, idx: number) => ({
                        id: p.id || `point-${Date.now()}-${idx}`,
                        questionSegment: p.questionSegment,
                        content: p.content || '',
                        keywords: p.keywords || [],
                        score: p.score || 0,
                        deductionRules: p.deductionRules
                    })),
                    examId: json.examId || null,
                    globalPreferences: {
                        handwritingScore: true,
                        spellingStrictness: 'low' as const
                    }
                };

                // 保存到 store
                setRubricConfig(questionKey, rubricConfig);
                await saveRubric(JSON.stringify(rubricConfig, null, 2), questionKey);

                toast.success(`已导入: ${rubricConfig.alias}`);
            } catch (err) {
                console.error('[RubricListView] Import error:', err);
                toast.error('无法解析 JSON 文件');
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // 重置以便再次导入同一文件
    };

    // 导出全部细则
    const handleExportAll = () => {
        if (!rubricLibrary || rubricLibrary.length === 0) {
            toast.warning('暂无细则可导出');
            return;
        }

        const exportData = rubricLibrary.map(rubric => {
            const data = rubricData?.[rubric.id];
            return {
                questionNo: rubric.questionNo,
                title: rubric.alias || `第${rubric.questionNo}题`,
                subject: data?.subject || '',
                totalScore: (data?.points || []).reduce((sum: number, p: any) => sum + (p.score || 0), 0),
                answerPoints: (data?.points || []).map((p: any) => ({
                    id: p.id,
                    content: p.content,
                    keywords: p.keywords,
                    score: p.score,
                    questionSegment: p.questionSegment
                })),
                examId: data?.examId,
                exportedAt: new Date().toISOString()
            };
        });

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rubrics-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success(`已导出 ${rubricLibrary.length} 条细则`);
    };

    // 按考试分组并过滤
    const groupedRubrics = useMemo(() => {
        const groups: GroupedRubric[] = [];
        const examMap = new Map<string | null, GroupedRubric>();

        // 初始化考试分组
        exams.forEach(exam => {
            examMap.set(exam.id, {
                examId: exam.id,
                examName: exam.name,
                rubrics: []
            });
        });

        // 添加未分组
        examMap.set(null, {
            examId: null,
            examName: '未分组',
            rubrics: []
        });

        // 分配细则到分组
        (rubricLibrary || []).forEach(rubric => {
            const data = (rubricData || {})[rubric.id];
            const examId = data?.examId || (rubric as any).examId || null;

            // 搜索过滤
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery ||
                rubric.questionNo?.toLowerCase().includes(searchLower) ||
                rubric.alias?.toLowerCase().includes(searchLower) ||
                (data?.anchorKeywords || []).some((kw: string) => kw.toLowerCase().includes(searchLower));

            if (!matchesSearch) return;

            const points = data?.points || [];
            const totalScore = points.reduce((sum: number, p: any) => sum + (p.score || 0), 0);
            const keywords = data?.anchorKeywords || points.flatMap((p: any) => p.keywords || []).slice(0, 5);

            const rubricItem = {
                id: rubric.id,
                questionNo: rubric.questionNo || '',
                alias: rubric.alias || `第${rubric.questionNo}题`,
                subject: data?.subject || '',
                pointCount: points.length,
                totalScore,
                keywords: keywords.slice(0, 3)
            };

            let group = examMap.get(examId);
            if (!group) {
                group = examMap.get(null)!;
            }
            group.rubrics.push(rubricItem);
        });

        // 转换为数组并过滤空分组
        examMap.forEach(group => {
            if (group.rubrics.length > 0) {
                groups.push(group);
            }
        });

        // 排序：有考试的在前，未分组在后
        return groups.sort((a, b) => {
            if (a.examId === null) return 1;
            if (b.examId === null) return -1;
            return 0;
        });
    }, [exams, rubricLibrary, rubricData, searchQuery]);

    const totalRubrics = groupedRubrics.reduce((sum, g) => sum + g.rubrics.length, 0);

    const toggleExam = (examId: string | null) => {
        const key = examId || 'ungrouped';
        setExpandedExams(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const isExpanded = (examId: string | null) => {
        return expandedExams.has(examId || 'ungrouped') || expandedExams.has('all');
    };

    const SUBJECT_COLORS: Record<string, string> = {
        '历史': 'bg-amber-100 text-amber-700',
        '政治': 'bg-blue-100 text-blue-700',
        '语文': 'bg-emerald-100 text-emerald-700',
        '物理': 'bg-violet-100 text-violet-700',
        '化学': 'bg-pink-100 text-pink-700',
        '数学': 'bg-cyan-100 text-cyan-700',
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* 隐藏的文件输入 */}
            <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleImport}
                className="hidden"
            />

            {/* Header */}
            <header className="h-12 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
                <h1 className="font-bold text-slate-800">评分细则</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="导入 JSON"
                    >
                        <Upload className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleExportAll}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="导出全部"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* 搜索栏 */}
            <div className="px-4 py-3 border-b border-slate-100 shrink-0">
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="搜索题号、名称或关键词..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-300 focus:bg-white transition-colors"
                    />
                </div>
            </div>

            {/* 列表内容 */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {groupedRubrics.map(group => (
                    <div key={group.examId || 'ungrouped'} className="border-b border-slate-100">
                        {/* 分组标题 */}
                        <button
                            onClick={() => toggleExam(group.examId)}
                            className="w-full px-4 py-2.5 bg-slate-50 flex items-center justify-between sticky top-0 hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                {group.examId ? (
                                    <Folder className="w-4 h-4 text-indigo-500" />
                                ) : (
                                    <FileText className="w-4 h-4 text-slate-400" />
                                )}
                                <span className="text-xs font-bold text-slate-700">{group.examName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400">{group.rubrics.length} 道题</span>
                                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded(group.examId) ? 'rotate-90' : ''}`} />
                            </div>
                        </button>

                        {/* 题目列表 */}
                        {isExpanded(group.examId) && (
                            <div className="px-4 py-2 space-y-2">
                                {group.rubrics.map(rubric => (
                                    <div
                                        key={rubric.id}
                                        onClick={() => onSelectRubric(rubric.id)}
                                        className="p-3 bg-white rounded-xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                                                    #{rubric.questionNo}
                                                </span>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800">{rubric.alias}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                        {rubric.pointCount} 个得分点 · {rubric.totalScore} 分
                                                    </p>
                                                </div>
                                            </div>
                                            {rubric.subject && (
                                                <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${SUBJECT_COLORS[rubric.subject] || 'bg-slate-100 text-slate-500'}`}>
                                                    {rubric.subject}
                                                </span>
                                            )}
                                        </div>
                                        {rubric.keywords.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {rubric.keywords.map((kw, i) => (
                                                    <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] rounded">
                                                        {kw}
                                                    </span>
                                                ))}
                                                {rubric.keywords.length < (rubricData?.[rubric.id]?.anchorKeywords?.length || 0) && (
                                                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-[9px] rounded">
                                                        +{(rubricData?.[rubric.id]?.anchorKeywords?.length || 0) - rubric.keywords.length}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* 空搜索结果 */}
                {totalRubrics === 0 && searchQuery && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Search className="w-10 h-10 text-slate-200 mb-3" />
                        <p className="text-sm text-slate-500">未找到匹配的细则</p>
                        <p className="text-xs text-slate-400 mt-1">尝试其他关键词</p>
                    </div>
                )}
            </div>

            {/* 底部添加按钮 */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                <button
                    onClick={onCreateNew}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl shadow-lg shadow-indigo-500/25 text-sm font-bold flex items-center justify-center gap-2 hover:shadow-xl transition-shadow"
                >
                    <Plus className="w-4 h-4" />
                    AI 创建新细则
                </button>
            </div>
        </div>
    );
}

// 空状态组件
export function RubricEmptyState({ onCreateNew }: { onCreateNew: () => void }) {
    return (
        <div className="flex flex-col h-full bg-white">
            <header className="h-12 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
                <h1 className="font-bold text-slate-800">评分细则</h1>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-6">
                    <FileText className="w-10 h-10 text-indigo-400" />
                </div>

                <h2 className="text-lg font-bold text-slate-800 mb-2">开始配置评分细则</h2>
                <p className="text-sm text-slate-400 text-center mb-8 max-w-[280px]">
                    评分细则是 AI 批改的核心依据。<br />点击下方按钮创建您的第一条细则。
                </p>

                <button
                    onClick={onCreateNew}
                    className="px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl shadow-lg shadow-indigo-500/25 text-sm font-bold flex items-center justify-center gap-2 hover:shadow-xl transition-shadow"
                >
                    <Zap className="w-4 h-4" />
                    创建评分细则
                </button>
            </div>
        </div>
    );
}
