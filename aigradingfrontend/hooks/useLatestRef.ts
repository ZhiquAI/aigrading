/**
 * useLatestRef.ts - 保持最新值的 ref Hook
 * 
 * 解决 React 闭包陷阱问题：当异步回调需要访问最新的 props/state 时，
 * 使用此 hook 可自动保持 ref 与值同步。
 * 
 * React 18 兼容：使用 useInsertionEffect（在 DOM 变更前同步执行）
 * 确保 ref 在任何 effect 读取前已更新。
 */

import { useRef, useInsertionEffect, useEffect, MutableRefObject } from 'react';

// React 18+ 使用 useInsertionEffect，更早版本回退到 useEffect
const useIsomorphicInsertionEffect =
    typeof useInsertionEffect === 'function'
        ? useInsertionEffect
        : useEffect;

/**
 * 保持最新值的 ref
 * @param value 需要追踪的值
 * @returns 始终包含最新值的 ref
 * 
 * @example
 * const latestRubric = useLatestRef(currentRubric);
 * 
 * const asyncCallback = async () => {
 *   // 即使在闭包中，也能获取最新值
 *   console.log(latestRubric.current);
 * };
 */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
    const ref = useRef(value);

    // 使用 useInsertionEffect 确保在任何其他 effect 之前同步更新
    // 这比 useLayoutEffect 更早执行，适合处理 ref 更新
    useIsomorphicInsertionEffect(() => {
        ref.current = value;
    });

    return ref;
}

/**
 * 批量保持多个值的最新 refs
 * @param values 需要追踪的值对象
 * @returns 各属性对应的 refs
 * 
 * @example
 * const refs = useLatestRefs({
 *   rubric: currentRubric,
 *   strategy: gradingStrategy,
 *   isConfigured: isRubricConfigured
 * });
 * 
 * // 使用：refs.rubric.current, refs.strategy.current
 */
export function useLatestRefs<T extends Record<string, unknown>>(
    values: T
): { [K in keyof T]: MutableRefObject<T[K]> } {
    const refsMap = useRef<{ [K in keyof T]?: MutableRefObject<T[K]> }>({});

    // 初始化 refs
    for (const key in values) {
        if (!refsMap.current[key]) {
            refsMap.current[key] = { current: values[key] } as MutableRefObject<T[typeof key]>;
        }
    }

    // 同步更新所有 refs
    useIsomorphicInsertionEffect(() => {
        for (const key in values) {
            if (refsMap.current[key]) {
                refsMap.current[key]!.current = values[key];
            }
        }
    });

    return refsMap.current as { [K in keyof T]: MutableRefObject<T[K]> };
}

export default useLatestRef;
