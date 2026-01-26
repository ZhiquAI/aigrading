import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

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
      {
        name: 'copy-public-assets',
        writeBundle() {
          try {
            // 创建 dist/public 目录
            mkdirSync(path.resolve(__dirname, 'dist/public'), { recursive: true });
            // 复制 content.js 和 background.js （原始文件，不经过Vite打包）
            copyFileSync(
              path.resolve(__dirname, 'public/content.js'), 
              path.resolve(__dirname, 'dist/public/content.js')
            );
            copyFileSync(
              path.resolve(__dirname, 'public/background.js'), 
              path.resolve(__dirname, 'dist/public/background.js')
            );
            console.log('✅ public/content.js 和 public/background.js 已直接复制到 dist/public/');
            
            // 修改 dist/manifest.json 中的 content_scripts 路径，使用原始文件而不是打包后的
            const manifestPath = path.resolve(__dirname, 'dist/manifest.json');
            const manifestContent = readFileSync(manifestPath, 'utf8');
            const manifestObj = JSON.parse(manifestContent);
            
            if (manifestObj.content_scripts && manifestObj.content_scripts[0]) {
              manifestObj.content_scripts[0].js = ['public/content.js'];
              console.log('✅ 已更新 manifest.json：content_scripts 使用原始 public/content.js');
            }
            if (manifestObj.background && manifestObj.background.service_worker) {
              manifestObj.background.service_worker = 'public/background.js';
              console.log('✅ 已更新 manifest.json：background 使用原始 public/background.js');
            }
            
            writeFileSync(manifestPath, JSON.stringify(manifestObj, null, 2));
            console.log('✅ manifest.json 已更新并保存');
          } catch (err) {
            console.error('❌ 文件处理失败:', err);
          }
        }
      }
    ],
    publicDir: path.resolve(__dirname, 'public'),
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
