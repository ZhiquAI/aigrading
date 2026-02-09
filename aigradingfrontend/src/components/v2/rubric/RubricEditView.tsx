import React, { useState, useMemo } from 'react';
import {
    Plus,
    Upload,
    FileText,
    Sparkles,
    ChevronDown,
    X
} from 'lucide-react';
import { clsx } from 'clsx';
import StickyHeader from './StickyHeader';
import StickyFooter from './StickyFooter';
import AccordionCard, { ScorePoint } from './AccordionCard';

type ViewState = 'upload' | 'review';

interface RubricEditViewProps {
    /** 初始状态: 'upload' = 极简上传区, 'review' = 审核列表 */
    initialState?: ViewState;
    /** 初始得分点列表 */
    initialPoints?: ScorePoint[];
    /** 返回上一页回调 */
    onBack?: () => void;
    /** 保存回调 */
    onSave?: (points: ScorePoint[]) => void;
    /** AI 生成回调 (上传图片后触发) */
    onGenerate?: (questionImage?: File, answerImage?: File) => void;
    /** 查看原图回调 */
    onViewSource?: () => void;
}

/**
 * RubricEditView - 评分细则编辑视图 (Chrome Side Panel 适配版)
 * 
 * 核心设计:
 * 1. 状态 A: 极简上传区 (Drop Zone) - 上传试题+答案，AI 生成
 * 2. 状态 B: 审核列表 (Review Stream) - 手风琴卡片编辑
 */
