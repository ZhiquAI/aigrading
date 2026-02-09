import React from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';

export interface EditablePoint {
    id: string;
    content: string;
    score: string;
    keywords: string;
}

interface PointAccumulationEditorProps {
    points: EditablePoint[];
    onChange: (index: number, field: keyof EditablePoint, value: string) => void;
    onAdd: () => void;
    onRemove: (index: number) => void;
}

export default function PointAccumulationEditor({
    points,
    onChange,
    onAdd,
    onRemove
}: PointAccumulationEditorProps) {
    return (
        <div className="space-y-3">
            {points.length === 0 && (
                <div className="text-[11px] text-slate-400 text-center py-6 bg-white rounded-xl border border-slate-200">
                    暂无得分点，可先生成评分细则
                </div>
            )}

            {points.map((row, index) => (
                <details key={`${row.id}-${index}`} className="group bg-white rounded-xl border border-slate-200">
                    <summary className="list-none px-3 py-2.5 flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">#{index + 1}</span>
                            <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[180px]">
                                {row.content || '未命名得分点'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-indigo-600">{row.score || 0}分</span>
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
                            <label className="text-[9px] font-medium text-slate-500">得分点内容</label>
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
                            删除该得分点
                        </button>
                    </div>
                </details>
            ))}

            <button
                onClick={onAdd}
                className="w-full h-9 rounded-xl border border-dashed border-slate-200 text-[11px] text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40 transition-colors flex items-center justify-center gap-2"
            >
                <Plus className="w-4 h-4" />
                新增得分点
            </button>
        </div>
    );
}
