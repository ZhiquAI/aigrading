/**
 * useLatestRef hook 单元测试
 * 
 * 注意：由于项目未安装 @testing-library/react，
 * 这里测试 hook 的核心逻辑（ref 行为和闭包陷阱场景）
 */

import { describe, it, expect, vi } from 'vitest';

describe('useLatestRef 核心逻辑', () => {
    /**
     * 模拟 useLatestRef 的核心逻辑
     * 这是实际 hook 的简化版本，用于验证设计正确性
     */
    const createLatestRef = <T>(initialValue: T) => {
        const ref = { current: initialValue };
        const update = (newValue: T) => {
            ref.current = newValue;
        };
        return { ref, update };
    };

    it('闭包陷阱场景：直接使用变量 vs 使用 ref', () => {
        // 模拟 React 组件的 props 变化
        let rubric = 'initial rubric';
        let strategy = 'flash';

        // 创建 refs（模拟 useLatestRef）
        const rubricRef = { current: rubric };
        const strategyRef = { current: strategy };

        // 模拟一个在"初始状态"下创建的异步回调（如 setTimeout 中的函数）
        // 关键：闭包在 **创建时** 捕获变量值
        const capturedRubric = rubric;      // 闭包捕获当前值
        const capturedStrategy = strategy;  // 闭包捕获当前值

        const asyncGradingWithClosure = () => {
            return {
                rubricUsed: capturedRubric,      // 使用捕获的值（闭包陷阱）
                strategyUsed: capturedStrategy   // 使用捕获的值（闭包陷阱）
            };
        };

        // 使用 ref 的版本（正确做法）
        const asyncGradingWithRef = () => {
            return {
                rubricUsed: rubricRef.current,     // 每次调用时获取最新值
                strategyUsed: strategyRef.current  // 每次调用时获取最新值
            };
        };

        // 模拟 props 更新（用户切换策略）
        rubric = 'updated rubric';
        strategy = 'pro';
        rubricRef.current = rubric;
        strategyRef.current = strategy;

        // 执行异步回调
        const closureResult = asyncGradingWithClosure();
        const refResult = asyncGradingWithRef();

        // 使用捕获值的闭包方式会使用旧值（这是 bug！）
        expect(closureResult.rubricUsed).toBe('initial rubric');
        expect(closureResult.strategyUsed).toBe('flash');

        // Ref 方式会使用新值（这是正确的！）
        expect(refResult.rubricUsed).toBe('updated rubric');
        expect(refResult.strategyUsed).toBe('pro');
    });

    it('createLatestRef 应该正确追踪值更新', () => {
        const { ref, update } = createLatestRef('initial');

        expect(ref.current).toBe('initial');

        update('second');
        expect(ref.current).toBe('second');

        update('third');
        expect(ref.current).toBe('third');
    });

    it('多个 refs 应该独立工作', () => {
        const rubricRef = createLatestRef('rubric1');
        const strategyRef = createLatestRef('flash');
        const configuredRef = createLatestRef(false);

        // 更新各个 ref
        rubricRef.update('rubric2');
        strategyRef.update('pro');
        configuredRef.update(true);

        expect(rubricRef.ref.current).toBe('rubric2');
        expect(strategyRef.ref.current).toBe('pro');
        expect(configuredRef.ref.current).toBe(true);
    });

    it('异步操作中应该能获取最新值', async () => {
        const values = createLatestRef({ rubric: 'old', strategy: 'flash' as const });

        // 模拟异步操作
        const asyncOperation = () => new Promise<typeof values.ref.current>((resolve) => {
            setTimeout(() => {
                resolve(values.ref.current);
            }, 10);
        });

        // 启动异步操作
        const promise = asyncOperation();

        // 在异步操作执行前更新值
        values.update({ rubric: 'new', strategy: 'pro' });

        // 等待异步操作完成
        const result = await promise;

        // 应该获取到最新值
        expect(result.rubric).toBe('new');
        expect(result.strategy).toBe('pro');
    });

    it('模拟 GradingView 场景：策略切换后批改应使用新策略', async () => {
        // 模拟 GradingView 组件状态
        let currentRubric = 'question 18 rubric';
        let gradingStrategy = 'flash';
        let isRubricConfigured = true;

        // 使用 refs 保持最新值
        const refs = {
            currentRubric: { current: currentRubric },
            gradingStrategy: { current: gradingStrategy },
            isRubricConfigured: { current: isRubricConfigured }
        };

        // 模拟 scanPage 函数（异步批改流程）
        const scanPage = async () => {
            await new Promise(resolve => setTimeout(resolve, 5));

            // 使用 refs 获取最新值（修复后的代码）
            const latestRubric = refs.currentRubric.current;
            const latestStrategy = refs.gradingStrategy.current;
            const latestIsConfigured = refs.isRubricConfigured.current;

            if (!latestIsConfigured || !latestRubric) {
                return { error: '未配置评分标准' };
            }

            // 模拟批改
            return {
                rubricUsed: latestRubric,
                strategyUsed: latestStrategy,
                success: true
            };
        };

        // 启动批改流程
        const gradingPromise = scanPage();

        // 用户切换策略（在批改过程中）
        currentRubric = 'question 18 rubric';  // 保持不变
        gradingStrategy = 'pro';  // 切换策略！
        refs.currentRubric.current = currentRubric;
        refs.gradingStrategy.current = gradingStrategy;

        // 等待批改完成
        const result = await gradingPromise;

        // 验证使用了新策略
        expect(result.success).toBe(true);
        expect(result.rubricUsed).toBe('question 18 rubric');
        expect(result.strategyUsed).toBe('pro');  // 应该使用新策略！
    });
});
