/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class', // 启用基于 class 的深色模式
    content: [
        "./index.html",
        "./**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            animation: {
                'bounce-slow': 'bounce-slow 2s infinite ease-in-out',
            },
            keyframes: {
                'bounce-slow': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                }
            },
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
            },
            colors: {
                // Shadcn-inspired semantic colors
                primary: {
                    DEFAULT: '#6366F1',
                    hover: '#4F46E5',
                    active: '#4338CA',
                    subtle: '#EEF2FF',
                    border: '#C7D2FE',
                    50: '#EEF2FF',
                    100: '#E0E7FF',
                    500: '#6366F1',
                    600: '#4F46E5',
                    700: '#4338CA',
                },
                success: {
                    DEFAULT: '#10B981',
                    hover: '#059669',
                    subtle: '#ECFDF5',
                    border: '#A7F3D0',
                },
                danger: {
                    DEFAULT: '#EF4444',
                    hover: '#DC2626',
                    subtle: '#FEF2F2',
                },
                warning: {
                    DEFAULT: '#F59E0B',
                    hover: '#D97706',
                    subtle: '#FFFBEB',
                },
                accent: {
                    DEFAULT: '#8B5CF6',
                    hover: '#7C3AED',
                    subtle: '#F5F3FF',
                },
            },
            backgroundImage: {
                // 品牌渐变 (用于主要按钮)
                'brand-gradient': 'linear-gradient(to right, #6366F1, #8B5CF6)',
                'brand-gradient-hover': 'linear-gradient(to right, #4F46E5, #7C3AED)',
                // 深色面板渐变
                'panel-dark': 'linear-gradient(to bottom right, #0F172A, #1E293B, #312E81)',
            },
            borderRadius: {
                DEFAULT: '0.75rem', // 12px
            },
            boxShadow: {
                'focus': '0 0 0 3px rgba(99, 102, 241, 0.15)',
                'brand': '0 10px 15px -3px rgba(99, 102, 241, 0.3)',
                'brand-lg': '0 20px 25px -5px rgba(99, 102, 241, 0.4)',
            }
        },
    },
    plugins: [],
}
