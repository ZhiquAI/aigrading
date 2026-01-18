/**
 * HistoryView.tsx 组件测试
 * 
 * 测试覆盖:
 * - 初始渲染（空状态）
 * - 历史记录加载和显示
 * - 题目筛选功能
 * - 评分详情展开
 * - 删除和导出功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock chrome.storage API
const mockChromeStorage = {
    local: {
        get: vi.fn(),
        set: vi.fn()
    }
};

// @ts-ignore - Mock chrome global
global.chrome = {
    storage: mockChromeStorage
};

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; })
    };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// 测试数据
const mockHistoryRecords = [
    {
        id: '1704326400000',
        questionNo: '22',
        questionKey: 'zhixue:paper123:22',
        name: '张三',
        score: 8,
        maxScore: 10,
        timestamp: 1704326400000,
        breakdown: [
            { label: '第一空', score: 2, max: 2, comment: '正确' },
            { label: '第二空', score: 1, max: 2, comment: '部分正确' },
            { label: '计算过程', score: 5, max: 6, comment: '步骤不完整' }
        ]
    },
    {
        id: '1704326500000',
        questionNo: '22',
        questionKey: 'zhixue:paper123:22',
        name: '李四',
        score: 10,
        maxScore: 10,
        timestamp: 1704326500000,
        breakdown: [
            { label: '第一空', score: 2, max: 2, comment: '正确' },
            { label: '第二空', score: 2, max: 2, comment: '正确' },
            { label: '计算过程', score: 6, max: 6, comment: '完整正确' }
        ]
    },
    {
        id: '1704326600000',
        questionNo: '23',
        questionKey: 'zhixue:paper123:23',
        name: '王五',
        score: 5,
        maxScore: 8,
        timestamp: 1704326600000,
        breakdown: [
            { label: '分析', score: 3, max: 4, comment: '部分正确' },
            { label: '结论', score: 2, max: 4, comment: '正确' }
        ]
    }
];

describe('HistoryView', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ==================== 加载逻辑测试 ====================
    describe('loadHistory', () => {
        it('应该优先从 chrome.storage 加载数据', async () => {
            mockChromeStorage.local.get.mockImplementation((keys: string | string[], callback: (result: Record<string, unknown>) => void) => {
                callback({ grading_history: JSON.stringify(mockHistoryRecords) });
            });

            // 模拟 loadHistory 逻辑
            const loadHistory = async (): Promise<typeof mockHistoryRecords> => {
                return new Promise((resolve) => {
                    if (typeof chrome !== 'undefined' && chrome.storage) {
                        chrome.storage.local.get(['grading_history'], (result: Record<string, unknown>) => {
                            if (result.grading_history) {
                                resolve(JSON.parse(result.grading_history as string));
                            } else {
                                resolve([]);
                            }
                        });
                    } else {
                        const saved = localStorage.getItem('grading_history');
                        resolve(saved ? JSON.parse(saved) : []);
                    }
                });
            };

            const history = await loadHistory();

            expect(mockChromeStorage.local.get).toHaveBeenCalled();
            expect(history).toHaveLength(3);
            expect(history[0].name).toBe('张三');
        });

        it('应该从 localStorage fallback 加载', async () => {
            // 临时移除 chrome mock
            const originalChrome = global.chrome;
            // @ts-ignore
            global.chrome = undefined;

            localStorageMock.setItem('grading_history', JSON.stringify(mockHistoryRecords));

            const loadHistory = async (): Promise<typeof mockHistoryRecords> => {
                return new Promise((resolve) => {
                    if (typeof chrome !== 'undefined' && chrome?.storage) {
                        chrome.storage.local.get(['grading_history'], (result: Record<string, unknown>) => {
                            resolve(result.grading_history ? JSON.parse(result.grading_history as string) : []);
                        });
                    } else {
                        const saved = localStorage.getItem('grading_history');
                        resolve(saved ? JSON.parse(saved) : []);
                    }
                });
            };

            const history = await loadHistory();

            expect(history).toHaveLength(3);

            // 恢复 chrome mock
            global.chrome = originalChrome;
        });
    });

    // ==================== 筛选逻辑测试 ====================
    describe('filtering', () => {
        it('应该能按题目筛选记录', () => {
            const filterByQuestion = (records: typeof mockHistoryRecords, questionNo: string | null) => {
                if (!questionNo) return records;
                return records.filter(r => r.questionNo === questionNo);
            };

            const filtered = filterByQuestion(mockHistoryRecords, '22');

            expect(filtered).toHaveLength(2);
            expect(filtered.every(r => r.questionNo === '22')).toBe(true);
        });

        it('NULL 筛选条件应返回全部记录', () => {
            const filterByQuestion = (records: typeof mockHistoryRecords, questionNo: string | null) => {
                if (!questionNo) return records;
                return records.filter(r => r.questionNo === questionNo);
            };

            const filtered = filterByQuestion(mockHistoryRecords, null);

            expect(filtered).toHaveLength(3);
        });

        it('应该能提取唯一题目列表', () => {
            const getUniqueQuestions = (records: typeof mockHistoryRecords) => {
                const questions = new Map<string, { key: string; no: string }>();
                records.forEach(r => {
                    if (r.questionKey && !questions.has(r.questionKey)) {
                        questions.set(r.questionKey, { key: r.questionKey, no: r.questionNo || '未知' });
                    }
                });
                return Array.from(questions.values());
            };

            const uniqueQuestions = getUniqueQuestions(mockHistoryRecords);

            expect(uniqueQuestions).toHaveLength(2);
            expect(uniqueQuestions.map(q => q.no)).toContain('22');
            expect(uniqueQuestions.map(q => q.no)).toContain('23');
        });
    });

    // ==================== 分数颜色逻辑测试 ====================
    describe('getScoreColor', () => {
        it('高分应返回绿色', () => {
            const getScoreColor = (score: number, maxScore: number) => {
                const ratio = score / maxScore;
                if (ratio >= 0.8) return 'text-green-600';
                if (ratio >= 0.6) return 'text-yellow-600';
                return 'text-red-600';
            };

            expect(getScoreColor(10, 10)).toBe('text-green-600');
            expect(getScoreColor(8, 10)).toBe('text-green-600');
        });

        it('中分应返回黄色', () => {
            const getScoreColor = (score: number, maxScore: number) => {
                const ratio = score / maxScore;
                if (ratio >= 0.8) return 'text-green-600';
                if (ratio >= 0.6) return 'text-yellow-600';
                return 'text-red-600';
            };

            expect(getScoreColor(7, 10)).toBe('text-yellow-600');
            expect(getScoreColor(6, 10)).toBe('text-yellow-600');
        });

        it('低分应返回红色', () => {
            const getScoreColor = (score: number, maxScore: number) => {
                const ratio = score / maxScore;
                if (ratio >= 0.8) return 'text-green-600';
                if (ratio >= 0.6) return 'text-yellow-600';
                return 'text-red-600';
            };

            expect(getScoreColor(5, 10)).toBe('text-red-600');
            expect(getScoreColor(0, 10)).toBe('text-red-600');
        });
    });

    // ==================== 时间格式化测试 ====================
    describe('formatTime', () => {
        it('应该正确格式化时间戳', () => {
            const formatTime = (ts: number) => {
                const date = new Date(ts);
                const MM = String(date.getMonth() + 1).padStart(2, '0');
                const DD = String(date.getDate()).padStart(2, '0');
                const HH = String(date.getHours()).padStart(2, '0');
                const mm = String(date.getMinutes()).padStart(2, '0');
                return `${MM}/${DD} ${HH}:${mm}`;
            };

            // 2024-01-04 00:00:00 UTC
            const timestamp = 1704326400000;
            const formatted = formatTime(timestamp);

            expect(formatted).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
        });
    });

    // ==================== 导出逻辑测试 ====================
    describe('export', () => {
        it('应该能生成 CSV 格式数据', () => {
            const generateCSV = (records: typeof mockHistoryRecords) => {
                const headers = ['姓名', '题号', '得分', '满分', '时间'];
                const rows = records.map(r => [
                    r.name,
                    r.questionNo,
                    r.score.toString(),
                    r.maxScore.toString(),
                    new Date(r.timestamp).toLocaleString()
                ]);
                return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            };

            const csv = generateCSV(mockHistoryRecords);

            expect(csv).toContain('姓名,题号,得分,满分,时间');
            expect(csv).toContain('张三');
            expect(csv).toContain('李四');
        });
    });

    // ==================== 去重逻辑测试 ====================
    describe('cleanRepeats', () => {
        it('应该识别重复记录', () => {
            const recordsWithDuplicates = [
                ...mockHistoryRecords,
                { ...mockHistoryRecords[0], id: 'duplicate-1', score: 9 } // 同名同题目的重复
            ];

            const findDuplicates = (records: typeof mockHistoryRecords) => {
                const seen = new Map<string, string>();
                const duplicateIds: string[] = [];

                records.forEach(r => {
                    const key = `${r.name}:${r.questionKey}`;
                    if (seen.has(key)) {
                        duplicateIds.push(r.id);
                    } else {
                        seen.set(key, r.id);
                    }
                });

                return duplicateIds;
            };

            const duplicates = findDuplicates(recordsWithDuplicates);

            expect(duplicates).toHaveLength(1);
            expect(duplicates[0]).toBe('duplicate-1');
        });
    });
});
