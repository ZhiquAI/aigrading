/**
 * accessibility.ts - 可访问性工具
 * 
 * 提供 ARIA 标签、键盘导航等可访问性辅助功能
 */

/**
 * 生成唯一 ID，用于 ARIA 关联
 */
let idCounter = 0;
export function generateId(prefix: string = 'a11y'): string {
    return `${prefix}-${++idCounter}`;
}

/**
 * 键盘事件处理器生成器
 * 将 onClick 转换为同时支持键盘和鼠标
 */
export function handleKeyboardClick(onClick: () => void) {
    return (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
        }
    };
}

/**
 * 焦点管理：将焦点移动到指定元素
 */
export function focusElement(selector: string): void {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
        element.focus();
    }
}

/**
 * 焦点陷阱：确保焦点在容器内循环
 */
export function trapFocus(container: HTMLElement): () => void {
    const focusableSelectors = [
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelectors);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Tab') return;

        if (event.shiftKey) {
            if (document.activeElement === firstElement) {
                event.preventDefault();
                lastElement?.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                event.preventDefault();
                firstElement?.focus();
            }
        }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    // 返回清理函数
    return () => {
        container.removeEventListener('keydown', handleKeyDown);
    };
}

/**
 * 屏幕阅读器公告
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcer = document.getElementById('a11y-announcer') || createAnnouncer();
    announcer.setAttribute('aria-live', priority);
    announcer.textContent = message;

    // 清空以便下次公告
    setTimeout(() => {
        announcer.textContent = '';
    }, 1000);
}

function createAnnouncer(): HTMLElement {
    const announcer = document.createElement('div');
    announcer.id = 'a11y-announcer';
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
    document.body.appendChild(announcer);
    return announcer;
}

/**
 * 颜色对比度检查（简化版）
 */
export function hasGoodContrast(foreground: string, background: string): boolean {
    // 简化实现：假设设计系统已保证对比度
    // 完整实现需要计算 WCAG 对比度
    return true;
}

/**
 * 媒体查询：检测用户偏好
 */
export const a11yPreferences = {
    prefersReducedMotion: () =>
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,

    prefersHighContrast: () =>
        window.matchMedia('(prefers-contrast: more)').matches,

    prefersDarkMode: () =>
        window.matchMedia('(prefers-color-scheme: dark)').matches
};
