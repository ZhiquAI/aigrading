/**
 * AIRubricEditor - AI 驱动的评分细则编辑器
 * 包含得分点表格 + AI 对话面板
 */
import React, { useState, useRef, useEffect } from 'react';
import {
    ChevronLeft,
    Send,
    Sparkles,
    Save,
    RotateCcw,
    Trash2,
    Edit3,
    Check,
    X as XIcon
} from 'lucide-react';
import { toast } from '@/components/Toast';
import { refineRubric } from '@/services/rubric-service';
import type {
    RubricJSONV3,
    PointAccumulationContent,
    SequentialLogicContent,
    RubricMatrixContent
} from '@/types/rubric-v3';

interface RubricPoint {
    id: string;
    content: string;
    score: number;
    keywords: string[];
}

interface ChatMessage {
    id: string;
    role: 'ai' | 'user';
    content: string;
    timestamp: Date;
}

interface AIRubricEditorProps {
    questionKey: string;
    initialPoints?: RubricPoint[];
    onBack: () => void;
    onSave: (points: RubricPoint[]) => void;
}

const AIRubricEditor: React.FC<AIRubricEditorProps> = ({
    questionKey,
    initialPoints = [],
    onBack,
    onSave
}) => {
    // State
    const [points, setPoints] = useState<RubricPoint[]>(initialPoints.length > 0 ? initialPoints : [
        { id: '1', content: '一战爆发根本原因', score: 4, keywords: ['帝国主义', '不平衡'] },
        { id: '2', content: '萨拉热窝事件影响', score: 4, keywords: ['导火索', '宣战'] },
        { id: '3', content: '卷面书写规范', score: 2, keywords: ['工整', '分条'] },
    ]);

    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            role: 'ai',
            content: '已为您生成初步细则。您可以直接通过对话进行修改。',
            timestamp: new Date()
        }
    ]);

    const [inputValue, setInputValue] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [editingPointId, setEditingPointId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // 自动滚动到底部
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // 调用真实 AI 服务进行优化
    const handleAIRefine = async (userMessage: string) => {
        setIsThinking(true);

        try {
            // 将当前 points 转换为 RubricJSON v3 格式
            const currentRubric: RubricJSONV3 = {
                version: '3.0',
                metadata: {
                    questionId: questionKey,
                    title: questionKey
                },
                strategyType: 'point_accumulation',
                content: {
                    scoringStrategy: {
                        type: 'all',
                        allowAlternative: false,
                        strictMode: false
                    },
                    points: points.map((point) => ({
                        id: point.id,
                        content: point.content,
                        keywords: point.keywords,
                        score: point.score
                    })),
                    totalScore: points.reduce((sum, point) => sum + point.score, 0)
                },
                constraints: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // 调用 AI 优化服务
            const refinedRubric = await refineRubric(currentRubric, userMessage);

            // 更新得分点
            let rawPoints: any[] = [];
            let total = 0;

            if (refinedRubric.strategyType === 'sequential_logic') {
                const content = refinedRubric.content as SequentialLogicContent;
                rawPoints = content.steps;
                total = refinedRubric.content.totalScore || content.steps.reduce((sum, point) => sum + point.score, 0);
            } else if (refinedRubric.strategyType === 'point_accumulation') {
                const content = refinedRubric.content as PointAccumulationContent;
                rawPoints = content.points;
                total = refinedRubric.content.totalScore || content.points.reduce((sum, point) => sum + point.score, 0);
            } else if (refinedRubric.strategyType === 'rubric_matrix') {
                const content = refinedRubric.content as RubricMatrixContent;
                rawPoints = content.dimensions.map((dimension, index) => ({
                    id: dimension.id || `dim-${index + 1}`,
                    content: dimension.name,
                    score: dimension.weight || Math.max(...dimension.levels.map((level) => level.score)),
                    keywords: [] as string[]
                }));
                total = refinedRubric.content.totalScore || content.dimensions.reduce((sum, dim) => sum + (dim.weight || 0), 0);
            }

            const newPoints: RubricPoint[] = rawPoints.map((point) => ({
                id: point.id,
                content: point.content,
                score: point.score,
                keywords: point.keywords || []
            }));

            setPoints(newPoints);

            // 生成 AI 回复
            const changeCount = Math.abs(newPoints.length - points.length);
            let response = '已根据您的建议更新评分细则。';
            if (newPoints.length > points.length) {
                response += ` 新增了 ${changeCount} 个得分点。`;
            } else if (newPoints.length < points.length) {
                response += ` 减少了 ${changeCount} 个得分点。`;
            }
            response += ` 当前总分: ${total}分。`;

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                content: response,
                timestamp: new Date()
            }]);

        } catch (error) {
            console.error('[AIRubricEditor] refineRubric failed:', error);
            const errorMessage = error instanceof Error ? error.message : '服务暂时不可用';

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                content: `抱歉，优化失败：${errorMessage}。您可以手动编辑表格中的得分点。`,
                timestamp: new Date()
            }]);

            toast.error('AI 优化失败');
        } finally {
            setIsThinking(false);
        }
    };

    const handleSend = () => {
        if (!inputValue.trim() || isThinking) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');

        handleAIRefine(userMessage.content);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleEditPoint = (point: RubricPoint) => {
        setEditingPointId(point.id);
        setEditingContent(point.content);
    };

    const handleSavePointEdit = () => {
        if (!editingPointId) return;
        setPoints(prev => prev.map(p =>
            p.id === editingPointId ? { ...p, content: editingContent } : p
        ));
        setEditingPointId(null);
        setEditingContent('');
    };

    const handleDeletePoint = (id: string) => {
        setPoints(prev => prev.filter(p => p.id !== id));
        toast.success('已删除得分点');
    };

    const handleSaveAll = () => {
        onSave(points);
        toast.success('评分细则已保存');
    };

    const totalScore = points.reduce((sum, p) => sum + p.score, 0);

    return (
        <div className="flex flex-col h-full bg-bg-app">
            {/* Header */}
            <header className="bg-white px-4 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-border shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-bg-app text-text-body hover:bg-border transition-colors border border-border"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                        <h2 className="text-sm font-black text-text-main truncate">AI 细则编辑器</h2>
                        <div className="flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-success rounded-full" />
                            <p className="text-[10px] text-text-body font-bold truncate tracking-tight">{questionKey}</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSaveAll}
                        className="px-3 py-1.5 bg-primary text-white text-[11px] font-black rounded-lg shadow-sm shadow-primary/20 flex items-center gap-1 active:scale-95 transition-all"
                    >
                        <Save className="w-3.5 h-3.5" />
                        保存
                    </button>
                </div>
            </header>

            {/* Content Area - Scrollable Points */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24 scrollbar-thin">
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                        采分点明细 ({points.length})
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-border text-[11px] font-black text-primary shadow-sm">
                        总计 {totalScore}分
                    </span>
                </div>

                {points.map((point, index) => (
                    <div
                        key={point.id}
                        className="bg-white rounded-2xl p-4 shadow-sm border border-border hover:border-primary/30 transition-all group relative"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-xl bg-bg-app text-text-muted text-[11px] font-black flex items-center justify-center shrink-0 border border-border">
                                {index + 1}
                            </div>

                            <div className="flex-1 min-w-0">
                                {editingPointId === point.id ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={editingContent}
                                            onChange={(e) => setEditingContent(e.target.value)}
                                            className="w-full px-3 py-2 border-2 border-primary bg-primary-subtle/20 rounded-xl text-sm font-bold outline-none leading-relaxed min-h-[60px]"
                                            autoFocus
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={() => setEditingPointId(null)}
                                                className="px-3 py-1.5 rounded-lg bg-bg-app text-text-body text-[10px] font-bold border border-border"
                                            >
                                                取消
                                            </button>
                                            <button
                                                onClick={handleSavePointEdit}
                                                className="px-3 py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold shadow-sm"
                                            >
                                                确认修改
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div onClick={() => handleEditPoint(point)} className="cursor-text">
                                        <p className="text-sm font-bold text-text-main leading-relaxed">
                                            {point.content}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                                            {point.keywords.map((kw, i) => (
                                                <span
                                                    key={i}
                                                    className="px-1.5 py-0.5 bg-slate-50 text-text-muted text-[9px] font-bold rounded border border-border-subtle"
                                                >
                                                    {kw}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="text-right shrink-0 ml-2">
                                <div className="text-primary font-black text-base italic leading-none">
                                    {point.score}
                                    <span className="text-[10px] ml-0.5">分</span>
                                </div>
                            </div>
                        </div>

                        {/* Point Actions - Floating */}
                        {!editingPointId && (
                            <div className="absolute -top-2 -right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                <button
                                    onClick={() => handleEditPoint(point)}
                                    className="w-7 h-7 rounded-lg bg-white shadow-md border border-border text-text-body hover:text-primary flex items-center justify-center transition-colors"
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleDeletePoint(point.id)}
                                    className="w-7 h-7 rounded-lg bg-white shadow-md border border-border text-text-body hover:text-danger flex items-center justify-center transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                {points.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-text-muted opacity-40 italic">
                        <RotateCcw className="w-8 h-8" />
                        <p className="text-xs font-bold">暂无得分点，请使用 AI 生成或对话添加</p>
                    </div>
                )}
            </div>

            {/* AI Control Center - Sticky Bottom */}
            <div className="bg-ai-bg p-4 pb-6 rounded-t-[32px] shadow-[0_-8px_30px_rgba(30,27,75,0.25)] shrink-0 animate-slide-up border-t border-white/5">
                {/* AI Status Indicator */}
                <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-6 h-6 rounded-lg bg-ai-gradient flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">AI Refinement Box</span>
                    <div className="flex-1 h-px bg-white/5 mx-2" />
                    {isThinking && (
                        <div className="flex gap-1">
                            <span className="w-1 h-1 bg-primary rounded-full animate-ping" />
                        </div>
                    )}
                </div>

                {/* Chat Display (Minimized concept) */}
                <div
                    ref={chatContainerRef}
                    className="max-h-24 overflow-y-auto space-y-2.5 mb-3 px-1 scrollbar-thin scrollbar-thumb-white/10"
                >
                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            <div className={`rounded-2xl px-3 py-2 text-[11px] leading-relaxed shadow-sm ${msg.role === 'ai'
                                ? 'bg-white/10 text-white/90 rounded-tl-none border border-white/5'
                                : 'bg-primary rounded-tr-none text-white font-bold'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}

                    {isThinking && (
                        <div className="flex gap-2">
                            <div className="bg-white/5 rounded-2xl rounded-tl-none px-4 py-2 border border-white/5">
                                <div className="flex gap-1.5 items-center">
                                    <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Futuristic Input Bar */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-ai-gradient rounded-[20px] blur opacity-20 group-focus-within:opacity-40 transition-opacity" />
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="优化指令：如「把第2点分值改为3分」..."
                            className="w-full pl-5 pr-14 py-3.5 bg-white/10 border border-white/10 rounded-[18px] text-[11px] font-medium text-white placeholder:text-white/30 focus:bg-white/15 outline-none transition-all"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim() || isThinking}
                            className={`absolute right-2 top-2 bottom-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${inputValue.trim() && !isThinking
                                ? 'bg-white text-ai-bg shadow-lg shadow-white/10 scale-100 active:scale-90'
                                : 'bg-white/5 text-white/20 scale-95 cursor-not-allowed border border-white/5'
                                }`}
                        >
                            <Send className="w-4.5 h-4.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIRubricEditor;
