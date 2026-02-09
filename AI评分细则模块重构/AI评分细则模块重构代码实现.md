import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Check, 
  AlertTriangle, 
  RotateCcw, 
  Settings, 
  Zap, 
  Hand, 
  Eye, 
  Cpu,
  ArrowLeft,
  MousePointerClick,
  Target,
  Loader2,
  Sparkles
} from 'lucide-react';

// --- 类型定义 ---
type GradingMode = 'assisted' | 'auto';
type GradingStatus = 'idle' | 'scanning' | 'analyzing' | 'review' | 'submitting' | 'paused';

interface GradingResult {
  studentName: string;
  totalScore: number;
  maxScore: number;
  confidence: number; // AI 置信度 0-1
  breakdown: {
    id: string;
    label: string;
    score: number;
    max: number;
    met: boolean;
    evidence?: string; // OCR 原文片段
  }[];
  comments: string[];
}

// 模拟从上一模块传入的规则数据
const MOCK_RULE = {
  id: 'rule_001',
  title: '初二数学-几何证明题标准',
  strategy: 'step_logic'
};

export default function IntelligentGrading() {
  // --- 状态管理 ---
  const [mode, setMode] = useState<GradingMode>('assisted');
  const [status, setStatus] = useState<GradingStatus>('idle');
  const [progress, setProgress] = useState({ current: 12, total: 45 });
  const [result, setResult] = useState<GradingResult | null>(null);
  const [autoCountdown, setAutoCountdown] = useState(3);

  // 模拟引用
  const timerRef = useRef<any>(null);

  // --- 核心逻辑模拟 ---

  // 1. 模拟开始阅卷一个学生
  const startGradingStudent = () => {
    setStatus('scanning');
    setResult(null);
    
    // 模拟 OCR 扫描耗时
    setTimeout(() => {
      setStatus('analyzing');
      // 模拟 AI 分析耗时
      setTimeout(() => {
        // 生成模拟结果
        const mockResult: GradingResult = {
          studentName: `学生 ${Math.floor(Math.random() * 1000)}`,
          totalScore: 8,
          maxScore: 10,
          confidence: Math.random() > 0.3 ? 0.95 : 0.65, // 模拟偶尔出现的低置信度
          breakdown: [
            { id: 's1', label: '辅助线作图正确', score: 2, max: 2, met: true, evidence: '图中有明显虚线连接BD' },
            { id: 's2', label: '全等三角形证明过程', score: 4, max: 5, met: false, evidence: '未注明 SAS 依据' }, // 扣分点
            { id: 's3', label: '最终结论', score: 2, max: 3, met: true, evidence: '结论 AB=CD' }
          ],
          comments: ['步骤完整', '注意书写规范']
        };
        
        setResult(mockResult);
        
        // 核心分支：自动模式 vs 辅助模式
        if (mode === 'auto') {
           if (mockResult.confidence < 0.8) {
             // 异常中断：置信度低
             setStatus('paused'); 
           } else {
             // 正常流程：进入倒计时提交
             setStatus('review'); // 在自动模式下，review 只是一个倒计时状态
             let count = 3;
             setAutoCountdown(count);
             timerRef.current = setInterval(() => {
               count--;
               setAutoCountdown(count);
               if (count <= 0) {
                 clearInterval(timerRef.current);
                 handleSubmitAndNext();
               }
             }, 1000);
           }
        } else {
           // 辅助模式：停留在 Review 等待老师操作
           setStatus('review');
        }
    
      }, 1500);
    }, 800);
  };

  // 2. 模拟提交并下一个
  const handleSubmitAndNext = () => {
    setStatus('submitting');
    setTimeout(() => {
      setProgress(p => ({ ...p, current: p.current + 1 }));
      startGradingStudent(); // 循环调用
    }, 600);
  };

  // 3. 切换模式时的处理
  useEffect(() => {
    if (status !== 'idle') {
      // 切换模式时重置状态，防止逻辑冲突
      clearInterval(timerRef.current);
      setStatus('idle');
    }
  }, [mode]);

  // --- UI 组件 ---

  // 顶部导航栏
  const Header = () => (
    <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20">
      <div className="flex items-center justify-between mb-3">
        <button className="text-slate-500 hover:bg-slate-100 p-1 rounded"><ArrowLeft size={18} /></button>
        <div className="text-center">
          <div className="text-sm font-bold text-slate-800">{MOCK_RULE.title}</div>
          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            已连接智学网阅卷页
          </div>
        </div>
        <button className="text-slate-500 hover:bg-slate-100 p-1 rounded"><Settings size={18} /></button>
      </div>

      {/* 模式切换器 */}
      <div className="bg-slate-100 p-1 rounded-lg flex relative">
        <div 
          className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded shadow-sm transition-all duration-300 ease-in-out ${mode === 'auto' ? 'left-[calc(50%+2px)]' : 'left-1'}`}
        ></div>
        <button 
          onClick={() => setMode('assisted')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold relative z-10 transition-colors ${mode === 'assisted' ? 'text-indigo-600' : 'text-slate-500'}`}
        >
          <Hand size={14} /> 辅助阅卷
        </button>
        <button 
          onClick={() => setMode('auto')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold relative z-10 transition-colors ${mode === 'auto' ? 'text-purple-600' : 'text-slate-500'}`}
        >
          <Zap size={14} /> 自动阅卷
        </button>
      </div>
    </div>
  );

  // 进度条
  const ProgressBar = () => (
    <div className="px-4 py-3 bg-white border-b border-slate-100">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>当前进度: {progress.current}/{progress.total}</span>
        <span>{(progress.current / progress.total * 100).toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${mode === 'auto' ? 'bg-purple-500' : 'bg-indigo-500'}`} 
          style={{ width: `${(progress.current / progress.total * 100)}%` }}
        ></div>
      </div>
    </div>
  );

  // 评分核心卡片
  const GradingCard = () => {
    if (!result) return null;

    // 修改分数的 Handler
    const toggleCheckpoint = (idx: number) => {
      if (mode === 'auto' && status === 'review') {
        // 如果在自动倒计时中修改，必须先暂停
        clearInterval(timerRef.current);
        setStatus('paused');
      }
      
      const newBreakdown = [...result.breakdown];
      newBreakdown[idx].met = !newBreakdown[idx].met;
      // 简单的重新计算总分逻辑
      const newScore = newBreakdown.reduce((acc, item) => acc + (item.met ? item.score : 0), 0);
      
      setResult({ ...result, breakdown: newBreakdown, totalScore: newScore });
    };
    
    return (
      <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4">
        {/* 学生信息与总分 */}
        <div className="flex justify-between items-start">
           <div>
             <h2 className="text-lg font-bold text-slate-800">{result.studentName}</h2>
             <div className="flex items-center gap-1 mt-1">
               <span className={`text-[10px] px-1.5 py-0.5 rounded ${result.confidence > 0.8 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                 AI置信度 {(result.confidence * 100).toFixed(0)}%
               </span>
               {result.confidence < 0.8 && <AlertTriangle size={12} className="text-yellow-600" />}
             </div>
           </div>
           <div className="text-right">
             <div className="text-3xl font-black text-indigo-600 font-mono">
               {result.totalScore}
               <span className="text-sm text-slate-400 font-normal">/{result.maxScore}</span>
             </div>
           </div>
        </div>
    
        {/* 证据截图 (Mock) */}
        <div className="relative h-24 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden group">
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
            [此处显示 AI 截取的答题区域图片]
          </div>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-1 bg-black/50 text-white rounded hover:bg-black/70"><Eye size={12}/></button>
          </div>
        </div>
    
        {/* 评分细则 Checkpoints */}
        <div className="space-y-2">
          {result.breakdown.map((item, idx) => (
            <div 
              key={item.id}
              onClick={() => toggleCheckpoint(idx)}
              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                item.met 
                  ? 'bg-white border-indigo-200 shadow-sm' 
                  : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                 <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                   item.met ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                 }`}>
                   {item.met && <Check size={12} />}
                 </div>
                 <div>
                   <div className={`text-sm font-medium ${item.met ? 'text-slate-800' : 'text-slate-500 line-through'}`}>{item.label}</div>
                   {item.evidence && <div className="text-[10px] text-slate-400 mt-0.5">AI依据: "{item.evidence}"</div>}
                 </div>
              </div>
              <div className="font-mono font-bold text-sm text-slate-600">
                {item.met ? `+${item.score}` : '0'}
              </div>
            </div>
          ))}
        </div>
    
        {/* AI 点评建议 */}
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
          <div className="text-[10px] font-bold text-blue-600 mb-1 flex items-center gap-1">
            <Sparkles size={10} /> AI 评语建议 (点击应用)
          </div>
          <div className="flex flex-wrap gap-2">
            {result.comments.map((comment, i) => (
              <span key={i} className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded-md cursor-pointer hover:bg-blue-100">
                {comment}
              </span>
            ))}
            <span className="text-xs border border-dashed border-blue-300 text-blue-400 px-2 py-1 rounded-md cursor-pointer hover:bg-white">+ 自定义</span>
          </div>
        </div>
      </div>
    );
  };

  // 状态视图：扫描/加载中
  const LoadingState = ({ text }: { text: string }) => (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
           <Cpu size={20} className="text-indigo-500" />
        </div>
      </div>
      <p className="text-xs animate-pulse">{text}</p>
    </div>
  );

  // 状态视图：自动阅卷监控器
  const AutoMonitor = () => {
    if (status === 'paused') {
        return (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 m-4 rounded shadow-sm">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="text-red-500 shrink-0" size={24} />
                    <div>
                        <h3 className="font-bold text-red-700">自动阅卷已暂停</h3>
                        <p className="text-xs text-red-600 mt-1">当前题目 AI 置信度低于 80%，需要人工确认。</p>
                        <div className="mt-3 flex gap-2">
                            <button onClick={() => setStatus('review')} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded font-medium hover:bg-red-700">介入修改</button>
                            <button onClick={() => { setStatus('review'); handleSubmitAndNext(); }} className="px-3 py-1.5 bg-white border border-red-200 text-red-700 text-xs rounded font-medium hover:bg-red-50">忽略并继续</button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4">
             <div className="bg-purple-900 text-white rounded-xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-700 rounded-full opacity-50 blur-xl"></div>
                
                <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-purple-800 border-4 border-purple-500 flex items-center justify-center shadow-inner">
                        {status === 'review' ? (
                            <span className="text-2xl font-black font-mono">{autoCountdown}s</span>
                        ) : (
                            <Loader2 size={32} className="animate-spin text-purple-300" />
                        )}
                    </div>
                    
                    <div>
                        <h3 className="font-bold text-lg">AI 自动阅卷运行中</h3>
                        <p className="text-xs text-purple-300 mt-1">
                            {status === 'scanning' ? '正在扫描答题卡...' : 
                             status === 'analyzing' ? '正在进行逻辑推理...' : 
                             status === 'submitting' ? '正在自动填分提交...' : 
                             '等待自动提交...'}
                        </p>
                    </div>
    
                    <button 
                        onClick={() => { clearInterval(timerRef.current); setStatus('paused'); }}
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-white/10"
                    >
                        <Pause size={16} fill="currentColor" /> 暂停运行
                    </button>
                </div>
    
                {/* Log Stream */}
                <div className="mt-4 pt-3 border-t border-purple-800 text-[10px] text-purple-300 font-mono space-y-1 opacity-70">
                    <div>{'>'} System check: OK</div>
                    <div>{'>'} Connected to: zhixue.com</div>
                    <div className="text-white">{'>'} Processing Student #{progress.current + 1}...</div>
                </div>
             </div>
        </div>
    );
  };

  // 底部操作栏 (仅辅助模式显示)
  const ActionFooter = () => (
    <div className="bg-white border-t border-slate-200 p-4 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      {status === 'idle' ? (
        <button 
          onClick={startGradingStudent}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
        >
          <Play size={18} fill="currentColor" /> 开始阅卷
        </button>
      ) : status === 'review' || status === 'paused' ? (
        <div className="flex gap-3">
          <button 
            onClick={startGradingStudent}
            className="flex-1 bg-white border border-slate-300 text-slate-600 py-2.5 rounded-lg font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-2"
          >
             <RotateCcw size={16} /> 重评
          </button>
          <button 
            onClick={handleSubmitAndNext}
            className="flex-[2] bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2"
          >
             <MousePointerClick size={16} /> 填分并提交
          </button>
        </div>
      ) : (
        <button disabled className="w-full bg-slate-100 text-slate-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-not-allowed">
           <Loader2 size={18} className="animate-spin" /> 处理中...
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      <Header />
      <ProgressBar />

      <div className="flex-1 overflow-y-auto pb-20">
        {status === 'idle' && (
           <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-8 text-center">
             <Target size={48} className="text-slate-200 mb-4" />
             <p className="text-sm">点击底部按钮开始阅卷。<br/>AI 将自动读取当前网页的答题卡区域。</p>
           </div>
        )}
    
        {/* 自动模式监控面板 */}
        {mode === 'auto' && status !== 'idle' && (
            <>
                <AutoMonitor />
                {/* 自动模式下，下方的 GradingCard 作为"实时预览"显示 */}
                <div className="px-4 pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">实时预览</div>
                <div className="opacity-80 pointer-events-none grayscale-[0.3]">
                   <GradingCard />
                </div>
            </>
        )}
    
        {/* 辅助模式 / 手动介入 操作面板 */}
        {mode === 'assisted' && status !== 'idle' && (
            <>
               {(status === 'scanning' || status === 'analyzing' || status === 'submitting') ? (
                  <div className="h-64 flex items-center justify-center">
                     <LoadingState text={status === 'scanning' ? '正在识别试卷...' : status === 'analyzing' ? 'AI 智能评分中...' : '正在写入智学网...'} />
                  </div>
               ) : (
                  <GradingCard />
               )}
            </>
        )}
      </div>
    
      {/* 底部按钮只在辅助模式，或者自动模式暂停时显示 */}
      {(mode === 'assisted' || status === 'idle') && <ActionFooter />}
    </div>
  );
}

---

## **实现落地清单（2026-02-06）**

### **后端**
- v3 Schema：`aigradingbackend/src/lib/rubric-v3.ts`
- v2→v3 转换器：`aigradingbackend/src/lib/rubric-convert.ts`
- 评分引擎：`aigradingbackend/src/lib/score-engine.ts`
- 判定提示词与解析：`aigradingbackend/src/lib/rubric-judge.ts`
- 模板库 API：`aigradingbackend/src/app/api/rubric/templates/route.ts`
- 模板推荐 API：`aigradingbackend/src/app/api/ai/rubric/recommend/route.ts`

### **前端**
- v3 类型与转换器：`aigradingfrontend/types/rubric-v3.ts`、`aigradingfrontend/utils/rubric-convert.ts`
- 三策略编辑器：`aigradingfrontend/src/components/v2/views/rubric-editors/*`
- 侧边栏规则库与模板库：`aigradingfrontend/src/components/v2/views/RubricView.tsx`
- 评分细则编辑器：`aigradingfrontend/src/components/v2/views/RubricCreateModal.tsx`
