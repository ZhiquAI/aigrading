/**
 * rubric-rules.ts - 评分细则规则库
 * 
 * 基于 /.agent/skills/rubric-design/SKILL.md
 */

// ==================== 逻辑验证规则 ====================

export interface LogicValidationRule {
    entity: string;      // 人物/事件名称
    requires: string[];  // 必须包含的关键词
    template: string;    // gradingNotes模板
}

export const LOGIC_VALIDATION_RULES: LogicValidationRule[] = [
    {
        entity: '瓦特',
        requires: ['蒸汽机'],
        template: "【逻辑验证】若答案中出现'瓦特',必须同时包含'蒸汽机'相关内容"
    },
    {
        entity: '哥伦布',
        requires: ['美洲', '发现'],
        template: "【逻辑验证】若答案中出现'哥伦布',必须同时包含'美洲'或'发现'相关内容"
    },
    {
        entity: '麦哲伦',
        requires: ['环球航行', '太平洋'],
        template: "【逻辑验证】若答案中出现'麦哲伦',必须同时包含'环球航行'或'太平洋'相关内容"
    },
    {
        entity: '伯里克利',
        requires: ['雅典', '民主'],
        template: "【逻辑验证】若答案中出现'伯里克利',必须同时包含'雅典'或'民主'相关内容"
    },
    {
        entity: '达·芬奇',
        requires: ['文艺复兴', '画作', '蒙娜丽莎'],
        template: "【逻辑验证】若答案中出现'达·芬奇',必须同时包含'文艺复兴'或画作名称相关内容"
    },
    {
        entity: '牛顿',
        requires: ['力学', '万有引力'],
        template: "【逻辑验证】若答案中出现'牛顿',必须同时包含'力学'或'万有引力'相关内容"
    },
    {
        entity: '爱因斯坦',
        requires: ['相对论'],
        template: "【逻辑验证】若答案中出现'爱因斯坦',必须同时包含'相对论'相关内容"
    }
];

// ==================== 时空围栏规则 ====================

export interface TimeSpaceFenceRule {
    era: string;         // 时代名称
    period: string;      // 时间范围
    forbidden: string[]; // 禁止词汇
    template: string;    // gradingNotes模板
}

export const TIME_SPACE_FENCE_RULES: TimeSpaceFenceRule[] = [
    {
        era: '古代中国',
        period: '公元前-1840',
        forbidden: ['马克思主义', '互联网', '电报', '蒸汽机', '火车', '飞机'],
        template: "【时空围栏】古代中国题目禁止出现'马克思主义''互联网''电报''蒸汽机'等跨时代词汇"
    },
    {
        era: '文艺复兴',
        period: '14-16世纪',
        forbidden: ['马克思主义', '互联网', '电报', '蒸汽机', '工业革命'],
        template: "【时空围栏】文艺复兴题目(14-16世纪)禁止出现'马克思主义''互联网''电报'等跨时代词汇"
    },
    {
        era: '新航路开辟',
        period: '15-16世纪',
        forbidden: ['互联网', '电报', '蒸汽机', '火车', '飞机'],
        template: "【时空围栏】新航路开辟题目(15-16世纪)禁止出现'互联网''电报''蒸汽机''火车'等跨时代词汇"
    },
    {
        era: '工业革命',
        period: '18-19世纪',
        forbidden: ['互联网', '电脑', '飞机', '原子能'],
        template: "【时空围栏】工业革命题目(18-19世纪)禁止出现'互联网''电脑''原子能'等跨时代词汇"
    },
    {
        era: '近代中国',
        period: '1840-1949',
        forbidden: ['互联网', '改革开放', '一国两制'],
        template: "【时空围栏】近代中国题目(1840-1949)禁止出现'互联网''改革开放''一国两制'等后续词汇"
    }
];

// ==================== 工具函数 ====================

/**
 * 根据文本内容自动生成逻辑验证提示
 */
export function generateLogicValidation(text: string): string[] {
    const notes: string[] = [];

    for (const rule of LOGIC_VALIDATION_RULES) {
        if (text.includes(rule.entity)) {
            notes.push(rule.template);
        }
    }

    return notes;
}

/**
 * 根据关键词自动识别时代并生成时空围栏提示
 */
export function generateTimeSpaceFence(text: string): string | null {
    // 关键词映射到时代
    const eraKeywords: Record<string, string> = {
        '文艺复兴': '文艺复兴',
        '新航路': '新航路开辟',
        '哥伦布': '新航路开辟',
        '麦哲伦': '新航路开辟',
        '工业革命': '工业革命',
        '蒸汽机': '工业革命',
        '瓦特': '工业革命',
        '鸦片战争': '近代中国',
        '辛亥革命': '近代中国',
        '秦朝': '古代中国',
        '汉朝': '古代中国',
        '唐朝': '古代中国',
        '宋朝': '古代中国',
        '明朝': '古代中国',
        '清朝': '古代中国'
    };

    // 查找匹配的时代
    for (const [keyword, era] of Object.entries(eraKeywords)) {
        if (text.includes(keyword)) {
            const rule = TIME_SPACE_FENCE_RULES.find(r => r.era === era);
            if (rule) {
                return rule.template;
            }
        }
    }

    return null;
}

/**
 * 自动生成完整的gradingNotes
 */
export function autoGenerateGradingNotes(
    answerText: string,
    basicNotes: string[] = []
): string[] {
    const notes = [...basicNotes];

    // 添加逻辑验证
    const logicNotes = generateLogicValidation(answerText);
    notes.push(...logicNotes);

    // 添加时空围栏
    const fenceNote = generateTimeSpaceFence(answerText);
    if (fenceNote) {
        notes.push(fenceNote);
    }

    return notes;
}
