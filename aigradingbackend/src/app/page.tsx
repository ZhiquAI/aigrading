import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/30">
            <span className="text-3xl">🎯</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">智阅 AI</h1>
          <p className="text-slate-400">智能批改助手后端服务</p>
        </div>

        {/* Status Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 font-medium">服务运行中</span>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-700">
              <span className="text-slate-400">API 状态</span>
              <span className="text-white font-medium">正常</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-700">
              <span className="text-slate-400">数据库</span>
              <span className="text-white font-medium">已连接</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-slate-400">版本</span>
              <span className="text-white font-medium">v1.0.0</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/admin"
            className="block w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl text-center transition-all duration-200 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50"
          >
            进入管理后台
          </Link>
          <Link
            href="/api/health"
            className="block w-full py-3 px-4 bg-slate-700/50 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-center transition-all duration-200 border border-slate-600"
          >
            查看 API 状态
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-8">
          © 2026 智阅 AI · 智能批改助手
        </p>
      </div>
    </main>
  );
}
