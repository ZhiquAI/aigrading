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
import type { RubricJSONV3 } from '@/types/rubric-v3';

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
            const rawPoints = refinedRubric.strategyType === 'sequential_logic'
                ? refinedRubric.content.steps
                : refinedRubric.strategyType === 'point_accumulation'
                    ? refinedRubric.content.points
                    : refinedRubric.content.dimensions.map((dimension, index) => ({
                        id: dimension.id || `dim-${index + 1}`,
                        content: dimension.name,
                        score: dimension.weight || Math.max(...dimension.levels.map((level) => level.score)),
                        keywords: [] as string[]
                    }));

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
            const total = refinedRubric.strategyType === 'rubric_matrix'
                ? refinedRubric.content.totalScore
                    || refinedRubric.content.dimensions.reduce((sum, dim) => sum + (dim.weight || 0), 0)
                : refinedRubric.strategyType === 'sequential_logic'
                    ? refinedRubric.content.totalScore
                        || refinedRubric.content.steps.reduce((sum, point) => sum + point.score, 0)
                    : refinedRubric.content.totalScore
                        || refinedRubric.content.points.reduce((sum, point) => sum + point.score, 0);
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
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <header className="bg-white px-4 pt-6 pb-3 flex items-center justify-between shrink-0 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">AI 编辑器</h2>
                        <p className="text-[10px] text-slate-400">{questionKey}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-400">AI 已就绪</span>
                </div>
            </header>

            {/* Table Area */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    {/* Table Header */}
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            得分点列表
                        </span>
                        <span className="text-xs font-bold text-primary">
                            总分: {totalScore}分
                        </span>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-slate-50">
                        {points.map((point, index) => (
                            <div
                                key={point.id}
                                className="px-4 py-3 flex items-center gap-3 hover:bg-primary-subtle/30 transition-colors group"
                            >
                                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0">
                                    {index + 1}
                                </span>

                                <div className="flex-1 min-w-0">
                                    {editingPointId === point.id ? (
                                        <input
                                            type="text"
                                            value={editingContent}
                                            onChange={(e) => setEditingContent(e.target.value)}
                                            className="w-full px-2 py-1 border border-primary rounded-lg text-sm outline-none"
                                            autoFocus
                                        />
                                    ) : (
                                        <p className="text-sm font-medium text-slate-700 truncate">
                                            {point.content}
                                        </p>
                                    )}
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                        {point.keywords.map((kw, i) => (
                                            <span
                                                key={i}
                                                className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] rounded"
                                            >
                                                {kw}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <span className="text-primary font-black text-sm shrink-0">
                                    {point.score}分
                                </span>

                                {/* Actions */}
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {editingPointId === point.id ? (
                                        <>
                                            <button
                                                onClick={handleSavePointEdit}
                                                className="w-6 h-6 rounded-lg bg-success text-white flex items-center justify-center"
                                            >
                                                <Check className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => setEditingPointId(null)}
                                                className="w-6 h-6 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center"
                                            >
                                                <XIcon className="w-3 h-3" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleEditPoint(point)}
                                                className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center"
                                            >
                                                <Edit3 className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => handleDeletePoint(point.id)}
                                                className="w-6 h-6 rounded-lg bg-danger-subtle text-danger hover:bg-danger hover:text-white flex items-center justify-center transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* AI Chat Panel */}
            <div className="bg-indigo-950 p-4 rounded-t-[32px] shadow-[0_-10px_40px_rgba(30,27,75,0.15)] shrink-0">
                {/* Chat Messages */}
                <div
                    ref={chatContainerRef}
                    className="max-h-32 overflow-y-auto space-y-2.5 mb-3 px-1 scrollbar-thin scrollbar-thumb-white/10"
                >
                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            {msg.role === 'ai' && (
                                <div className="w-5 h-5 rounded-full bg-brand-gradient flex items-center justify-center shrink-0">
                                    <Sparkles className="w-2.5 h-2.5 text-white" />
                                </div>
                            )}
                            <div className={`rounded-2xl px-3 py-2 text-[11px] leading-relaxed max-w-[85%] ${msg.role === 'ai'
                                ? 'bg-white/10 text-white/90 rounded-tl-none'
                                : 'bg-primary rounded-tr-none text-white'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}

                    {isThinking && (
                        <div className="flex gap-2">
                            <div className="w-5 h-5 rounded-full bg-brand-gradient flex items-center justify-center shrink-0">
                                <Sparkles className="w-2.5 h-2.5 text-white animate-pulse" />
                            </div>
                            <div className="bg-white/10 rounded-2xl rounded-tl-none px-3 py-2">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="试着说：把第2点拆成两个得分点..."
                        className="w-full pl-4 pr-12 py-3 bg-white/10 border border-white/10 rounded-2xl text-[11px] text-white placeholder-white/40 focus:bg-white/15 outline-none transition-all"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isThinking}
                        className={`absolute right-2 top-2 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${inputValue.trim() && !isThinking
                            ? 'bg-white text-indigo-950 active:scale-95'
                            : 'bg-white/20 text-white/40 cursor-not-allowed'
                            }`}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSaveAll}
                    className="w-full mt-3 py-3 bg-white text-indigo-950 font-bold rounded-2xl active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2"
                >
                    <Save className="w-4 h-4" />
                    保存并完成
                </button>
            </div>
        </div>
    );
};

export default AIRubricEditor;
