import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'app_theme';

/**
 * 主题管理 Hook
 * 支持浅色、深色和跟随系统三种模式
 * 使用 chrome.storage.local 在扩展上下文中持久化
 */
export function useTheme() {
    const [theme, setThemeState] = useState<Theme>('system');
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
    const [isLoaded, setIsLoaded] = useState(false);

    // 计算实际主题
    const computeResolvedTheme = useCallback((t: Theme): 'light' | 'dark' => {
        if (t === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return t;
    }, []);

    // 应用主题到 DOM
    const applyTheme = useCallback((resolved: 'light' | 'dark') => {
        const root = document.documentElement;
        if (resolved === 'dark') {
            root.classList.add('dark');
            root.setAttribute('data-theme', 'dark');
        } else {
            root.classList.remove('dark');
            root.setAttribute('data-theme', 'light');
        }
    }, []);

    // 初始化：从存储读取主题
    useEffect(() => {
        const loadTheme = async () => {
            let savedTheme: Theme = 'system';

            // 优先使用 chrome.storage
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                try {
                    const result = await chrome.storage.local.get(THEME_KEY);
                    if (result[THEME_KEY] && ['light', 'dark', 'system'].includes(result[THEME_KEY])) {
                        savedTheme = result[THEME_KEY] as Theme;
                    }
                } catch (e) {
                    console.warn('[useTheme] Failed to read from chrome.storage:', e);
                }
            } else {
                // 回退到 localStorage
                try {
                    const saved = localStorage.getItem(THEME_KEY) as Theme;
                    if (saved && ['light', 'dark', 'system'].includes(saved)) {
                        savedTheme = saved;
                    }
                } catch { /* ignore */ }
            }

            setThemeState(savedTheme);
            const resolved = computeResolvedTheme(savedTheme);
            setResolvedTheme(resolved);
            applyTheme(resolved);
            setIsLoaded(true);
        };

        loadTheme();
    }, [computeResolvedTheme, applyTheme]);

    // 监听存储变化（用于多组件实例同步）
    useEffect(() => {
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes[THEME_KEY]) {
                const newTheme = changes[THEME_KEY].newValue as Theme;
                if (newTheme && ['light', 'dark', 'system'].includes(newTheme)) {
                    setThemeState(newTheme);
                    const resolved = computeResolvedTheme(newTheme);
                    setResolvedTheme(resolved);
                    applyTheme(resolved);
                }
            }
        };

        const handleLocalStorageChange = (e: StorageEvent) => {
            if (e.key === THEME_KEY) {
                const newTheme = e.newValue as Theme;
                if (newTheme && ['light', 'dark', 'system'].includes(newTheme)) {
                    setThemeState(newTheme);
                    const resolved = computeResolvedTheme(newTheme);
                    setResolvedTheme(resolved);
                    applyTheme(resolved);
                }
            }
        };

        if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
            chrome.storage.onChanged.addListener(handleStorageChange);
        } else {
            window.addEventListener('storage', handleLocalStorageChange);
        }

        return () => {
            if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
                chrome.storage.onChanged.removeListener(handleStorageChange);
            } else {
                window.removeEventListener('storage', handleLocalStorageChange);
            }
        };
    }, [computeResolvedTheme, applyTheme]);

    // 监听系统主题变化
    useEffect(() => {
        if (!isLoaded) return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            if (theme === 'system') {
                const resolved = computeResolvedTheme('system');
                setResolvedTheme(resolved);
                applyTheme(resolved);
            }
        };

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [theme, isLoaded, computeResolvedTheme, applyTheme]);

    // 切换主题
    const setTheme = useCallback(async (newTheme: Theme) => {
        setThemeState(newTheme);
        const resolved = computeResolvedTheme(newTheme);
        setResolvedTheme(resolved);
        applyTheme(resolved);

        // 持久化
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            try {
                await chrome.storage.local.set({ [THEME_KEY]: newTheme });
            } catch (e) {
                console.warn('[useTheme] Failed to save to chrome.storage:', e);
            }
        } else {
            try {
                localStorage.setItem(THEME_KEY, newTheme);
            } catch { /* ignore */ }
        }
    }, [computeResolvedTheme, applyTheme]);

    return {
        theme,           // 用户选择的主题 (light/dark/system)
        resolvedTheme,   // 实际应用的主题 (light/dark)
        setTheme,
        isDark: resolvedTheme === 'dark',
    };
}

export default useTheme;