const RubricEditView: React.FC<RubricEditViewProps> = ({
    initialState = 'upload',
    initialPoints = [],
    onBack,
    onSave,
    onGenerate,
    onViewSource
}) => {
    const [viewState, setViewState] = useState<ViewState>(initialState);
    const [scorePoints, setScorePoints] = useState<ScorePoint[]>(
        initialPoints.length > 0
            ? initialPoints
            : [
                // Demo data for development preview
                {
                    id: '1',
                    title: '科技投入',
                    score: 2,
                    snippet: '"...政府加大财政资金支持，重点投向高新技术产业研发领域..."',
                    keywords: ['资金', '投入', '资源'],
                    isRequired: true
                },
                {
                    id: '2',
                    title: '产学研融合',
                    score: 2,
                    snippet: '"建立高校与企业联合实验室，加速科技成果转化。"',
                    keywords: ['高校', '实验室'],
                    isRequired: false
                },
                {
                    id: '3',
                    title: '国际合作',
                    score: 2,
                    snippet: '"积极参与国际大科学计划，引进国外先进技术。"',
                    keywords: ['国际', '技术'],
                    isRequired: false
                }
            ]
    );
    const [expandedId, setExpandedId] = useState<string | null>(scorePoints[0]?.id || null);
    const [isSaving, setIsSaving] = useState(false);
    const [questionImage, setQuestionImage] = useState<File | null>(null);
    const [answerImage, setAnswerImage] = useState<File | null>(null);

    const totalScore = useMemo(
        () => scorePoints.reduce((acc, curr) => acc + curr.score, 0),
        [scorePoints]
    );

    const handleToggle = (id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    };

    const handleChange = (id: string, updates: Partial<ScorePoint>) => {
        setScorePoints((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
        );
    };

    const handleDelete = (id: string) => {
        setScorePoints((prev) => prev.filter((p) => p.id !== id));
        if (expandedId === id) {
            setExpandedId(null);
        }
    };

    const handleAddKeyword = (id: string, keyword: string) => {
        setScorePoints((prev) =>
            prev.map((p) =>
                p.id === id
                    ? { ...p, keywords: [...p.keywords, keyword] }
                    : p
            )
        );
    };

    const handleRemoveKeyword = (id: string, keyword: string) => {
        setScorePoints((prev) =>
            prev.map((p) =>
                p.id === id
                    ? { ...p, keywords: p.keywords.filter((k) => k !== keyword) }
                    : p
            )
        );
    };

    const handleAddPoint = () => {
        const newId = `point-${Date.now()}`;
        const newPoint: ScorePoint = {
            id: newId,
            title: '新得分点',
            score: 1,
            keywords: [],
            isRequired: false
        };
        setScorePoints((prev) => [...prev, newPoint]);
        setExpandedId(newId);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave?.(scorePoints);
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerate = () => {
        onGenerate?.(questionImage || undefined, answerImage || undefined);
        // For demo, switch to review state
        setViewState('review');
    };

    // --- 状态 A: 极简上传区 (The Drop Zone) ---
    if (viewState === 'upload') {
        return (
            <div className="flex flex-col h-full bg-[#F3F4F6] font-sans overflow-hidden">
                {/* Header */}
                <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-gray-800">创建评分细则</h1>
                    </div>
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    )}
                </header>

                {/* Info Bar */}
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                    <p className="text-xs font-medium text-blue-600">
                        历史 / 九年级 / 简答题
                    </p>
                </div>

                {/* Upload Areas */}
                <div className="flex-1 p-6 space-y-6 flex flex-col items-center justify-center overflow-y-auto">
                    <div className="w-full max-w-sm space-y-4">
                        {/* Upload Question */}
                        <label className="group relative flex flex-col items-center justify-center p-8 bg-white border-2 border-dashed border-gray-300 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer">
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => setQuestionImage(e.target.files?.[0] || null)}
                            />
                            <div
                                className={clsx(
                                    'p-3 rounded-full group-hover:scale-110 transition-transform',
                                    questionImage ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500'
                                )}
                            >
                                <FileText className="w-8 h-8" />
                            </div>
                            <p className="mt-4 font-bold text-gray-700">
                                {questionImage ? questionImage.name : '上传试题'}
                            </p>
                            <p className="text-sm text-gray-400">
                                {questionImage ? '点击更换' : '支持拍照或本地上传'}
                            </p>
                        </label>

                        {/* Upload Answer */}
                        <label className="group relative flex flex-col items-center justify-center p-8 bg-white border-2 border-dashed border-gray-300 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer">
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => setAnswerImage(e.target.files?.[0] || null)}
                            />
                            <div
                                className={clsx(
                                    'p-3 rounded-full group-hover:scale-110 transition-transform',
                                    answerImage ? 'bg-green-50 text-green-500' : 'bg-green-50 text-green-500'
                                )}
                            >
                                <Upload className="w-8 h-8" />
                            </div>
                            <p className="mt-4 font-bold text-gray-700">
                                {answerImage ? answerImage.name : '上传答案'}
                            </p>
                            <p className="text-sm text-gray-400">
                                {answerImage ? '点击更换' : '手写答案需清晰可辨'}
                            </p>
                        </label>
                    </div>

                    {/* AI Action */}
                    <button
                        onClick={handleGenerate}
                        className="w-full max-w-sm mt-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all transform active:scale-95"
                    >
                        <Sparkles className="w-5 h-5" />
                        ✨ AI 生成细则
                    </button>
                </div>
            </div>
        );
    }

    // --- 状态 B: 审核列表 (The Review Stream) ---
    return (
        <div className="flex flex-col h-full bg-[#F3F4F6] font-sans overflow-hidden">
            {/* Sticky Header */}
            <StickyHeader
                totalScore={totalScore}
                currentScore={totalScore}
                onBack={() => (onBack ? onBack() : setViewState('upload'))}
                onViewSource={onViewSource}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                {/* Strategy Selector */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between text-sm">
                    <span className="text-gray-500 font-medium">评分策略:</span>
                    <div className="flex items-center gap-1 text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md">
                        采点得分模式
                        <ChevronDown className="w-4 h-4" />
                    </div>
                </div>

                {/* Score Point Cards */}
                <div className="space-y-3">
                    {scorePoints.map((point, index) => (
                        <AccordionCard
                            key={point.id}
                            point={point}
                            index={index}
                            isExpanded={expandedId === point.id}
                            onToggle={() => handleToggle(point.id)}
                            onChange={(updates) => handleChange(point.id, updates)}
                            onDelete={() => handleDelete(point.id)}
                            onAddKeyword={(kw) => handleAddKeyword(point.id, kw)}
                            onRemoveKeyword={(kw) => handleRemoveKeyword(point.id, kw)}
                        />
                    ))}

                    {/* Add Point Button */}
                    <button
                        onClick={handleAddPoint}
                        className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold flex items-center justify-center gap-2 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        添加得分点
                    </button>

                    {/* Deduction Rules */}
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100 space-y-3 shadow-sm">
                        <h3 className="text-sm font-bold text-red-600 flex items-center gap-2 uppercase tracking-wide">
                            ⚠️ 扣分规则
                        </h3>
                        <div className="flex items-center justify-between px-3 py-2.5 bg-white border border-red-100 rounded-lg shadow-sm">
                            <span className="text-sm font-medium text-gray-700">
                                错别字 (0.5/处)
                            </span>
                            <button className="text-xs font-bold text-blue-500 hover:underline">
                                编辑
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Sticky Footer */}
            <StickyFooter onSave={handleSave} isSaving={isSaving} />
        </div>
    );
};

export default RubricEditView;
