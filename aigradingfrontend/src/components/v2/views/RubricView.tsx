/**
 * RubricView - 评分细则管理页面
 * 工作流第一步：阅卷前配置评分规则
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Plus,
    FileText,
    Search,
    Sparkles,
    Edit2,
    Trash2,
    Download,
    LayoutGrid,
    RefreshCw
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/components/Toast';
import { Tab } from '@/types';
import { coerceRubricToV3 } from '@/utils/rubric-convert';
import type { RubricJSONV3 } from '@/types/rubric-v3';
import {
    fetchRubricTemplates,
    deleteRubricTemplate,
    type RubricTemplate
} from '@/services/rubric-templates';
import RubricDrawer from './RubricDrawer';

const normalizeRubricOrNull = (data: unknown): RubricJSONV3 | null => {
    try {
        return coerceRubricToV3(data).rubric;
    } catch {
        return null;
    }
};

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
    const [libraryTab, setLibraryTab] = useState<'library' | 'templates'>('library');
    const [templateTab, setTemplateTab] = useState<'user' | 'system' | 'recent'>('user');
    const [templates, setTemplates] = useState<RubricTemplate[]>([]);
    const [isTemplateLoading, setIsTemplateLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const hasCleanedDuplicatesRef = useRef(false);

    useEffect(() => {
        if (hasCleanedDuplicatesRef.current) return;
        if (!rubricLibrary || rubricLibrary.length === 0) return;

        const state = useAppStore.getState();
        const dataMap = state.rubricData || {};
        const library = state.rubricLibrary || [];

        const parseQuestionNo = (id: string, item: any, data: any) => {
            const direct = data?.metadata?.questionId || data?.questionNo || data?.questionId || item?.questionNo;
            if (direct) return direct;
            const normalized = id.replace('imported:', '');
            if (normalized.includes(':')) {
                const parts = normalized.split(':');
                return parts[parts.length - 1] || '';
            }
            const firstSep = normalized.indexOf('_');
            return firstSep > -1 ? normalized.slice(0, firstSep) : normalized;
        };

        const getPointScore = (data: any) => {
            if (!data) return 0;
            const normalized = normalizeRubricOrNull(data);
            if (!normalized) return 0;
            if (normalized.strategyType === 'rubric_matrix') {
                return normalized.content.totalScore
                    || normalized.content.dimensions.reduce((sum, d) => sum + (d.weight || 0), 0);
            }
            if (normalized.strategyType === 'sequential_logic') {
                return normalized.content.totalScore
                    || normalized.content.steps.reduce((sum, p) => sum + (p.score || 0), 0);
            }
            return normalized.content.totalScore
                || normalized.content.points.reduce((sum, p) => sum + (p.score || 0), 0);
        };

        const groupMap = new Map<string, { id: string; score: number }>();
        const duplicateIds: string[] = [];

        library.forEach((item: any) => {
            const data = dataMap[item.id] || {};
            const questionNo = parseQuestionNo(item.id, item, data) || '';
            if (!questionNo) return;
            const subject = data?.subject || item?.subject || '未设学科';
            const examName = data?.examName || item?.examName || '';
            const key = `${examName}__${subject}__${questionNo}`;
            const score = getPointScore(data);

            const existing = groupMap.get(key);
            if (!existing) {
                groupMap.set(key, { id: item.id, score });
                return;
            }

            if (score > existing.score) {
                duplicateIds.push(existing.id);
                groupMap.set(key, { id: item.id, score });
            } else {
                duplicateIds.push(item.id);
            }
        });

        if (duplicateIds.length > 0) {
            const nextLibrary = library.filter((item: any) => !duplicateIds.includes(item.id));
            const nextData = { ...dataMap };
            duplicateIds.forEach((id) => delete nextData[id]);
            useAppStore.setState({ rubricLibrary: nextLibrary, rubricData: nextData });

            // 同步清理本地存储的重复项
            duplicateIds.forEach((id) => {
                const storageKey = `app_rubric_content:${id}`;
                if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                    chrome.storage.local.remove(storageKey);
                } else {
                    localStorage.removeItem(storageKey);
                }
            });
        }

        hasCleanedDuplicatesRef.current = true;
    }, [rubricLibrary, rubricData]);

    const loadTemplates = useCallback(async () => {
        setIsTemplateLoading(true);
        try {
            const scope = templateTab === 'recent' ? 'all' : templateTab;
            const list = await fetchRubricTemplates({ scope });
            const trimmed = templateTab === 'recent' ? list.slice(0, 8) : list;
            setTemplates(trimmed);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '获取模板失败';
            console.error('[RubricView] Load templates error:', err);
            toast.error(message);
            setTemplates([]);
        } finally {
            setIsTemplateLoading(false);
        }
    }, [templateTab]);

    useEffect(() => {
        if (libraryTab !== 'templates') return;
        loadTemplates();
    }, [libraryTab, loadTemplates]);

    // 导入 JSON 文件
    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const raw = JSON.parse(e.target?.result as string);
                const payloads = Array.isArray(raw) ? raw : [raw?.rubric || raw?.data || raw];
                let successCount = 0;
                let failCount = 0;

                const parseQuestionNoFromId = (id: string) => {
                    if (!id.startsWith('imported:')) return '';
                    const rawPart = id.replace('imported:', '');
                    const firstSep = rawPart.indexOf('_');
                    const safePart = firstSep > -1 ? rawPart.slice(0, firstSep) : rawPart;
                    return safePart || '';
                };

                const removeDuplicateImports = (questionNo: string, subject: string, examName: string, keepId: string) => {
                    const state = useAppStore.getState();
                    const currentData = state.rubricData || {};
                    const currentLibrary = state.rubricLibrary || [];
                    const idsToRemove: string[] = [];

                    Object.entries(currentData).forEach(([id, value]) => {
                        const data = value as any;
                        const normalized = normalizeRubricOrNull(data);
                        if (!normalized) return;
                        const storedQuestionNo = normalized.metadata.questionId || parseQuestionNoFromId(id);
                        const storedSubject = normalized.metadata.subject || '未设学科';
                        const storedExamName = normalized.metadata.examName || '';

                        if (
                            id !== keepId &&
                            storedQuestionNo === questionNo &&
                            storedSubject === subject &&
                            storedExamName === examName
                        ) {
                            idsToRemove.push(id);
                        }
                    });

                    if (idsToRemove.length === 0) return;

                    const nextLibrary = currentLibrary.filter((item: any) => !idsToRemove.includes(item.id));
                    const nextData = { ...currentData };
                    idsToRemove.forEach((id) => delete nextData[id]);
                    useAppStore.setState({ rubricLibrary: nextLibrary, rubricData: nextData });
                };

                for (let i = 0; i < payloads.length; i += 1) {
                    const data = payloads[i]?.rubric || payloads[i]?.data || payloads[i];
                    let normalized: RubricJSONV3;
                    try {
                        normalized = coerceRubricToV3(data).rubric;
                    } catch (err) {
                        console.error('[RubricView] Invalid rubric payload:', err);
                        failCount += 1;
                        continue;
                    }

                    const questionNo = normalized.metadata.questionId || `Q${Date.now().toString().slice(-4)}`;
                    const subject = normalized.metadata.subject || '未设学科';
                    const examName = normalized.metadata.examName || '';
                    const stableKey = `imported:${examName || 'noexam'}:${subject}:${questionNo}`;
                    const existing = rubricLibrary.find((item: any) =>
                        item.questionNo === questionNo &&
                        (item.subject || '未设学科') === subject &&
                        (item.examName || '') === examName
                    );
                    const questionKey = existing?.id || stableKey;

                    removeDuplicateImports(questionNo, subject, examName, questionKey);
                    setRubricConfig(questionKey, normalized);
                    await saveRubric(JSON.stringify(normalized, null, 2), questionKey);
                    successCount += 1;
                }

                if (successCount > 0 && failCount === 0) {
                    toast.success(`已导入 ${successCount} 条细则`);
                } else if (successCount > 0) {
                    toast.warning(`已导入 ${successCount} 条，${failCount} 条失败`);
                } else {
                    toast.error('JSON 格式错误，未识别到有效评分细则');
                }
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
            const normalized = data ? normalizeRubricOrNull(data) : null;
            if (!normalized) return null;
            return {
                ...normalized,
                exportedAt: new Date().toISOString()
            };
        }).filter(Boolean);

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rubrics-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success(`已导出 ${exportData.length} 条细则`);
    }, [rubricLibrary, rubricData]);

    // 当前页面不在 Header 注册动作，导入导出按钮移至空状态页面和列表页面
    useEffect(() => {
        if (activeTab !== Tab.Rubric) return;
        setHeaderActions([]);
        return () => setHeaderActions([]);
    }, [setHeaderActions, activeTab]);

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
            const rawData = rubricData?.[item.id];
            const normalized = rawData ? normalizeRubricOrNull(rawData) : null;
            const meta = normalized?.metadata || {};
            const examId = meta.examId || item.examId || 'uncategorized';
            const resolvedExamName = examId === 'uncategorized'
                ? (meta.examName || '未归类')
                : exams.find((exam) => exam.id === examId)?.name || meta.examName || '未归类';
            const subject = meta.subject || item.subject || '未设学科';
            const pointCount = normalized
                ? normalized.strategyType === 'rubric_matrix'
                    ? normalized.content.dimensions.length
                    : normalized.strategyType === 'sequential_logic'
                        ? normalized.content.steps.length
                        : normalized.content.points.length
                : 0;
            let totalScore = 0;
            if (normalized) {
                if (normalized.strategyType === 'rubric_matrix') {
                    totalScore = normalized.content.totalScore
                        || normalized.content.dimensions.reduce((sum, d) => sum + (d.weight || 0), 0);
                } else if (normalized.strategyType === 'sequential_logic') {
                    totalScore = normalized.content.totalScore
                        || normalized.content.steps.reduce((sum, p) => sum + (p.score || 0), 0);
                } else {
                    totalScore = normalized.content.totalScore
                        || normalized.content.points.reduce((sum, p) => sum + (p.score || 0), 0);
                }
            }
            const typeLabel = meta.questionType || '填空题';

            const groupKey = `${resolvedExamName}__${subject}`;
            if (!examMap.has(groupKey)) {
                examMap.set(groupKey, {
                    key: groupKey,
                    name: resolvedExamName,
                    isUncategorized: !resolvedExamName || resolvedExamName === '未归类',
                    subjects: new Map()
                });
            }

            const examGroup = examMap.get(groupKey)!;
            if (!examGroup.subjects.has(subject)) {
                examGroup.subjects.set(subject, []);
            }

            // 优先从 data 中获取题号
            const questionNo = meta.questionId || item.questionNo || '?';

            examGroup.subjects.get(subject)!.push({
                ...item,
                questionNo,
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

    const filteredTemplates = useMemo(() => {
        if (!searchTerm) return templates;
        const lower = searchTerm.toLowerCase();
        return templates.filter((tpl) => {
            const meta = tpl.metadata || {};
            return (
                meta.title?.toLowerCase().includes(lower) ||
                meta.questionType?.toLowerCase().includes(lower) ||
                meta.subject?.toLowerCase().includes(lower)
            );
        });
    }, [templates, searchTerm]);

    const handleApplyTemplate = (tpl: RubricTemplate) => {
        const key = `template:${tpl.id}`;
        const now = new Date().toISOString();
        const rubric: RubricJSONV3 = {
            version: '3.0',
            metadata: {
                ...tpl.metadata,
                questionId: tpl.metadata?.questionId || '',
                title: tpl.metadata?.title || ''
            },
            strategyType: tpl.strategyType,
            content: tpl.content,
            constraints: [],
            createdAt: now,
            updatedAt: now
        };
        setRubricConfig(key, rubric);
        setManualQuestionKey(key);
        setIsRubricDrawerOpen(true);
    };

    const handleDeleteTemplate = async (tpl: RubricTemplate) => {
        try {
            await deleteRubricTemplate(tpl.id);
            toast.success('模板已删除');
            loadTemplates();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '删除失败';
            console.error('[RubricView] Delete template error:', err);
            toast.error(message);
        }
    };

    const handleItemClick = (id: string) => {
        console.log('[RubricView] handleItemClick called with id:', id);
        const state = useAppStore.getState();
        const data = state.rubricData?.[id];
        let targetId = id;

        console.log('[RubricView] rubricData has key:', !!data);
        console.log('[RubricView] rubricData keys:', Object.keys(state.rubricData || {}));

        if (!data) {
            const parseQuestionNoFromId = (rawId: string) => {
                if (!rawId.startsWith('imported:')) return '';
                const rawPart = rawId.replace('imported:', '');
                if (rawPart.includes(':')) {
                    const parts = rawPart.split(':');
                    return parts[parts.length - 1] || '';
                }
                const firstSep = rawPart.indexOf('_');
                return firstSep > -1 ? rawPart.slice(0, firstSep) : rawPart;
            };

            const item = state.rubricLibrary.find((entry: any) => entry.id === id);
            const questionNo = item?.questionNo || parseQuestionNoFromId(id);
            const subject = item?.subject || '未设学科';
            const examName = item?.examName || '';

            const candidate = state.rubricLibrary.find((entry: any) =>
                entry.id !== id &&
                (entry.questionNo || '') === questionNo &&
                (entry.subject || '未设学科') === subject &&
                (entry.examName || '') === examName
            );

            if (candidate) {
                targetId = candidate.id;
            }
        }

        console.log('[RubricView] calling selectQuestion with targetId:', targetId);
        selectQuestion(targetId);
        setIsRubricDrawerOpen(true);
    };

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // 阻止触发卡片点击
        setDeleteConfirm({ open: true, id });
    };

    const confirmDelete = async () => {
        const id = deleteConfirm.id;
        if (!id) return;
        setDeleteConfirm({ open: false, id: null });

        try {
            // 从本地存储删除
            const storageKey = `app_rubric_content:${id}`;
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                await chrome.storage.local.remove(storageKey);
            } else {
                localStorage.removeItem(storageKey);
            }
            // 从 store 中移除
            const { rubricLibrary, rubricData } = useAppStore.getState();
            const newLibrary = rubricLibrary.filter((item: any) => item.id !== id);
            const newData = { ...rubricData };
            delete newData[id];
            useAppStore.setState({ rubricLibrary: newLibrary, rubricData: newData });
            toast.success('评分细则已删除');
        } catch (err) {
            console.error('[RubricView] Delete error:', err);
            toast.error('删除失败');
        }
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

            {/* Search Bar with Export Button */}
            <div className="px-4 py-3 border-b border-slate-200/60 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={libraryTab === 'templates' ? '搜索模板标题/题型/学科...' : '搜索题号、名称或关键词...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                        />
                    </div>
                    {libraryTab === 'library' && !isEmpty && (
                        <button
                            onClick={handleExportAll}
                            className="px-3 py-2.5 bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 shrink-0"
                            title="导出全部细则"
                        >
                            <Download className="w-4 h-4" />
                            导出
                        </button>
                    )}
                    {libraryTab === 'templates' && (
                        <button
                            onClick={loadTemplates}
                            className="px-3 py-2.5 bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 shrink-0"
                            title="刷新模板库"
                        >
                            <RefreshCw className="w-4 h-4" />
                            刷新
                        </button>
                    )}
                </div>
            </div>

            <div className="px-4 pt-3 pb-1">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setLibraryTab('library')}
                        className={`h-8 rounded-lg text-xs font-bold border transition-colors ${libraryTab === 'library' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-indigo-600'}`}
                    >
                        我的细则
                    </button>
                    <button
                        onClick={() => setLibraryTab('templates')}
                        className={`h-8 rounded-lg text-xs font-bold border transition-colors ${libraryTab === 'templates' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-emerald-200 hover:text-emerald-600'}`}
                    >
                        模板库
                    </button>
                </div>
                {libraryTab === 'templates' && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                        <button
                            onClick={() => setTemplateTab('user')}
                            className={`h-7 rounded-lg text-[10px] font-bold border transition-colors ${templateTab === 'user' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-indigo-600'}`}
                        >
                            我的模板
                        </button>
                        <button
                            onClick={() => setTemplateTab('system')}
                            className={`h-7 rounded-lg text-[10px] font-bold border transition-colors ${templateTab === 'system' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-emerald-200 hover:text-emerald-600'}`}
                        >
                            系统模板
                        </button>
                        <button
                            onClick={() => setTemplateTab('recent')}
                            className={`h-7 rounded-lg text-[10px] font-bold border transition-colors ${templateTab === 'recent' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-600'}`}
                        >
                            最近使用
                        </button>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {libraryTab === 'templates' ? (
                    <div className="space-y-3">
                        {isTemplateLoading && (
                            <div className="text-center text-xs text-slate-400 py-6">模板加载中...</div>
                        )}
                        {!isTemplateLoading && filteredTemplates.length === 0 && (
                            <div className="text-center text-xs text-slate-400 py-10">
                                暂无模板，可在评分细则编辑器中「另存为模板」
                            </div>
                        )}
                        {!isTemplateLoading && filteredTemplates.length > 0 && (
                            <div className="space-y-2">
                                {filteredTemplates.map((tpl) => (
                                    <div key={tpl.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                                            <LayoutGrid className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-slate-700 truncate">
                                                {tpl.metadata?.title || tpl.metadata?.questionType || '未命名模板'}
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-slate-50 text-slate-500 border border-slate-100">
                                                    {tpl.metadata?.subject || '未设学科'}
                                                </span>
                                                <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                                    {tpl.metadata?.questionType || '未知题型'}
                                                </span>
                                                <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                    {tpl.strategyType}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleApplyTemplate(tpl)}
                                                className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                            >
                                                使用模板
                                            </button>
                                            {tpl.scope === 'user' && (
                                                <button
                                                    onClick={() => handleDeleteTemplate(tpl)}
                                                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                                    title="删除模板"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : isEmpty ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 shadow-sm">
                            <FileText className="w-8 h-8 text-indigo-400" />
                        </div>
                        <h3 className="text-base font-black text-slate-800">还没有评分细则</h3>
                        <p className="text-xs text-slate-400 mt-2 mb-6 max-w-[240px] leading-relaxed">
                            上传试题与参考答案图片，自动生成 JSON 并可视化编辑。
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setManualQuestionKey(null);
                                    setIsRubricDrawerOpen(true);
                                }}
                                className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200 flex items-center gap-2 cursor-pointer"
                            >
                                <Sparkles className="w-4 h-4" />
                                AI 创建
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-5 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2 cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                导入 JSON
                            </button>
                        </div>
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
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="w-full text-left px-3 py-3 flex items-center gap-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                                                    >
                                                        <div
                                                            className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 cursor-pointer"
                                                            onClick={() => handleItemClick(item.id)}
                                                        >
                                                            {item.questionNo || '?'}
                                                        </div>
                                                        <div
                                                            className="flex-1 min-w-0 cursor-pointer"
                                                            onClick={() => handleItemClick(item.id)}
                                                        >
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                                                    {item.typeLabel}
                                                                </span>
                                                                <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                    总分 {item.totalScore || 0}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleItemClick(item.id)}
                                                                className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
                                                                title="编辑"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDelete(item.id, e)}
                                                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                                                title="删除"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
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
            {libraryTab === 'library' && !isEmpty && (
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

            {/* 删除确认对话框 */}
            {deleteConfirm.open && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white rounded-2xl shadow-xl p-5 w-72 mx-4">
                        <div className="text-center mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-base font-bold text-slate-800 mb-1">确认删除</h3>
                            <p className="text-sm text-slate-500">确定要删除这条评分细则吗？此操作不可撤销。</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeleteConfirm({ open: false, id: null })}
                                className="flex-1 py-2 px-4 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-2 px-4 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
                            >
                                删除
                            </button>
                        </div>
                    </div>
                </div>
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
