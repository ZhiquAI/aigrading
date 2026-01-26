import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      crx({ manifest }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // 分离Chart.js及相关依赖
            'chart': ['chart.js', 'react-chartjs-2'],
            // 分离React核心库  
            'react-vendor': ['react', 'react-dom'],
            // 分离Lucide图标库
            'icons': ['lucide-react']
          }
        }
      },
      // 调整chunk大小警告阈值
      chunkSizeWarningLimit: 600
    },
    define: {
      // 安全修复：生产构建不包含 API Key，仅开发模式注入
      // 用户应通过设置页面配置 API Key
      'process.env.API_KEY': mode === 'development'
        ? JSON.stringify(env.GEMINI_API_KEY || '')
        : JSON.stringify(''),
      'process.env.GEMINI_API_KEY': mode === 'development'
        ? JSON.stringify(env.GEMINI_API_KEY || '')
        : JSON.stringify('')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
