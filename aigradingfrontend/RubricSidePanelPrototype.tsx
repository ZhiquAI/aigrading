import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  ArrowLeft, 
  Save, 
  Sparkles, 
  MoreHorizontal, 
  FileText, 
  FolderOpen, 
  CheckCircle2, 
  AlertCircle,
  Calculator,
  ListChecks,
  Grid3X3,
  Trash2,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  Image as ImageIcon,
  X,
  Loader2,
  Eye,
  RefreshCw,
  Maximize2,
  Tag,
  Copy,
  BookTemplate,
  Filter,
  Settings2,
  Cloud,
  CloudOff,
  CloudCog
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithCustomToken,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query,
  writeBatch
} from 'firebase/firestore';

// --- Firebase Initialization (Using Global Environment Variables) ---
const firebaseConfig = JSON.parse(__firebase_config || '{}');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- 核心配置映射表 ---
const SUBJECT_CONFIG: Record<string, { label: string, color: string, types: { value: string, label: string, strategy: string }[] }> = {
  math: {
    label: '数学',
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    types: [
      { value: 'proof', label: '证明题', strategy: 'step_logic' },
      { value: 'calculation', label: '计算题', strategy: 'step_logic' },
      { value: 'blank', label: '填空题', strategy: 'point_accumulation' },
      { value: 'app', label: '应用题', strategy: 'step_logic' }
    ]
  },
  history: {
    label: '历史',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    types: [
      { value: 'material', label: '材料分析', strategy: 'point_accumulation' },
      { value: 'essay', label: '小论文', strategy: 'rubric_matrix' },
      { value: 'simple', label: '简答题', strategy: 'point_accumulation' }
    ]
  },
  english: {
    label: '英语',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    types: [
      { value: 'composition', label: '作文', strategy: 'rubric_matrix' },
      { value: 'translation', label: '翻译', strategy: 'point_accumulation' },
      { value: 'reading', label: '阅读理解', strategy: 'point_accumulation' }
    ]
  }
};

/**
 * 初始数据：规则库 (Unified Data Schema)
 * 注意：这些数据现在只作为"首次使用的种子数据"，之后将从 Firestore 读取
 */
const INITIAL_LIBRARY = [
  {
    id: 'rule_001',
    title: '九年级历史材料分析通用模版',
    is_template: true,
    metadata: { subject: 'history', grade: '9', type: 'material', tags: ['文科', '通用'] },
    strategy_type: 'point_accumulation',
    content: {
      points: [
        { id: 'p1', keyword: '经济重心南移', score: 2, mandatory: true },
        { id: 'p2', keyword: '海外贸易繁荣', score: 2, mandatory: false },
        { id: 'p3', keyword: '市舶司', score: 2, mandatory: false }
      ],
      constraints: [{ type: 'typo', penalty: 0.5 }]
    }
  },
  {
    id: 'rule_002',
    title: '初二数学-几何证明题标准',
    is_template: true,
    metadata: { subject: 'math', grade: '8', type: 'proof', tags: ['理科', '逻辑'] },
    strategy_type: 'step_logic',
    content: {
      steps: [
        { id: 's1', logic: '正确画出辅助线', score: 2 },
        { id: 's2', logic: '证明三角形全等 (SAS)', score: 4 },
        { id: 's3', logic: '得出结论 AB=CD', score: 2 }
      ],
      constraints: []
    }
  },
  {
    id: 'rule_004',
    title: '初二数学-填空题评分标准',
    is_template: true,
    metadata: { subject: 'math', grade: '8', type: 'blank', tags: ['理科', '基础'] },
    strategy_type: 'point_accumulation',
    content: {
      points: [
        { id: 'p1', keyword: 'x=5', score: 2, mandatory: true },
        { id: 'p2', keyword: '或x=-5', score: 2, mandatory: true }
      ],
      constraints: []
    }
  },
  {
    id: 'rule_003',
    title: '英语作文-议论文评分量表',
    is_template: true,
    metadata: { subject: 'english', grade: '9', type: 'composition', tags: ['语言', '作文'] },
    strategy_type: 'rubric_matrix',
    content: {
      dimensions: [
        { name: 'Content (内容)', weight: 0.4, levels: [{ label: 'A', score: 10, desc: '观点明确' }, { label: 'B', score: 8, desc: '观点较明确' }] },
        { name: 'Grammar (语法)', weight: 0.3, levels: [{ label: 'A', score: 10, desc: '无语法错误' }, { label: 'B', score: 7, desc: '少量错误' }] },
        { name: 'Structure (结构)', weight: 0.3, levels: [{ label: 'A', score: 10, desc: '逻辑清晰' }, { label: 'B', score: 7, desc: '结构完整' }] }
      ]
    }
  }
];

