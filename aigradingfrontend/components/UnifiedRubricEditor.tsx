import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Download, Upload, RefreshCw, X, Check, Code, Wand2, Sparkles, FileText, Image as ImageIcon, Menu, Plus, Trash2, Edit2, Type } from 'lucide-react';
import { generateRubricFromImages, refineRubric, generateRubricFromText } from '../services/rubric-service';
import { storage } from '../utils/storage';
import { toast } from './Toast';
import RubricFormEditor from './RubricFormEditor';
import type { RubricJSON } from '../types/rubric';
import { rubricToMarkdown } from '../utils/rubric-converter';

interface QuestionItem {
    key: string;
    questionNo: string;
    platform: string;
    rubric: string;
}

interface UnifiedRubricEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (rubric: string, questionKey: string) => void;
    currentQuestionKey?: string | null;
}

const UnifiedRubricEditor: React.FC<UnifiedRubricEditorProps> = ({
    isOpen,
    onClose,
    onSave,
    currentQuestionKey
}) => {
    // 题目列表
    const [questions, setQuestions] = useState<QuestionItem[]>([]);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // 抽屉导航状态
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // 编辑器状态
    const [rubricText, setRubricText] = useState('');

    // AI 命令栏状态
    const [aiInput, setAiInput] = useState('');
    const [attachedImages, setAttachedImages] = useState<{ name: string; base64: string; type: 'question' | 'answer' }[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // 侧边栏新建/编辑题目状态
    const [isEditingQuestionNo, setIsEditingQuestionNo] = useState(false);
    const [editQuestionNo, setEditQuestionNo] = useState('');
    const [renamingKey, setRenamingKey] = useState<string | null>(null);
    const [deletingKey, setDeletingKey] = useState<string | null>(null);
    // 右键菜单状态
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; key: string } | null>(null);
    const questionNoInputRef = useRef<HTMLInputElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const answerFileInputRef = useRef<HTMLInputElement>(null);
    const importFileInputRef = useRef<HTMLInputElement>(null);

    // 编辑模式: 'text' 文本编辑 | 'form' 表单编辑
    const [editMode, setEditMode] = useState<'text' | 'form'>('form');
    // 当前 JSON 数据（表单模式使用）
    const [rubricJSON, setRubricJSON] = useState<RubricJSON | null>(null);

    // 拖拽状态
    const [isDragging, setIsDragging] = useState(false);
    // JSON 校验状态
    const [jsonValidationError, setJsonValidationError] = useState<string | null>(null);
    // 文本导入弹窗状态
    const [showTextImport, setShowTextImport] = useState(false);
    const [textImportValue, setTextImportValue] = useState('');

    // 加载所有评分细则
    const loadQuestions = async () => {
        setLoading(true);
        try {
            if (typeof chrome === 'undefined' || !chrome.storage?.local) {
                setLoading(false);
                return;
            }

            chrome.storage.local.get(null, (items: Record<string, any>) => {
                const questionItems: QuestionItem[] = [];
                for (const key of Object.keys(items)) {
                    if (key.startsWith('app_rubric_content:')) {
                        const value = items[key];
                        if (typeof value === 'string' && value.trim()) {
                            const parts = key.replace('app_rubric_content:', '').split(':');
                            const platform = parts[0] || '未知';
                            const questionNo = parts[parts.length - 1] || '未知';
                            questionItems.push({
                                key: key.replace('app_rubric_content:', ''),
                                questionNo,
                                platform,
                                rubric: value
                            });
                        }
                    }
                }
                questionItems.sort((a, b) => (parseInt(a.questionNo) || 0) - (parseInt(b.questionNo) || 0));
                setQuestions(questionItems);
                setLoading(false);

                // 自动选中当前题目或第一个
                if (currentQuestionKey) {
                    const found = questionItems.find(q => q.key === currentQuestionKey);
                    if (found) {
                        setSelectedKey(found.key);
                        setRubricText(found.rubric);
                    }
                } else if (questionItems.length > 0) {
                    setSelectedKey(questionItems[0].key);
                    setRubricText(questionItems[0].rubric);
                }
            });
        } catch (e) {
            console.error('[UnifiedRubricEditor] Error loading questions:', e);
            setLoading(false);
        }
    };

    // 当 rubricText 有内容时，如果内容看起来像 JSON，尝试校验
    useEffect(() => {
        if (rubricText.trim().startsWith('{')) {
            try {
                JSON.parse(rubricText);
                setJsonValidationError(null);
            } catch (e: any) {
                setJsonValidationError(e.message);
            }
        } else {
            setJsonValidationError(null);
        }
    }, [rubricText]);

    useEffect(() => {
        if (isOpen) {
            loadQuestions();
            setAiInput('');
            setAttachedImages([]);
        }
    }, [isOpen, currentQuestionKey]);

    // 键盘快捷键监听
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            // 调试日志
            // console.log('Key pressed:', e.key, 'Alt:', e.altKey);

            // Alt + K: 上一题 (Vim style + Alt)
            // Alt + J: 下一题
            if (e.altKey && (e.key === 'k' || e.key === 'ArrowLeft')) {
                e.preventDefault();
                console.log('[UnifiedRubricEditor] Prev Question Triggered');
                handlePrevQuestion();
            }
            if (e.altKey && (e.key === 'j' || e.key === 'ArrowRight')) {
                e.preventDefault();
                console.log('[UnifiedRubricEditor] Next Question Triggered');
                handleNextQuestion();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedKey, questions]); // 依赖项需包含 selectedKey 和 questions 以保证 handlePrev/Next 获取最新状态

    // 切换题目
    const handleSelectQuestion = (key: string) => {
        const q = questions.find(q => q.key === key);
        if (q) {
            setSelectedKey(key);
            setRubricText(q.rubric);
            setIsDrawerOpen(false); // 选中后关闭抽屉

            // 尝试同步 JSON 状态
            if (q.rubric.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(q.rubric);
                    if (parsed.answerPoints) {
                        setRubricJSON(parsed);
                    }
                } catch { }
            }
        }
    };

    // 上一题
    const handlePrevQuestion = () => {
        const index = questions.findIndex(q => q.key === selectedKey);
        if (index > 0) {
            handleSelectQuestion(questions[index - 1].key);
        }
    };

    // 下一题
    const handleNextQuestion = () => {
        const index = questions.findIndex(q => q.key === selectedKey);
        if (index !== -1 && index < questions.length - 1) {
            handleSelectQuestion(questions[index + 1].key);
        }
    };


    // 开始编辑题号
    const handleStartCreateQuestion = () => {
        setIsEditingQuestionNo(true);
        setEditQuestionNo('');
        setTimeout(() => questionNoInputRef.current?.focus(), 50);
    };

    // 确认创建/编辑题号
    const handleConfirmEditQuestionNo = async () => {
        const trimmed = editQuestionNo.trim();
        if (!trimmed) {
            setIsEditingQuestionNo(false);
            setRenamingKey(null);
            return;
        }

        const newKey = `MANUAL:0:${trimmed}`;

        // 检查是否已存在 (除了自己)
        const existingQ = questions.find(q => q.key === newKey);
        if (existingQ) {
            if (renamingKey && existingQ.key === renamingKey) {
                // 名字没变，直接取消
                setIsEditingQuestionNo(false);
                setEditQuestionNo('');
                setRenamingKey(null);
                return;
            }
            toast.error('该题号已存在');
            return;
        }

        if (renamingKey) {
            // === 重命名逻辑 ===
            const oldQ = questions.find(q => q.key === renamingKey);
            if (oldQ) {
                // 1. 删除旧存储
                await storage.removeItem(`app_rubric_content:${renamingKey}`);
                // 2. 保存新存储
                await storage.setItem(`app_rubric_content:${newKey}`, oldQ.rubric);

                // 3. 更新 state
                setQuestions(prev => prev.map(q => q.key === renamingKey ? { ...q, key: newKey, questionNo: trimmed } : q));
                if (selectedKey === renamingKey) {
                    setSelectedKey(newKey);
                }
                toast.success('重命名成功');
            }
        } else {
            // === 新建逻辑 ===
            const newItem = { key: newKey, questionNo: trimmed, platform: 'MANUAL', rubric: '' };
            setQuestions(prev => [...prev, newItem]);
            setSelectedKey(newKey);
            setRubricText('');
            setRubricJSON(null);

            // 立即保存到 storage,确保题目持久化
            await storage.setItem(`app_rubric_content:${newKey}`, '');

            setIsDrawerOpen(false);
        }

        setIsEditingQuestionNo(false);
        setEditQuestionNo('');
        setRenamingKey(null);
    };

    const handleCancelEditQuestionNo = () => {
        setIsEditingQuestionNo(false);
        setEditQuestionNo('');
        setRenamingKey(null);
    };

    // 处理标签页右键菜单
    const handleTabContextMenu = (e: React.MouseEvent, key: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, key });
    };

    // 关闭右键菜单
    const closeContextMenu = () => setContextMenu(null);

    // 右键菜单 - 重命名
    const handleContextMenuRename = () => {
        if (!contextMenu) return;
        const q = questions.find(q => q.key === contextMenu.key);
        if (q) {
            setEditQuestionNo(q.questionNo);
            setRenamingKey(contextMenu.key);
            setIsEditingQuestionNo(true);
            setTimeout(() => questionNoInputRef.current?.focus(), 50);
        }
        closeContextMenu();
    };

    // 右键菜单 - 删除
    const handleContextMenuDelete = async () => {
        if (!contextMenu) return;
        const key = contextMenu.key;

        try {
            const storageKey = `app_rubric_content:${key}`;
            await storage.removeItem(storageKey);
            setQuestions(prev => prev.filter(q => q.key !== key));
            if (selectedKey === key) {
                setSelectedKey(null);
                setRubricText('');
                setRubricJSON(null);
            }
            toast.success('题目已删除');
        } catch (error) {
            toast.error('删除失败');
        }
        closeContextMenu();
    };

    // 删除题目
    const handleDeleteRubric = async (key: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (deletingKey === key) {
            try {
                const storageKey = `app_rubric_content:${key}`;
                await storage.removeItem(storageKey);

                setQuestions(prev => prev.filter(q => q.key !== key));

                if (selectedKey === key) {
                    setSelectedKey(null);
                    setRubricText('');
                    setRubricJSON(null);
                }

                setDeletingKey(null);
                toast.success('题目已删除');
            } catch (error) {
                toast.error('删除失败');
            }
        } else {
            setDeletingKey(key);
            setTimeout(() => {
                setDeletingKey(current => current === key ? null : current);
            }, 3000);
        }
    };

    // 重命名题目
    const startRenameQuestion = (key: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const q = questions.find(q => q.key === key);
        if (q) {
            setEditQuestionNo(q.questionNo);
            setRenamingKey(key);
            setIsEditingQuestionNo(true);
            setTimeout(() => questionNoInputRef.current?.focus(), 50);
        }
    };

    // 文件处理相关函数 (Drag & Drop, Import, Export, Save) ...
    // (逻辑保持不变，UI 触发点改变)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, imageType: 'question' | 'answer') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            setAttachedImages(prev => [
                ...prev.filter(img => img.type !== imageType),
                { name: file.name, base64, type: imageType }
            ]);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleRemoveAttachment = (imageType: 'question' | 'answer') => {
        setAttachedImages(prev => prev.filter(img => img.type !== imageType));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (!file) return;

        if (file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const content = event.target?.result as string;
                    const data = JSON.parse(content);
                    await processImportedData(data);
                } catch (error) {
                    console.error('[UnifiedRubricEditor] Drop error:', error);
                    toast.error('文件解析失败');
                }
            };
            reader.readAsText(file);
        }
    };

    const processImportedData = async (data: any) => {
        if (data.answerPoints && Array.isArray(data.answerPoints)) {
            const { setImportedRubricJSON } = await import('../services/proxyService');
            setImportedRubricJSON(data);
            const markdown = rubricJSONToMarkdown(data);
            setRubricText(markdown);
            setRubricJSON(data);
            setEditMode('form');

            const questionNo = data.questionId || '1';
            const newKey = `MANUAL:0:${questionNo}`;
            const exists = questions.find(q => q.questionNo === questionNo);

            if (!exists) {
                setQuestions(prev => [...prev, {
                    key: newKey,
                    questionNo,
                    platform: 'MANUAL',
                    rubric: markdown
                }]);
            }
            setSelectedKey(newKey);
            toast.success(`已导入评分细则`);
        } else {
            toast.error('无效的评分细则格式');
        }
    };


    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target?.result as string;
                const data = JSON.parse(content);
                await processImportedData(data);
            } catch (error) {
                toast.error('导入失败');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleExport = () => {
        if (!rubricText.trim()) {
            toast.warning('暂无可导出的评分细则');
            return;
        }
        const currentQ = questions.find(q => q.key === selectedKey);
        const exportData = {
            version: '1.0',
            exportTime: new Date().toISOString(),
            questionNo: currentQ?.questionNo || '未知',
            platform: currentQ?.platform || 'MANUAL',
            rubric: rubricText
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `评分细则_第${currentQ?.questionNo || ''}题_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleSave = async () => {
        if (!rubricText.trim()) {
            toast.warning('请先输入或生成评分细则');
            return;
        }
        if (!selectedKey) {
            toast.warning('请先选择或新建题目');
            return;
        }
        const storageKey = `app_rubric_content:${selectedKey}`;
        await storage.setItem(storageKey, rubricText);
        setQuestions(prev => prev.map(q => q.key === selectedKey ? { ...q, rubric: rubricText } : q));
        onSave(rubricText, selectedKey);
        toast.success("保存成功");
    };

    const rubricJSONToMarkdown = (json: any): string => {
        // ... (Logic kept same as before)
        // 为了精简代码，这里省略具体实现，实际应保留原有的 rubricJSONToMarkdown 逻辑
        const lines: string[] = [];
        const parts = (json.questionId || '1').split('-');
        const subQuestionNo = parts.length > 1 ? parts[parts.length - 1] : parts[0];

        lines.push(`## 第${json.questionId}题评分细则（共${json.totalScore}分）`);
        lines.push('');
        lines.push(`### (${subQuestionNo}) ${json.title}（${json.totalScore}分）`);
        lines.push('');
        lines.push('| 编号 | 答案 | 关键词 | 分值 |');
        lines.push('|------|------|------|------|');

        for (const point of json.answerPoints || []) {
            const keywords = point.keywords?.join('、') || '-';
            lines.push(`| ${point.id} | ${point.content} | ${keywords} | ${point.score}分 |`);
        }
        lines.push('');

        const strategy = json.scoringStrategy;
        if (strategy?.type === 'pick_n' && strategy.maxPoints) {
            const strictLabel = strategy.strictMode ? '【严格模式】' : '';
            lines.push(`> 📋 评分规则：${strictLabel}每点${strategy.pointValue || '?'}分，答对任意${strategy.maxPoints}点得满分（${json.totalScore}分）`);
        }
        if (json.alternativeRules) {
            lines.push(`> ⚠️ ${json.alternativeRules}`);
        }
        lines.push('');

        if (json.gradingNotes?.length > 0) {
            lines.push('### 阅卷提示');
            for (const note of json.gradingNotes) {
                lines.push(`- ${note}`);
            }
        }
        return lines.join('\n');
    };

    const handleGenerateRubric = async () => {
        // ... (Logic kept same)
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const qImg = attachedImages.find(a => a.type === 'question')?.base64 || null;
            const aImg = attachedImages.find(a => a.type === 'answer')?.base64 || null;

            if (!qImg && !aImg) {
                toast.warning('请至少上传一张图片');
                setIsProcessing(false);
                return;
            }

            const result = await generateRubricFromImages(qImg, aImg);
            setRubricJSON(result);
            setRubricText(rubricToMarkdown(result));
            setAttachedImages([]);

            if (!selectedKey) {
                const questionNo = result.questionId || String(questions.length + 1);
                const newKey = `MANUAL:0:${questionNo}`;
                const exists = questions.find(q => q.questionNo === questionNo);
                if (!exists) {
                    setQuestions(prev => [...prev, { key: newKey, questionNo, platform: 'MANUAL', rubric: '' }]);
                    setSelectedKey(newKey);
                } else {
                    setSelectedKey(exists.key);
                }
            }
            toast.success('评分细则生成成功');
        } catch (error) {
            console.error('[UnifiedRubricEditor] Generate error:', error);
            toast.error('AI 处理失败，请检查 API 连接');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAICommand = async () => {
        // ... (Logic kept same)
        if (isProcessing) return;

        setIsProcessing(true);
        try {
            if (attachedImages.length > 0) {
                const qImg = attachedImages.find(a => a.type === 'question')?.base64 || null;
                const aImg = attachedImages.find(a => a.type === 'answer')?.base64 || null;
                const result = await generateRubricFromImages(qImg, aImg);
                setRubricJSON(result);
                setRubricText(rubricToMarkdown(result));
                setAttachedImages([]);
                setAiInput('');
            }
            else if (aiInput.trim()) {
                let jsonToRefine = rubricJSON;
                if (!jsonToRefine) {
                    const { getLastGeneratedRubricJSON } = await import('../services/proxyService');
                    const proxyJSON = getLastGeneratedRubricJSON();
                    if (proxyJSON && proxyJSON.answerPoints) {
                        jsonToRefine = proxyJSON;
                        setRubricJSON(proxyJSON);
                    }
                }
                if (!jsonToRefine && rubricText.trim()) {
                    const trimmed = rubricText.trim();
                    if (trimmed.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(trimmed);
                            if (parsed.answerPoints) {
                                jsonToRefine = parsed;
                                setRubricJSON(parsed);
                            }
                        } catch { }
                    }
                }

                if (!jsonToRefine) {
                    toast.warning('请先导入或生成评分细则');
                    setIsProcessing(false);
                    return;
                }

                const result = await refineRubric(jsonToRefine, aiInput);
                setRubricJSON(result);
                setRubricText(rubricToMarkdown(result));
                setAiInput('');
                toast.success('评分细则已优化');
            } else {
                toast.warning('请输入优化建议或上传图片');
            }

        } catch (error) {
            console.error('[UnifiedRubricEditor] AI error:', error);
            const errorMessage = error instanceof Error ? error.message : 'AI 服务不可用';
            toast.error(`AI 处理失败：${errorMessage}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // 处理文本导入
    const handleTextImport = async () => {
        if (!textImportValue.trim()) {
            toast.warning('请输入参考答案文本');
            return;
        }

        setIsProcessing(true);
        try {
            const currentQ = questions.find(q => q.key === selectedKey);
            const questionId = currentQ?.questionNo || String(questions.length + 1);

            const result = await generateRubricFromText(textImportValue, questionId);
            setRubricJSON(result);
            setRubricText(rubricToMarkdown(result));

            // 如果没有选中题目，创建一个新的
            if (!selectedKey) {
                const newKey = `MANUAL:0:${result.questionId || questionId}`;
                const exists = questions.find(q => q.questionNo === (result.questionId || questionId));
                if (!exists) {
                    setQuestions(prev => [...prev, {
                        key: newKey,
                        questionNo: result.questionId || questionId,
                        platform: 'MANUAL',
                        rubric: ''
                    }]);
                    setSelectedKey(newKey);
                } else {
                    setSelectedKey(exists.key);
                }
            }

            setTextImportValue('');
            setShowTextImport(false);
            toast.success('评分细则生成成功');
        } catch (error) {
            console.error('[UnifiedRubricEditor] Text import error:', error);
            const errorMessage = error instanceof Error ? error.message : 'AI 服务不可用';
            toast.error(`生成失败：${errorMessage}`);
        } finally {
            setIsProcessing(false);
        }
    };


    if (!isOpen) return null;

    return (
        <div
            className="absolute top-0 right-0 w-full h-full bg-white dark:bg-gray-900 z-40 flex flex-col shadow-2xl animate-slide-in-right font-sans"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* 拖拽导入遮罩层 */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center border-4 border-blue-500 border-dashed m-4 rounded-2xl">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl flex flex-col items-center gap-4">
                        <Upload className="w-12 h-12 text-blue-500 animate-bounce" />
                        <span className="text-lg font-bold text-gray-700 dark:text-gray-200">释放以导入评分细则</span>
                    </div>
                </div>
            )}

            {/* 文本导入弹窗 */}
            {showTextImport && (
                <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                <Type size={16} className="text-purple-500" />
                                导入文本参考答案
                            </h3>
                            <button
                                onClick={() => { setShowTextImport(false); setTextImportValue(''); }}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 p-4 overflow-auto">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                粘贴参考答案文本,AI 将<strong className="text-purple-600">自动识别题型</strong>并生成评分细则。
                                <br />
                                <span className="inline-flex items-center gap-1 mt-1">
                                    ✓ 客观题(答案固定) ✓ 材料分析题(关键词评分) ✓ 开放性题目(合理即可) ✓ 观点论述(分层评分)
                                </span>
                            </p>
                            <textarea
                                value={textImportValue}
                                onChange={(e) => setTextImportValue(e.target.value)}
                                placeholder="示例：&#10;13. (1)伯里克利；罗马民法大全；瓦特；蒸汽机。（4分）&#10;    (2)①《神曲》（1分）②达·芬奇（1分）&#10;    意义：促进思想解放...（任意两点得2分）&#10;    (3)言之有理即可（2分）"
                                className="w-full h-48 px-3 py-2 text-xs font-mono border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => { setShowTextImport(false); setTextImportValue(''); }}
                                className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleTextImport}
                                disabled={!textImportValue.trim() || isProcessing}
                                className="px-4 py-2 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition"
                            >
                                {isProcessing ? (
                                    <>
                                        <RefreshCw size={12} className="animate-spin" />
                                        生成中...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={12} />
                                        AI 生成评分细则
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* A. 顶部导航栏 (简化版) */}
            <nav className="flex items-center justify-between px-3 h-11 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shrink-0 z-20">
                {/* 左侧：视图标题 */}
                <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">编辑</span>
                </div>

                {/* 右侧：导入 + 导出 + 保存 */}
                <div className="flex items-center gap-1.5">
                    {/* 导入下拉菜单 */}
                    <div className="relative group">
                        <button className="px-2.5 py-1.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors flex items-center gap-1">
                            <Upload size={12} />
                            导入
                        </button>
                        <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 min-w-[120px]">
                            <button
                                onClick={() => importFileInputRef.current?.click()}
                                className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                                <FileText size={12} />
                                JSON 文件
                            </button>
                            <button
                                onClick={() => setShowTextImport(true)}
                                className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                                <Type size={12} />
                                文本答案
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={!rubricText.trim()}
                        className="px-2.5 py-1.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-40"
                    >
                        导出
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!selectedKey}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-xs flex items-center gap-1.5 shadow-sm shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                        保存
                    </button>
                </div>
            </nav>

            {/* 横向标签页导航 (Horizontal Tabs) */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 overflow-x-auto scrollbar-hide">
                {questions.map(q => (
                    <button
                        key={q.key}
                        onClick={() => handleSelectQuestion(q.key)}
                        onContextMenu={(e) => handleTabContextMenu(e, q.key)}
                        className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-all ${selectedKey === q.key
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:text-blue-600'
                            }`}
                    >
                        {q.questionNo}
                    </button>
                ))}

                {/* 内联输入框或添加按钮 */}
                {isEditingQuestionNo ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                        <input
                            ref={questionNoInputRef}
                            type="text"
                            value={editQuestionNo}
                            onChange={(e) => setEditQuestionNo(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmEditQuestionNo();
                                if (e.key === 'Escape') handleCancelEditQuestionNo();
                            }}
                            placeholder="题号"
                            className="w-16 px-2.5 py-1.5 text-xs font-medium border-2 border-blue-400 rounded-full focus:ring-2 focus:ring-blue-500/20 outline-none bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                        />
                        <button
                            onClick={handleConfirmEditQuestionNo}
                            className="w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm"
                            title="确认"
                        >
                            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleStartCreateQuestion}
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                        title="新增题目"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* 右键菜单 */}
            {contextMenu && (
                <>
                    {/* 遮罩层 - 点击关闭菜单 */}
                    <div className="fixed inset-0 z-50" onClick={closeContextMenu} />
                    {/* 菜单本体 */}
                    <div
                        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[120px] animate-in fade-in zoom-in-95 duration-100"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                        <button
                            onClick={handleContextMenuRename}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                            重命名
                        </button>
                        <button
                            onClick={handleContextMenuDelete}
                            className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                        </button>
                    </div>
                </>
            )}

            {/* 遮罩 */}
            {isDrawerOpen && (
                <div
                    className="absolute inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity"
                    onClick={() => setIsDrawerOpen(false)}
                ></div>
            )}
            {/* 抽屉内容 */}
            <div className={`absolute top-0 bottom-0 left-0 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-40 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200">题号列表</h3>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleStartCreateQuestion}
                            className="p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors"
                            title="新增题目"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button onClick={() => setIsDrawerOpen(false)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {questions.map(q => (
                        <button
                            key={q.key}
                            onClick={() => handleSelectQuestion(q.key)}
                            className={`group w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${selectedKey === q.key
                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                        >
                            <span className="truncate flex-1">第 {q.questionNo} 题</span>

                            <div className={`flex items-center gap-1 ${deletingKey === q.key ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                <div
                                    onClick={(e) => startRenameQuestion(q.key, e)}
                                    className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded transition cursor-pointer"
                                    title="重命名"
                                >
                                    <Edit2 className="w-3.5 h-3.5 opacity-70" />
                                </div>
                                <div
                                    onClick={(e) => handleDeleteRubric(q.key, e)}
                                    className={`p-1 rounded transition cursor-pointer ${deletingKey === q.key ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600'}`}
                                    title={deletingKey === q.key ? "确认删除?" : "删除"}
                                >
                                    <Trash2 className={`w-3.5 h-3.5 ${deletingKey === q.key ? 'fill-current' : 'opacity-70'}`} />
                                </div>
                            </div>

                            {(selectedKey === q.key && deletingKey !== q.key) && <ChevronRight className="w-4 h-4 opacity-50 group-hover:hidden" />}
                        </button>
                    ))}
                </div>

                <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                    {isEditingQuestionNo ? (
                        <div className="flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
                            <input
                                ref={questionNoInputRef}
                                type="text"
                                value={editQuestionNo}
                                onChange={(e) => setEditQuestionNo(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleConfirmEditQuestionNo();
                                    if (e.key === 'Escape') handleCancelEditQuestionNo();
                                }}
                                placeholder="输入新题号"
                                className="flex-1 h-9 px-3 text-sm rounded-lg border border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none"
                            />
                            <button onClick={handleConfirmEditQuestionNo} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                <Check className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleStartCreateQuestion}
                            className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            新增题目
                        </button>
                    )}
                </div>
            </div>



            {/* D. 主内容区 (Main Content, Scrollable) */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative bg-gray-50 dark:bg-gray-900">
                {/* 1. 文件生成提示 (如果有图片附件) */}
                {(attachedImages.length > 0) && (
                    <div className="m-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                                待处理图片 ({attachedImages.length})
                            </span>
                            <button
                                onClick={() => setAttachedImages([])}
                                className="text-gray-400 hover:text-red-500"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {attachedImages.map((img, idx) => (
                                <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                                    <img src={`data:image/jpeg;base64,${img.base64}`} className="w-full h-full object-cover" />
                                    <span className="absolute bottom-0 w-full bg-black/50 text-white text-[10px] text-center">{img.type === 'question' ? '试题' : '答案'}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={handleGenerateRubric}
                            disabled={isProcessing}
                            className="w-full py-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-bold rounded-lg shadow-md hover:brightness-110 flex items-center justify-center gap-1.5"
                        >
                            {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            生成评分细则
                        </button>
                    </div>
                )}

                {/* 2. 编辑器内容 */}
                <div className="h-full pb-16"> {/* 底部留白给固定栏 */}
                    <RubricFormEditor
                        initialData={rubricJSON}
                        questionId={questions.find(q => q.key === selectedKey)?.questionNo}
                        onSave={(saved) => {
                            setRubricJSON(saved);
                            setRubricText(rubricToMarkdown(saved));
                            handleSave();
                        }}
                    />
                </div>
            </div>

            {/* E. 底部悬浮 AI 操作栏 (Sticky Bottom) */}
            <div className="absolute bottom-4 left-3 right-3 z-20">
                <div className="flex items-center gap-2 p-1.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/50 transition-transform hover:-translate-y-1">
                    <div className="pl-2.5">
                        <Wand2 className="w-4 h-4 text-purple-600 animate-pulse" />
                    </div>
                    <input
                        type="text"
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && aiInput.trim() && !isProcessing && handleAICommand()}
                        placeholder="✨ AI 优化选中内容..."
                        className="flex-1 bg-transparent text-xs text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none h-8"
                        disabled={!rubricText.trim() || isProcessing}
                    />
                    <button
                        onClick={handleAICommand}
                        disabled={isProcessing || !aiInput.trim()}
                        className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${isProcessing || !aiInput.trim()
                            ? 'bg-gray-100 text-gray-300 dark:bg-gray-700'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                            }`}
                    >
                        {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {/* 隐藏的文件输入 */}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'question')} />
            <input type="file" ref={answerFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'answer')} />
            <input type="file" ref={importFileInputRef} className="hidden" accept=".json" onChange={handleImport} />

        </div>
    );
};

export default UnifiedRubricEditor;
