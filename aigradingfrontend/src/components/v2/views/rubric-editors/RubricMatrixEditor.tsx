import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

export interface EditableLevel {
    label: string;
    score: string;
    description: string;
}

export interface EditableDimension {
    id: string;
    name: string;
    weight: string;
    levels: EditableLevel[];
}

interface RubricMatrixEditorProps {
    dimensions: EditableDimension[];
    onChangeDimension: (index: number, field: keyof EditableDimension, value: string) => void;
    onRemoveDimension: (index: number) => void;
    onAddDimension: () => void;
    onAddLevel: (dimIndex: number) => void;
    onRemoveLevel: (dimIndex: number, levelIndex: number) => void;
    onChangeLevel: (dimIndex: number, levelIndex: number, field: keyof EditableLevel, value: string) => void;
}

export default function RubricMatrixEditor({
    dimensions,
    onChangeDimension,
    onRemoveDimension,
    onAddDimension,
    onAddLevel,
    onRemoveLevel,
    onChangeLevel
}: RubricMatrixEditorProps) {
    return (
        <div className="space-y-3">
            {dimensions.length === 0 && (
                <div className="text-[11px] text-slate-400 text-center py-6 bg-white rounded-xl border border-slate-200">
                    暂无评分维度，可先生成评分细则
                </div>
            )}

            {dimensions.map((dim, index) => (
                <div key={`${dim.id}-${index}`} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-600">维度 {index + 1}</div>
                        <button
                            onClick={() => onRemoveDimension(index)}
                            className="p-1 rounded text-red-500 hover:bg-red-50"
                            aria-label="删除维度"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[9px] font-medium text-slate-500">维度名称</label>
                            <input
                                value={dim.name}
                                onChange={(e) => onChangeDimension(index, 'name', e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[10px]"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-medium text-slate-500">权重/满分</label>
                            <input
                                value={dim.weight}
                                onChange={(e) => onChangeDimension(index, 'weight', e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[10px]"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        {dim.levels.map((level, lIndex) => (
                            <div key={`${dim.id}-${lIndex}`} className="grid grid-cols-4 gap-2 items-center">
                                <input
                                    value={level.label}
                                    onChange={(e) => onChangeLevel(index, lIndex, 'label', e.target.value)}
                                    className="h-7 px-2 rounded-lg border border-slate-200 text-[10px]"
                                    placeholder="等级"
                                />
                                <input
                                    value={level.score}
                                    onChange={(e) => onChangeLevel(index, lIndex, 'score', e.target.value)}
                                    className="h-7 px-2 rounded-lg border border-slate-200 text-[10px]"
                                    placeholder="分值"
                                />
                                <input
                                    value={level.description}
                                    onChange={(e) => onChangeLevel(index, lIndex, 'description', e.target.value)}
                                    className="h-7 px-2 rounded-lg border border-slate-200 text-[10px] col-span-2"
                                    placeholder="描述"
                                />
                                <button
                                    onClick={() => onRemoveLevel(index, lIndex)}
                                    className="p-1 rounded text-red-500 hover:bg-red-50"
                                    aria-label="删除等级"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => onAddLevel(index)}
                            className="w-full h-8 rounded-lg border border-dashed border-slate-200 text-[10px] text-slate-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50/40 transition-colors flex items-center justify-center gap-1"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            新增等级
                        </button>
                    </div>
                </div>
            ))}

            <button
                onClick={onAddDimension}
                className="w-full h-9 rounded-xl border border-dashed border-slate-200 text-[11px] text-slate-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50/40 transition-colors flex items-center justify-center gap-2"
            >
                <Plus className="w-4 h-4" />
                新增维度
            </button>
        </div>
    );
}
