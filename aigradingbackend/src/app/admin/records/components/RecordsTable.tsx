'use client';

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

interface RecordsTableProps {
    records: GradingRecord[];
    loading: boolean;
    onViewDetail: (record: GradingRecord) => void;
}

export default function RecordsTable({ records, loading, onViewDetail }: RecordsTableProps) {
    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-16 bg-gray-100 rounded-xl" />
                ))}
            </div>
        );
    }

    if (records.length === 0) {
        return (
            <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-500">暂无批改记录</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                            <th className="px-6 py-4">时间</th>
                            <th className="px-6 py-4">激活码</th>
                            <th className="px-6 py-4">学生姓名</th>
                            <th className="px-6 py-4">题号</th>
                            <th className="px-6 py-4">得分</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {records.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 text-gray-500">
                                    {new Date(record.createdAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                        {record.activationCode}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    {record.studentName}
                                </td>
                                <td className="px-6 py-4">
                                    Q{record.questionNo || '?'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`font-bold ${record.score === record.maxScore ? 'text-green-600' :
                                        record.score === 0 ? 'text-red-500' : 'text-blue-600'
                                        }`}>
                                        {record.score}
                                    </span>
                                    <span className="text-gray-400 text-xs ml-1">/ {record.maxScore}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => onViewDetail(record)}
                                        className="text-indigo-600 hover:text-indigo-700 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        详情
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