// ------------------- 组件部分 -------------------

// 1. 策略图标映射
const StrategyIcon = ({ type, className }: { type: string, className?: string }) => {
  switch (type) {
    case 'step_logic': return <Calculator className={className} />; // 数学
    case 'rubric_matrix': return <Grid3X3 className={className} />; // 作文
    case 'point_accumulation': default: return <ListChecks className={className} />; // 简答
  }
};

// 2. 颜色映射 (从 CONFIG 获取)
const SubjectColor = (subject: string) => {
  return SUBJECT_CONFIG[subject]?.color || 'bg-slate-100 text-slate-800 border-slate-200';
};

export default function GradingSidePanel() {
  const [library, setLibrary] = useState<any[]>([]); // 初始为空，等待云端数据
  const [currentView, setCurrentView] = useState<'library' | 'upload' | 'editor'>('library');
  const [activeRule, setActiveRule] = useState<any>(null);
  
  // UI 交互状态
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<{question: string | null, answer: string | null}>({ question: null, answer: null });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewImage, setPreviewImage] = useState<'question' | 'answer' | null>(null);

  // 云端同步状态
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<'init' | 'synced' | 'syncing' | 'error'>('init');

  // --- Effect 1: Auth Initialization ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // --- Effect 2: Firestore Sync (Read) ---
  useEffect(() => {
    if (!user) return;
    
    setSyncStatus('syncing');
    
    // 监听用户私有规则库: /artifacts/{appId}/users/{userId}/rules
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'rules'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // 首次加载，如果是空的，则写入初始种子数据 (Seeding)
      if (snapshot.empty && syncStatus === 'init') {
          console.log("Creating initial seed data...");
          const batch = writeBatch(db);
          INITIAL_LIBRARY.forEach(rule => {
              const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'rules', rule.id);
              batch.set(ref, rule);
          });
          batch.commit().then(() => console.log("Seeding complete"));
          // 此时不手动 setLibrary，等待下一次 snapshot 回调
      } else {
          const rules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // 按最近修改时间排序（这里暂时没加时间戳，可以用 id 或 index）
          setLibrary(rules);
          setSyncStatus('synced');
      }
    }, (error) => {
        console.error("Sync error:", error);
        setSyncStatus('error');
    });

    return () => unsubscribe();
  }, [user]); // 仅当 user 变化时重新订阅

  // ------------------- 视图 1: 规则库 (Library) -------------------
  const LibraryView = () => {
    const [filter, setFilter] = useState('all');
    const [subFilter, setSubFilter] = useState('all'); // 二级筛选：题型

    useEffect(() => {
        setSubFilter('all');
    }, [filter]);

    const filteredRules = library.filter(r => {
        const matchSubject = filter === 'all' || r.metadata?.subject === filter;
        const matchType = subFilter === 'all' || r.metadata?.type === subFilter;
        return matchSubject && matchType;
    });

    return (
      <div className="flex flex-col h-full bg-slate-50">
        {/* Header */}
        <div className="bg-white px-4 py-3 border-b border-slate-200 shadow-sm sticky top-0 z-10">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FolderOpen size={20} className="text-indigo-600" />
              规则库
              <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{library.length}</span>
            </h1>
            
            <div className="flex items-center gap-2">
               {/* 云端状态指示器 */}
               <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                  {syncStatus === 'synced' && <><Cloud size={12} className="text-green-500" /> 已同步</>}
                  {syncStatus === 'syncing' && <><RefreshCw size={12} className="text-blue-500 animate-spin" /> 同步中...</>}
                  {(syncStatus === 'error' || syncStatus === 'init') && <><CloudOff size={12} className="text-red-400" /> 离线</>}
               </div>
               
               <button 
                  onClick={() => setCurrentView('upload')}
                  className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors"
                >
                  <Plus size={18} />
                </button>
            </div>
          </div>
          
          {/* Search & AI Trigger */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="搜索规则或模版..." 
              className="w-full pl-9 pr-10 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              onClick={() => setCurrentView('upload')}
              className="absolute right-2 top-1.5 p-1 text-purple-600 hover:bg-purple-100 rounded-md transition-colors"
              title="AI 智能生成"
            >
              <Sparkles size={16} />
            </button>
          </div>

          {/* Filters (Level 1: Subject) */}
          <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
            <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border ${filter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
            >全部</button>
            {Object.entries(SUBJECT_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border ${
                  filter === key 
                    ? 'bg-slate-800 text-white border-slate-800' 
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>

          {/* Filters (Level 2: Types) */}
          {filter !== 'all' && SUBJECT_CONFIG[filter] && (
            <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar pb-1 border-t border-dashed border-slate-200 pt-2 animate-in slide-in-from-top-1">
                <span className="text-[10px] text-slate-400 py-1 flex items-center gap-1"><Filter size={10}/> 题型:</span>
                <button 
                    onClick={() => setSubFilter('all')}
                    className={`text-[10px] px-2 py-0.5 rounded ${subFilter === 'all' ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:bg-slate-100'}`}
                >全部</button>
                {SUBJECT_CONFIG[filter].types.map(t => (
                    <button
                        key={t.value}
                        onClick={() => setSubFilter(t.value)}
                        className={`text-[10px] px-2 py-0.5 rounded whitespace-nowrap transition-colors ${
                            subFilter === t.value 
                                ? 'bg-indigo-50 text-indigo-600 font-medium' 
                                : 'text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
          )}
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {library.length === 0 && syncStatus === 'syncing' ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                  <Loader2 className="animate-spin" />
                  <span className="text-xs">正在从云端加载规则...</span>
              </div>
          ) : (
             filteredRules.map(rule => (
                <div 
                  key={rule.id}
                  onClick={() => { setActiveRule(rule); setCurrentView('editor'); }}
                  className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-400 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${SubjectColor(rule.metadata.subject)}`}>
                      {SUBJECT_CONFIG[rule.metadata.subject]?.label || rule.metadata.subject}
                    </div>
                    {rule.is_template && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1"><BookTemplate size={10}/> 通用模版</span>}
                  </div>
                  
                  <h3 className="font-semibold text-slate-800 mb-1 line-clamp-1">{rule.title}</h3>
                  
                  <div className="flex items-center text-xs text-slate-500 gap-3 mb-2">
                    <span className="flex items-center gap-1 text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded">
                      {SUBJECT_CONFIG[rule.metadata.subject]?.types.find(t => t.value === rule.metadata.type)?.label || rule.metadata.type}
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <StrategyIcon type={rule.strategy_type} className="w-3 h-3" />
                      {rule.strategy_type === 'step_logic' ? '逻辑' : rule.strategy_type === 'rubric_matrix' ? '量表' : '采点'}
                    </span>
                    <span>• {rule.metadata.grade}年级</span>
                  </div>

                  {rule.metadata.tags && rule.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {rule.metadata.tags.map((t: string, i: number) => (
                        <span key={i} className="text-[10px] text-slate-400 bg-slate-50 px-1.5 rounded">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
          )}
          
          {filteredRules.length === 0 && library.length > 0 && (
            <div className="text-center py-10 text-slate-400 text-xs">
              没有找到相关规则<br/>
              {filter !== 'all' && subFilter !== 'all' && `(在${SUBJECT_CONFIG[filter].label} - ${SUBJECT_CONFIG[filter].types.find(t=>t.value===subFilter)?.label}下)`}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ------------------- 视图 2: Upload View (保持逻辑不变，只展示部分代码) -------------------
  const UploadView = () => {
    // ... State ...
    const [config, setConfig] = useState({ subject: 'math', type: 'proof' });
    const [isCustomType, setIsCustomType] = useState(false);
    const [customTypeName, setCustomTypeName] = useState('');
    const [customStrategy, setCustomStrategy] = useState('point_accumulation');

    const handleSubjectChange = (subject: string) => {
        setConfig({ subject, type: SUBJECT_CONFIG[subject].types[0].value });
        setIsCustomType(false);
    };

    const handleTypeChange = (val: string) => {
        if (val === 'custom') {
            setIsCustomType(true); setConfig(prev => ({ ...prev, type: 'custom' }));
        } else {
            setIsCustomType(false); setConfig(prev => ({ ...prev, type: val }));
        }
    };

    const handleFileSelect = (type: 'question' | 'answer') => {
      setUploadedFiles(prev => ({ ...prev, [type]: type === 'question' ? 'mock_question_img' : 'mock_answer_img' }));
    };

    const handleGenerate = () => {
      if (!uploadedFiles.question) return;
      setIsAnalyzing(true);
      
      let targetStrategy = 'point_accumulation';
      let targetTypeLabel = '';
      let targetTypeValue = '';

      if (isCustomType) {
          targetStrategy = customStrategy;
          targetTypeLabel = customTypeName || '自定义题型';
          targetTypeValue = customTypeName || 'custom_type';
      } else {
          const subjectConfig = SUBJECT_CONFIG[config.subject];
          const typeConfig = subjectConfig.types.find(t => t.value === config.type);
          targetStrategy = typeConfig?.strategy || 'point_accumulation';
          targetTypeLabel = typeConfig?.label || config.type;
          targetTypeValue = config.type;
      }

      setTimeout(() => {
        setIsAnalyzing(false);
        let generatedContent = {};
        if (targetStrategy === 'step_logic') {
             generatedContent = { steps: [{ id: 's1', logic: 'AI分析关键步骤1', score: 2 }, { id: 's2', logic: 'AI分析关键步骤2', score: 3 }], constraints: [] };
        } else if (targetStrategy === 'rubric_matrix') {
             generatedContent = { dimensions: [{ name: '维度1', weight: 0.5, levels: [{label:'A', score:10, desc:'表现优秀'}, {label:'B', score:8, desc:'表现良好'}] }] };
        } else {
             generatedContent = { points: [{ id: 'p1', keyword: 'AI提取关键点', score: 2, mandatory: true }], constraints: [] };
        }

        const newRule = {
          id: `generated_${Date.now()}`,
          title: `AI生成: ${SUBJECT_CONFIG[config.subject].label}-${targetTypeLabel}`,
          is_template: false,
          metadata: { subject: config.subject, grade: '9', type: targetTypeValue, tags: ['AI生成', targetTypeLabel] },
          strategy_type: targetStrategy,
          content: generatedContent
        };
        setActiveRule(newRule);
        setCurrentView('editor');
        setToastMessage(`已生成评分标准 (策略: ${targetStrategy === 'step_logic' ? '逻辑步骤' : targetStrategy === 'rubric_matrix' ? '维度量表' : '采点累加'})`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }, 1500);
    };
    
    // ... UI (与之前相同，这里简化以聚焦核心逻辑) ...
    const UploadCard = ({ title, type, icon: Icon, isRequired }: any) => {
        const hasFile = uploadedFiles[type as 'question' | 'answer'];
        return (
          <div className="space-y-2">
            <div className="flex justify-between items-center"><label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Icon size={16} className="text-indigo-600" />{title}</label>{isRequired && <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">必填</span>}</div>
            <div onClick={() => !hasFile && handleFileSelect(type)} className={`relative h-28 rounded-xl border-2 border-dashed transition-all cursor-pointer group overflow-hidden ${hasFile ? 'border-indigo-200 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}>
              {hasFile ? <div className="w-full h-full flex flex-col items-center justify-center relative"><div className="w-12 h-16 bg-white shadow-sm border border-slate-200 rounded flex items-center justify-center mb-1"><ImageIcon className="text-slate-300" size={20} /></div><span className="text-[10px] text-indigo-600 font-medium">image.png</span><button onClick={(e) => { e.stopPropagation(); setUploadedFiles(prev => ({...prev, [type]: null})) }} className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-red-50 text-slate-400 hover:text-red-500"><X size={12} /></button></div> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 group-hover:text-indigo-500"><UploadCloud size={24} className="mb-2" /><span className="text-xs">点击上传</span></div>}
            </div>
          </div>
        );
    };

    return (
      <div className="flex flex-col h-full bg-white">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2"><button onClick={() => setCurrentView('library')} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ArrowLeft size={20} /></button><h1 className="text-base font-bold text-slate-800">新建评分规则</h1></div>
        <div className="flex-1 p-5 space-y-5 overflow-y-auto">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
             <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-slate-500 mb-1.5 block">选择学科</label><div className="relative"><select value={config.subject} onChange={(e) => handleSubjectChange(e.target.value)} className="w-full text-sm appearance-none bg-white border border-slate-200 rounded-lg py-2 px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">{Object.entries(SUBJECT_CONFIG).map(([key, val]) => (<option key={key} value={key}>{val.label}</option>))}</select><ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" /></div></div>
                <div>
                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">选择题型</label>
                    <div className="relative">
                        <select value={config.type} onChange={(e) => handleTypeChange(e.target.value)} className="w-full text-sm appearance-none bg-white border border-slate-200 rounded-lg py-2 px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            {SUBJECT_CONFIG[config.subject].types.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
                            <option value="custom" className="font-bold text-indigo-600">+ 自定义题型...</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                    </div>
                </div>
             </div>
             {isCustomType && (
                 <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm animate-in slide-in-from-top-2 space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                    <div className="flex items-center gap-2 text-indigo-700 mb-1"><Settings2 size={14} /><span className="text-xs font-bold">配置自定义规则</span></div>
                    <div><label className="text-[10px] font-bold text-slate-500 mb-1 block">新题型名称</label><input type="text" value={customTypeName} onChange={(e) => setCustomTypeName(e.target.value)} placeholder="例如：实验探究题" className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 focus:border-indigo-500 outline-none"/></div>
                    <div><label className="text-[10px] font-bold text-slate-500 mb-1 block">AI 评分策略 (核心逻辑)</label><select value={customStrategy} onChange={(e) => setCustomStrategy(e.target.value)} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-slate-50 focus:border-indigo-500 outline-none"><option value="point_accumulation">🎯 采点累加 (适用于填空/简答)</option><option value="step_logic">📐 逻辑步骤 (适用于证明/大题)</option><option value="rubric_matrix">📊 维度量表 (适用于作文/论述)</option></select></div>
                 </div>
             )}
          </div>
          <UploadCard title="试题图片" type="question" icon={FileText} isRequired={true} />
          <UploadCard title="参考答案 / 评分标准" type="answer" icon={CheckCircle2} isRequired={false} />
        </div>
        <div className="p-4 border-t border-slate-200 bg-white"><button disabled={!uploadedFiles.question || isAnalyzing} onClick={handleGenerate} className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-sm ${(!uploadedFiles.question || isAnalyzing) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md hover:scale-[1.01]'}`}>{isAnalyzing ? <><Loader2 size={18} className="animate-spin" />AI 正在深度分析 (2s)...</> : <><Sparkles size={18} />生成评分细则</>}</button></div>
      </div>
    );
  };

  // ------------------- 视图 3: 规则编辑器 (Polymorphic Editor) -------------------
  
  const AccumulationEditor = ({ content, onUpdate }: { content: any, onUpdate: (newContent: any) => void }) => {
    const updatePoint = (idx: number, field: string, val: any) => { const newPoints = [...content.points]; newPoints[idx] = { ...newPoints[idx], [field]: val }; onUpdate({ ...content, points: newPoints }); };
    const addPoint = () => { onUpdate({ ...content, points: [...content.points, { id: `new_${Date.now()}`, keyword: '', score: 1, mandatory: false }] }); };
    const deletePoint = (idx: number) => { onUpdate({ ...content, points: content.points.filter((_: any, i: number) => i !== idx) }); };
    return (
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs text-blue-700 mb-2">💡 适用于简答题/填空题。系统将检测关键词命中情况。</div>
        {content.points.map((p: any, idx: number) => (
          <div key={p.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm group relative">
            <button onClick={() => deletePoint(idx)} className="absolute right-2 top-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
            <div className="flex justify-between items-start mb-2 mr-6"><span className="text-xs font-bold text-slate-400">#{idx + 1}</span><div className="flex items-center gap-2"><input type="number" value={p.score} onChange={(e) => updatePoint(idx, 'score', parseFloat(e.target.value))} className="w-12 text-center text-sm border border-slate-200 rounded py-0.5 bg-slate-50 focus:border-blue-400 outline-none" /><span className="text-xs text-slate-500">分</span></div></div>
            <input type="text" value={p.keyword} onChange={(e) => updatePoint(idx, 'keyword', e.target.value)} className="w-full text-sm font-medium border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none pb-1 bg-transparent" placeholder="输入关键词..." />
            <div className="mt-2 flex gap-2"><label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={p.mandatory} onChange={(e) => updatePoint(idx, 'mandatory', e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5" /><span className="text-xs text-slate-500">必须包含</span></label></div>
          </div>
        ))}
        <button onClick={addPoint} className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-slate-500 text-sm hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-300 flex items-center justify-center gap-2"><Plus size={14} /> 添加得分点</button>
      </div>
    );
  };
  
  const StepLogicEditor = ({ content, onUpdate }: { content: any, onUpdate: (newContent: any) => void }) => {
    const updateStep = (idx: number, field: string, val: any) => { const newSteps = [...content.steps]; newSteps[idx] = { ...newSteps[idx], [field]: val }; onUpdate({ ...content, steps: newSteps }); };
    const addStep = () => { onUpdate({ ...content, steps: [...content.steps, { id: `new_${Date.now()}`, logic: '', score: 1 }] }); };
    const deleteStep = (idx: number) => { onUpdate({ ...content, steps: content.steps.filter((_: any, i: number) => i !== idx) }); };
    return (
      <div className="space-y-0 relative pl-4 border-l-2 border-slate-200 ml-2">
        <div className="absolute -left-[21px] top-0 bg-teal-50 border border-teal-100 p-2 rounded-lg text-xs text-teal-700 w-[calc(100%+20px)] mb-4">📐 适用于数理化大题。AI 将按顺序验证逻辑步骤。</div>
        {content.steps.map((s: any, idx: number) => (
          <div key={s.id} className="relative mb-6 last:mb-0 group">
            <div className="absolute -left-[25px] top-3 w-4 h-4 rounded-full bg-white border-2 border-teal-500 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div></div>
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm ml-2 relative">
               <button onClick={() => deleteStep(idx)} className="absolute right-2 top-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"><Trash2 size={14} /></button>
               <div className="flex justify-between items-center mb-2 mr-5"><span className="text-xs font-semibold text-teal-600 uppercase">Step {idx + 1}</span><div className="flex items-center bg-teal-50 rounded px-2 py-0.5 border border-teal-100"><input type="number" value={s.score} onChange={(e) => updateStep(idx, 'score', parseFloat(e.target.value))} className="w-8 text-center bg-transparent text-xs font-bold text-teal-700 outline-none" /><span className="text-[10px] text-teal-600">分</span></div></div>
               <textarea className="w-full text-sm border-none bg-slate-50 rounded p-2 focus:ring-1 focus:ring-teal-500 resize-none" rows={2} value={s.logic} onChange={(e) => updateStep(idx, 'logic', e.target.value)} placeholder="描述这一步的逻辑..." />
            </div>
          </div>
        ))}
         <button onClick={addStep} className="ml-2 mt-4 text-xs font-medium text-teal-600 flex items-center gap-1 hover:underline"><Plus size={12} /> 插入步骤</button>
      </div>
    );
  };

  const RubricEditor = ({ content }: { content: any }) => {
    const [expandedDim, setExpandedDim] = useState<number | null>(0);
    return (
      <div className="space-y-3">
        <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg text-xs text-orange-700 mb-2">📝 适用于作文/论述。点击维度查看具体等级标准。</div>
        {content.dimensions.map((dim: any, idx: number) => (
          <div key={idx} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-50 flex justify-between items-center cursor-pointer hover:bg-slate-100" onClick={() => setExpandedDim(expandedDim === idx ? null : idx)}>
              <div className="flex items-center gap-2">{expandedDim === idx ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}<span className="text-sm font-semibold text-slate-700">{dim.name}</span></div><span className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">权重 {dim.weight * 100}%</span>
            </div>
            {expandedDim === idx && (
              <div className="p-3 border-t border-slate-200 space-y-3 bg-white">
                {dim.levels.map((lvl: any, lIdx: number) => (
                  <div key={lIdx} className="flex gap-3"><div className="w-10 h-10 shrink-0 rounded-lg bg-orange-100 flex flex-col items-center justify-center border border-orange-200"><span className="text-sm font-bold text-orange-800">{lvl.label}</span></div><div className="flex-1"><input type="text" defaultValue={lvl.desc} className="w-full text-sm border border-slate-200 rounded p-1.5 focus:border-orange-400 outline-none" /></div></div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const EditorView = () => {
    if (!activeRule) return null;
    const showSourceImages = activeRule.id.startsWith('generated') || activeRule.is_template === false;

    // 状态管理
    const handleContentUpdate = (newContent: any) => { setActiveRule({ ...activeRule, content: newContent }); };
    const handleMetadataUpdate = (field: string, val: any) => { setActiveRule({ ...activeRule, metadata: { ...activeRule.metadata, [field]: val } }); };

    // --- Save Logic with Firestore Sync (Upsert) ---
    const handleSave = async () => {
        if (!user) {
            setToastMessage('请先登录再保存');
            setShowToast(true);
            return;
        }

        setSyncStatus('syncing');
        
        try {
            // 写入到用户的私有集合中
            const ruleRef = doc(db, 'artifacts', appId, 'users', user.uid, 'rules', activeRule.id);
            await setDoc(ruleRef, activeRule);
            
            setSyncStatus('synced');
            setToastMessage('规则已同步到云端');
            setShowToast(true);
            setTimeout(() => {
                setShowToast(false);
                setCurrentView('library');
            }, 1000);
        } catch (error) {
            console.error("Save error:", error);
            setSyncStatus('error');
            setToastMessage('保存失败，请重试');
            setShowToast(true);
        }
    };

    const [tagInput, setTagInput] = useState('');
    const addTag = () => { if (tagInput && !activeRule.metadata.tags.includes(tagInput)) { handleMetadataUpdate('tags', [...activeRule.metadata.tags, tagInput]); setTagInput(''); } };
    const removeTag = (tagToRemove: string) => { handleMetadataUpdate('tags', activeRule.metadata.tags.filter((t: string) => t !== tagToRemove)); };

    return (
      <div className="flex flex-col h-full bg-slate-50 relative">
        {/* 原图预览浮层 */}
        {previewImage && (
          <div className="absolute inset-0 z-50 bg-black/80 flex flex-col animate-in fade-in duration-200">
            <div className="flex justify-between items-center p-3 text-white bg-black/40 backdrop-blur-sm">
              <span className="font-medium text-sm flex items-center gap-2">{previewImage === 'question' ? <ImageIcon size={16}/> : <CheckCircle2 size={16}/>}{previewImage === 'question' ? '试题原图' : '参考答案原图'}</span>
              <button onClick={() => setPreviewImage(null)} className="p-1 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <div className="flex-1 p-4 flex items-center justify-center overflow-auto">
              <div className="w-full h-auto min-h-[200px] bg-white text-slate-400 rounded flex flex-col items-center justify-center p-8">
                 <ImageIcon size={48} className="mb-2 opacity-20" /><p className="text-xs text-center">此处显示原始上传的图片...<br/>方便用户对照校正 AI 的偏差</p>
              </div>
            </div>
          </div>
        )}

        {/* Editor Header */}
        <div className="bg-white px-4 py-3 border-b border-slate-200 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => setCurrentView('library')} className="p-1 hover:bg-slate-100 rounded"><ArrowLeft size={20} className="text-slate-600" /></button>
            <div className="flex-1 min-w-0">
               <h2 className="text-base font-bold text-slate-800 truncate">{activeRule.title}</h2>
               <div className="flex gap-2 text-xs text-slate-500 mt-0.5">
                   <span className="capitalize">{SUBJECT_CONFIG[activeRule.metadata.subject]?.label || activeRule.metadata.subject}</span> • 
                   <span className="ml-1 text-slate-400">{SUBJECT_CONFIG[activeRule.metadata.subject]?.types.find(t=>t.value===activeRule.metadata.type)?.label || activeRule.metadata.type}</span>
               </div>
            </div>
            <button 
                onClick={handleSave} 
                disabled={syncStatus === 'syncing'}
                className="text-indigo-600 font-medium text-sm flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 hover:shadow-sm active:scale-95 transition-all disabled:opacity-50"
            >
              {syncStatus === 'syncing' ? <Loader2 size={16} className="animate-spin"/> : <Save size={16} />} 
              保存
            </button>
          </div>
          {/* 原图查看入口 */}
          {showSourceImages && (
            <div className="flex gap-2 mt-1 mb-1">
              <button onClick={() => setPreviewImage('question')} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs py-1.5 rounded border border-slate-200 transition-colors"><Eye size={12} /> 对照试题</button>
              <button onClick={() => setPreviewImage('answer')} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs py-1.5 rounded border border-slate-200 transition-colors"><Eye size={12} /> 对照答案</button>
            </div>
          )}
        </div>

        {/* Editor Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-6 space-y-3 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
             <div><label className="text-xs font-medium text-slate-500 mb-1 block">规则名称</label><input type="text" value={activeRule.title} onChange={(e) => setActiveRule({...activeRule, title: e.target.value})} className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all" /></div>
             <div className="flex items-center justify-between py-1"><div className="flex items-center gap-2"><BookTemplate size={14} className={activeRule.is_template ? "text-indigo-600" : "text-slate-400"} /><span className="text-xs font-medium text-slate-700">设为通用模版</span></div><div onClick={() => setActiveRule({...activeRule, is_template: !activeRule.is_template})} className={`w-9 h-5 rounded-full cursor-pointer relative transition-colors ${activeRule.is_template ? 'bg-indigo-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${activeRule.is_template ? 'translate-x-4' : ''}`}></div></div></div>
             <div><label className="text-xs font-medium text-slate-500 mb-1 block">标签 (用于筛选)</label><div className="flex flex-wrap gap-2 mb-2">{activeRule.metadata.tags.map((tag: string) => (<span key={tag} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md flex items-center gap-1 border border-indigo-100">{tag}<X size={10} className="cursor-pointer hover:text-indigo-900" onClick={() => removeTag(tag)}/></span>))}</div><div className="flex gap-2"><input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} placeholder="输入标签按回车..." className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 focus:border-indigo-400 outline-none" /><button onClick={addTag} className="p-1.5 bg-slate-100 rounded hover:bg-slate-200 text-slate-600"><Plus size={14}/></button></div></div>
          </div>
          <div className="border-t border-slate-200 my-4"></div>
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between"><span>评分细则配置</span><button className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-100" title="重新分析图片"><RefreshCw size={10} /> AI 重建</button></h3>
          {activeRule.strategy_type === 'point_accumulation' && <AccumulationEditor content={activeRule.content} onUpdate={handleContentUpdate} />}
          {activeRule.strategy_type === 'step_logic' && <StepLogicEditor content={activeRule.content} onUpdate={handleContentUpdate} />}
          {activeRule.strategy_type === 'rubric_matrix' && <RubricEditor content={activeRule.content} />}
          <div className="mt-8 pt-4 border-t border-slate-200"><h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">通用扣分规则</h3><div className="space-y-2">{activeRule.content.constraints?.map((c: any, idx: number) => (<div key={idx} className="flex items-center justify-between p-2 bg-slate-100 rounded border border-slate-200 group"><div className="flex items-center gap-2"><AlertCircle size={14} className="text-red-500" /><span className="text-xs text-slate-700">{c.type === 'typo' ? '错别字扣分' : '其他扣分'}</span></div><div className="flex items-center gap-2"><div className="flex items-center gap-1"><span className="text-xs text-slate-400">扣</span><span className="w-6 text-center text-xs font-bold">{c.penalty}</span><span className="text-xs text-slate-400">分</span></div><button className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button></div></div>))}<button className="text-xs text-indigo-600 font-medium hover:underline pl-1">+ 添加约束条件</button></div></div>
        </div>
        {showToast && (<div className="fixed top-20 left-4 right-4 bg-slate-800 text-white text-sm py-3 px-4 rounded-lg shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 z-50">{toastMessage.includes('已') ? <CheckCircle2 size={16} className="text-green-400 shrink-0" /> : <Sparkles size={16} className="text-yellow-400 shrink-0" />}<span className="flex-1">{toastMessage}</span></div>)}
      </div>
    );
  };

  return (
    <div className="w-full max-w-md h-screen mx-auto bg-white border-x border-slate-200 font-sans text-slate-900 shadow-xl overflow-hidden">
      {currentView === 'library' && <LibraryView />}
      {currentView === 'upload' && <UploadView />}
      {currentView === 'editor' && <EditorView />}
    </div>
  );
}
