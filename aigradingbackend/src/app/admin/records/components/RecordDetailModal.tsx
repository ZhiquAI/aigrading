'use client';

import { X } from 'lucide-react';
import AdminModal from '../../_components/AdminModal';

interface GradingRecord {
    id: string;
    activationCode: string;
    studentName: string;
    questionNo: string;
    score: number;
    maxScore: number;
    comment: string;
    breakdown: any;
    createdAt: string;
    deviceId: string;
}

interface RecordDetailModalProps {
    record: GradingRecord | null;
    onClose: () => void;
}

export default function RecordDetailModal({ record, onClose }: RecordDetailModalProps) {
    const isOpen = Boolean(record);
    if (!record) return null;

    // 解析 breakdown
    let breakdownPoints: any[] = [];
    try {
        if (typeof record.breakdown === 'string') {
            breakdownPoints = JSON.parse(record.breakdown);
        } else if (Array.isArray(record.breakdown)) {
            breakdownPoints = record.breakdown;
        }
    } catch (e) {
        console.warn('Failed to parse breakdown', e);
    }

    return (
        <AdminModal isOpen={isOpen} onClose={onClose} ariaLabelledBy="record-detail-title" maxWidthClassName="max-w-2xl">
            {/* 头部 */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
                <div>
                    <h2 className="text-xl font-bold text-gray-900" id="record-detail-title">
                        {record.studentName} 的答卷
                    </h2>
                    <div className="text-sm text-gray-500 mt-1 tabular-nums">
                        {record.activationCode} • {new Date(record.createdAt).toLocaleString()}
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 p-2"
                    type="button"
                    aria-label="关闭"
                >
                    <X className="w-4 h-4" aria-hidden />
                </button>
            </div>

            {/* 内容滚动区 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* 分数概览 */}
                <div className="flex items-center gap-6">
                    <div className="flex-1 bg-indigo-50 rounded-xl p-4 text-center">
                        <div className="text-sm text-indigo-600 font-medium mb-1">得分</div>
                        <div className="text-3xl font-bold text-indigo-700 tabular-nums">
                            {record.score}{' '}
                            <span className="text-lg text-indigo-400">/ {record.maxScore}</span>
                        </div>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl p-4 text-center">
                        <div className="text-sm text-gray-500 font-medium mb-1">第几题</div>
                        <div className="text-2xl font-bold text-gray-700 tabular-nums">
                            Q{record.questionNo || '?'}
                        </div>
                    </div>
                </div>

                {/* AI 评语 */}
                <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">AI 综合评语</h3>
                    <div className="bg-gray-50 rounded-xl p-4 text-gray-700 leading-relaxed">
                        {record.comment || '无评语'}
                    </div>
                </div>

                {/* 得分详情 */}
                <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">得分点分析</h3>
                    {breakdownPoints.length > 0 ? (
                        <div className="space-y-3">
                            {breakdownPoints.map((point: any, index: number) => (
                                <div key={index} className="flex justify-between items-start border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                                    <div className="flex-1 pr-4">
                                        <div className="text-gray-900 font-medium">{point.content}</div>
                                        {point.reason && (
                                            <div className="text-sm text-gray-500 mt-1">{point.reason}</div>
                                        )}
                                    </div>
                                    <div className={`font-mono font-bold whitespace-nowrap tabular-nums ${point.score > 0 ? 'text-green-600' : 'text-red-500'
                                        }`}>
                                        {point.score > 0 ? '+' : ''}{point.score}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-gray-400 italic">暂无详细得分点数据</div>
                    )}
                </div>

                {/* 技术信息 (Raw Data) */}
                <div className="pt-6 border-t border-gray-100">
                    <details className="group">
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-indigo-600 transition-colors list-none flex items-center gap-2">
                            <span className="group-open:rotate-90 transition-transform">▶</span>
                            查看原始数据 (Debug)
                        </summary>
                        <pre className="mt-4 bg-gray-900 text-gray-100 p-4 rounded-xl text-xs overflow-x-auto font-mono">
                            {JSON.stringify(record, null, 2)}
                        </pre>
                    </details>
                </div>
            </div>

            {/* 底部 */}
            <div className="p-6 border-t border-gray-100 flex justify-end">
                <button
                    onClick={onClose}
                    className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
                    type="button"
                >
                    关闭
                </button>
            </div>
        </AdminModal>
    );
}
