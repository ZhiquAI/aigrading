import React from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';

export interface EditablePoint {
    id: string;
    content: string;
    score: string;
    keywords: string;
}

interface SequentialLogicEditorProps {
    steps: EditablePoint[];
    requireOrder: boolean;
    onToggleOrder: (value: boolean) => void;
    onChange: (index: number, field: keyof EditablePoint, value: string) => void;
    onAdd: () => void;
    onRemove: (index: number) => void;
}

export default function SequentialLogicEditor({
    steps,
    requireOrder,
    onToggleOrder,
    onChange,
    onAdd,
    onRemove
}: SequentialLogicEditorProps) {
    return (
        <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                    <div className="text-[10px] font-bold text-slate-600">步骤顺序要求</div>
                    <div className="text-[9px] text-slate-400">严格按步骤出现，缺失前置步骤可触发复核</div>
                </div>
                <label className="flex items-center gap-2 text-[10px] text-slate-600">
                    <input
                        type="checkbox"
                        checked={requireOrder}
                        onChange={(e) => onToggleOrder(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-500"
                    />
                    严格顺序
                </label>
            </div>

            {steps.length === 0 && (
                <div className="text-[11px] text-slate-400 text-center py-6 bg-white rounded-xl border border-slate-200">
                    暂无步骤，可先生成评分细则
                </div>
            )}

            {steps.map((row, index) => (
                <details key={`${row.id}-${index}`} className="group bg-white rounded-xl border border-slate-200">
                    <summary className="list-none px-3 py-2.5 flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">Step {index + 1}</span>
                            <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[180px]">
                                {row.content || '未命名步骤'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-600">{row.score || 0}分</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition-transform" />
                        </div>
                    </summary>
                    <div className="px-3 pb-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[9px] font-medium text-slate-500">ID</label>
                                <input
                                    value={row.id}
                                    onChange={(e) => onChange(index, 'id', e.target.value)}
                                    className="w-full h-7 px-2 rounded-lg border border-slate-200 text-[10px]"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-medium text-slate-500">分值</label>
                                <input
                                    value={row.score}
                                    onChange={(e) => onChange(index, 'score', e.target.value)}
                                    className="w-full h-7 px-2 rounded-lg border border-slate-200 text-[10px]"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[9px] font-medium text-slate-500">步骤内容</label>
                            <input
                                value={row.content}
                                onChange={(e) => onChange(index, 'content', e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[10px]"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-medium text-slate-500">关键词（逗号分隔）</label>
                            <input
                                value={row.keywords}
                                onChange={(e) => onChange(index, 'keywords', e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[10px]"
                            />
                        </div>
                        <button
                            onClick={() => onRemove(index)}
                            className="w-full h-8 rounded-lg border border-dashed border-red-200 text-[10px] text-red-500 hover:bg-red-50 flex items-center justify-center gap-1"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除该步骤
                        </button>
                    </div>
                </details>
            ))}

            <button
                onClick={onAdd}
                className="w-full h-9 rounded-xl border border-dashed border-slate-200 text-[11px] text-slate-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/40 transition-colors flex items-center justify-center gap-2"
            >
                <Plus className="w-4 h-4" />
                新增步骤
            </button>
        </div>
    );
}
