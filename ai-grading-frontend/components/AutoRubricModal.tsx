import React from 'react';
import { Sparkles, X, Edit3, Check, Loader2 } from 'lucide-react';

interface AutoRubricModalProps {
    isOpen: boolean;
    isLoading: boolean;
    questionNo: string;
    rubricContent: string;
    onConfirm: () => void;
    onEdit: () => void;
    onSkip: () => void;
}

const AutoRubricModal: React.FC<AutoRubricModalProps> = ({
    isOpen,
    isLoading,
    questionNo,
    rubricContent,
    onConfirm,
    onEdit,
    onSkip
}) => {
    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-3" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[340px] overflow-hidden flex flex-col max-h-[90%]">
                {/* 头部 */}
                <div className="bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700 px-4 py-4 text-center shrink-0">
                    <div className="w-10 h-10 mx-auto mb-2 bg-white/20 rounded-full flex items-center justify-center">
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                        ) : (
                            <Sparkles className="w-5 h-5 text-white" />
                        )}
                    </div>
                    <h3 className="text-white font-bold text-base">
                        {isLoading ? 'AI 正在生成评分细则...' : `第${questionNo}题评分细则`}
                    </h3>
                    <p className="text-purple-100/80 text-xs mt-1">
                        {isLoading ? '请稍候，正在分析题目内容' : 'AI 已自动生成，请审核确认'}
                    </p>
                </div>

                {/* 内容预览区 */}
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-4">
                                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                            </div>
                            <p className="text-sm text-gray-500">正在识别题目并生成评分标准...</p>
                        </div>
                    ) : (
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-[200px] overflow-y-auto">
                                {rubricContent || '未能生成评分细则，请手动配置'}
                            </pre>
                        </div>
                    )}
                </div>

                {/* 操作按钮 */}
                {!isLoading && (
                    <div className="p-4 pt-2 border-t border-gray-100 shrink-0">
                        <div className="flex gap-2">
                            <button
                                onClick={onSkip}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                            >
                                <X className="w-3.5 h-3.5" />
                                跳过
                            </button>
                            <button
                                onClick={onEdit}
                                className="flex-1 py-2.5 rounded-xl border border-purple-200 text-purple-600 text-xs font-medium hover:bg-purple-50 transition-colors flex items-center justify-center gap-1"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                编辑
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={!rubricContent}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-500/30 hover:from-purple-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                            >
                                <Check className="w-3.5 h-3.5" />
                                确认
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AutoRubricModal;
