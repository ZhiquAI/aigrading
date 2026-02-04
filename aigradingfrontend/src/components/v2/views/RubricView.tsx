/**
 * RubricView - 评分细则管理页面
 * 工作流第一步：阅卷前配置评分规则
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Plus,
    FileText,
    Search,
    Sparkles
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/components/Toast';
import { Tab } from '@/types';
import RubricDrawer from './RubricDrawer';

const RubricView: React.FC = () => {
    const {
        rubricLibrary,
        rubricData,
        exams,
        activeTab,
        selectQuestion,
        setHeaderActions,
        setRubricConfig,
        saveRubric,
        isRubricDrawerOpen,
        setIsRubricDrawerOpen,
        setManualQuestionKey
    } = useAppStore();

    const [searchTerm, setSearchTerm] = useState('');
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
                    toast.error('JSON 格式错误，缺少 answerPoints 数组');
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

                setRubricConfig(questionKey, rubricConfig);
                await saveRubric(JSON.stringify(rubricConfig, null, 2), questionKey);

                toast.success(`已导入: ${rubricConfig.alias}`);
            } catch (err) {
                console.error('[RubricView] Import error:', err);
                toast.error('无法解析 JSON 文件');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    // 导出全部细则
    const handleExportAll = useCallback(() => {
        if (!rubricLibrary || rubricLibrary.length === 0) {
            toast.warning('暂无细则可导出');
            return;
        }

        const exportData = rubricLibrary.map(rubric => {
            const data = rubricData?.[rubric.id];
            const points = Array.isArray(data?.answerPoints)
                ? data.answerPoints
                : (data?.points || []);
            const resolvedTotalScore = typeof data?.totalScore === 'number'
                ? data.totalScore
                : points.reduce((sum: number, p: any) => sum + (p.score || 0), 0);
            return {
                questionNo: rubric.questionNo || data?.questionId,
                title: rubric.alias || `第${rubric.questionNo}题`,
                subject: data?.subject || '',
                totalScore: resolvedTotalScore,
                answerPoints: points.map((p: any) => ({
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
    }, [rubricLibrary, rubricData]);

    // Register Header Actions - only when Rubric tab is active
    useEffect(() => {
        if (activeTab !== Tab.Rubric) return;
        setHeaderActions([
            {
                id: 'import-rubric',
                label: '导入',
                icon: 'Upload',
                onClick: () => fileInputRef.current?.click()
            },
            {
                id: 'export-rubric',
                label: '导出',
                icon: 'Download',
                onClick: handleExportAll
            }
        ]);
        return () => setHeaderActions([]);
    }, [setHeaderActions, handleExportAll, activeTab]);

    // Filter logic
    const filteredItems = useMemo(() => {
        if (!rubricLibrary) return [];
        if (!searchTerm) return rubricLibrary;
        const lower = searchTerm.toLowerCase();
        return rubricLibrary.filter(item =>
            item.alias?.toLowerCase().includes(lower) ||
            item.questionNo?.toLowerCase().includes(lower) ||
            item.keywords?.some(k => k.toLowerCase().includes(lower))
        );
    }, [rubricLibrary, searchTerm]);

    const groupedByExam = useMemo(() => {
        const examMap = new Map<string, {
            key: string;
            name: string;
            isUncategorized: boolean;
            subjects: Map<string, any[]>;
        }>();

        filteredItems.forEach((item: any) => {
            const data = rubricData?.[item.id] || {};
            const examId = data.examId || item.examId || 'uncategorized';
            const resolvedExamName = examId === 'uncategorized'
                ? (data.examName || '未归类')
                : exams.find((exam) => exam.id === examId)?.name || data.examName || '未归类';
            const subject = data.subject || item.subject || '未设学科';
            const points = Array.isArray(data.answerPoints)
                ? data.answerPoints
                : (data.points || []);
            const pointCount = points.length;
            const parsedTotal = Number(data.totalScore);
            const fallbackTotal = points.reduce((sum: number, p: any) => sum + (Number(p.score) || 0), 0);
            const totalScore = Number.isFinite(parsedTotal) && parsedTotal > 0
                ? parsedTotal
                : fallbackTotal;
            const typeLabel = data.title || item.typeLabel || '主观题';

            if (!examMap.has(examId)) {
                examMap.set(examId, {
                    key: examId,
                    name: examName,
                    isUncategorized: examId === 'uncategorized',
                    subjects: new Map()
                });
            }

            const examGroup = examMap.get(examId)!;
            if (!examGroup.subjects.has(subject)) {
                examGroup.subjects.set(subject, []);
            }

            examGroup.subjects.get(subject)!.push({
                ...item,
                examName: resolvedExamName,
                subject,
                typeLabel,
                pointCount,
                totalScore
            });
        });

        const result = Array.from(examMap.values()).map((group) => {
            const subjects = Array.from(group.subjects.entries()).map(([name, items]) => ({
                name,
                items
            }));
            const count = subjects.reduce((sum, s) => sum + s.items.length, 0);
            return { ...group, subjects, count };
        });

        return result.sort((a, b) => {
            if (a.isUncategorized !== b.isUncategorized) {
                return a.isUncategorized ? 1 : -1;
            }
            return a.name.localeCompare(b.name, 'zh-Hans-CN');
        });
    }, [filteredItems, rubricData, exams]);

    const handleItemClick = (id: string) => {
        selectQuestion(id);
        setIsRubricDrawerOpen(true);
    };

    const isEmpty = !rubricLibrary || rubricLibrary.length === 0;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* 隐藏的文件输入用于导入 */}
            <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleImport}
                className="hidden"
            />

            {/* Search Bar */}
            <div className="px-4 py-3 border-b border-slate-200/60 shrink-0">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="搜索题号、名称或关键词..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isEmpty ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-dashed border-indigo-200 rounded-2xl shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 shadow-sm">
                            <FileText className="w-8 h-8 text-indigo-400" />
                        </div>
                        <h3 className="text-base font-black text-slate-800">还没有评分细则</h3>
                        <p className="text-xs text-slate-400 mt-2 mb-6 max-w-[240px] leading-relaxed">
                            上传试题与参考答案图片，自动生成 JSON 并可视化编辑。
                        </p>
                        <button
                            onClick={() => {
                                setManualQuestionKey(null);
                                setIsRubricDrawerOpen(true);
                            }}
                            className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200 flex items-center gap-2 cursor-pointer"
                        >
                            <Sparkles className="w-4 h-4" />
                            创建第一条细则
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {groupedByExam.map((examGroup) => (
                            <div key={examGroup.key} className="space-y-2">
                                {!examGroup.isUncategorized && (
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                                            {examGroup.name}
                                        </span>
                                    </div>
                                )}

                                {examGroup.subjects.map((subjectGroup) => (
                                    <div key={`${examGroup.key}-${subjectGroup.name}`} className="space-y-1">
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                {subjectGroup.name}
                                            </span>
                                        </div>
                                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                            {subjectGroup.items.map((item: any) => {
                                                const statusLabel = item.pointCount > 0 ? '已完成' : '进行中';
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => handleItemClick(item.id)}
                                                        className="w-full text-left px-3 py-3 flex items-center gap-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors cursor-pointer"
                                                    >
                                                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                                            {item.questionNo || '?'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-bold text-slate-800 truncate">
                                                                {item.alias || `第 ${item.questionNo} 题`}
                                                            </div>
                                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                                {item.examName && item.examName !== '未归类' && (
                                                                    <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                                        {item.examName}
                                                                    </span>
                                                                )}
                                                                <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                                                    {item.typeLabel}
                                                                </span>
                                                                <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                    总分 {item.totalScore || 0}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span
                                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusLabel === '已完成'
                                                                ? 'bg-emerald-50 text-emerald-600'
                                                                : 'bg-amber-50 text-amber-600'
                                                            }`}
                                                        >
                                                            {statusLabel}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Action Button */}
            {!isEmpty && (
                <button
                    onClick={() => {
                        setManualQuestionKey(null);
                        setIsRubricDrawerOpen(true);
                    }}
                    className="absolute bottom-20 right-4 p-3.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer z-20"
                >
                    <Plus className="w-5 h-5" />
                </button>
            )}

            {/* Drawer */}
            <RubricDrawer
                isOpen={isRubricDrawerOpen}
                onClose={() => setIsRubricDrawerOpen(false)}
            />
        </div>
    );
};

export default RubricView;
