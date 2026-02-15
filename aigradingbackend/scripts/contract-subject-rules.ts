import assert from 'node:assert/strict';
import {
    DEFAULT_SUBJECT_RULES,
    generateRulesPrompt,
    getRubricSystemPrompt
} from '../src/lib/config-service';

const SUBJECTS = ['历史', '语文', '政治', '地理', '数学', '物理', '化学', '生物', '英语'] as const;
const CANONICAL_SUBJECTS = ['历史', '语文', '道法', '地理', '数学', '物理', '化学', '生物', '英语'] as const;

function run(): void {
    // 1) 默认规则必须覆盖全学科
    for (const subject of CANONICAL_SUBJECTS) {
        assert.ok(DEFAULT_SUBJECT_RULES[subject], `缺少学科默认规则: ${subject}`);
    }

    // 2) 每个学科规则提示必须可生成且包含三类题型标签
    for (const subject of CANONICAL_SUBJECTS) {
        const rulesText = generateRulesPrompt(subject);
        assert.ok(rulesText.includes('填空题:'), `${subject} 规则缺少填空题`);
        assert.ok(rulesText.includes('简答题:'), `${subject} 规则缺少简答题`);
        assert.ok(rulesText.includes('开放题:'), `${subject} 规则缺少开放题`);
    }

    // 3) prompt 必须按传入学科动态渲染（规范学科）
    for (const subject of CANONICAL_SUBJECTS) {
        const prompt = getRubricSystemPrompt(subject);
        assert.ok(prompt.includes(`【当前学科】${subject}`), `Prompt 未注入学科: ${subject}`);
        assert.ok(prompt.includes(`"subject": "${subject}"`), `示例 subject 未注入: ${subject}`);
    }

    // 4) 历史别名（政治）必须归一为道法
    for (const subject of SUBJECTS) {
        const prompt = getRubricSystemPrompt(subject);
        if (subject === '政治') {
            assert.ok(prompt.includes('【当前学科】道法'), '政治别名未归一到道法');
            assert.ok(prompt.includes('"subject": "道法"'), '政治别名示例未归一到道法');
        } else {
            assert.ok(prompt.includes(`【当前学科】${subject}`), `Prompt 未注入学科: ${subject}`);
            assert.ok(prompt.includes(`"subject": "${subject}"`), `示例 subject 未注入: ${subject}`);
        }
    }

    // 5) 未知学科回退历史
    const unknownRules = generateRulesPrompt('未知学科');
    const historyRules = generateRulesPrompt('历史');
    assert.equal(unknownRules, historyRules, '未知学科未回退历史规则');

    console.log('contract-subject-rules: all scenarios passed');
}

run();
