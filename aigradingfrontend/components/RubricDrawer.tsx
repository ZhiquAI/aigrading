import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, FileQuestion, FileCheck2, Sparkles, BrainCircuit, Download, Upload, TableProperties, Save, Wand2, Send, X, Check, Code } from 'lucide-react';
import { generateRubricFromImages, standardizeRubric, refineRubric } from '../services/geminiService';
import { Button } from './ui';
import { toast } from './Toast';



interface RubricDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rubric: string) => void;
  initialRubric?: string;
  questionHint?: string;
  questionNo?: string;  // 新增：题号
  onQuestionNoChange?: (questionNo: string) => void;  // 新增：题号改变回调
}

type TabMode = 'ai' | 'import';

const RubricDrawer: React.FC<RubricDrawerProps> = ({ isOpen, onClose, onSave, initialRubric, questionHint, questionNo, onQuestionNoChange }) => {
  const [activeTab, setActiveTab] = useState<TabMode>('ai');
  const [qImage, setQImage] = useState<string | null>(null);
  const [aImage, setAImage] = useState<string | null>(null);
  const [rubricText, setRubricText] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'standardizing' | 'refining'>('idle');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [refineSuggestion, setRefineSuggestion] = useState('');



  const qInputRef = useRef<HTMLInputElement>(null);
  const aInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // 打开抽屉时加载当前题的已有评分标准
  useEffect(() => {
    if (!isOpen) return;
    setRubricText(initialRubric || '');
    setStatus((initialRubric && initialRubric.trim()) ? 'done' : 'idle');
    setShowSuccessToast(false);
  }, [isOpen, initialRubric]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setImg: (s: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        setImg(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    // 至少需要一张图片
    if (!qImage && !aImage) {
      toast.warning('请至少上传试卷或参考答案图片');
      return;
    }
    setStatus('processing');
    try {
      const text = await generateRubricFromImages(qImage, aImage);
      setRubricText(text);
      setStatus('done');
    } catch (e) {
      console.error(e);
      setRubricText("生成评分标准时出错，请检查 API Key。");
      setStatus('idle');
    }
  };

  const handleStandardize = async () => {
    if (!rubricText.trim()) return;
    setStatus('standardizing');
    try {
      const standardized = await standardizeRubric(rubricText);
      setRubricText(standardized);
      setStatus('done');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (e) {
      console.error(e);
      toast.error('标准化失败，请检查 API 连接');
      setStatus('done');
    }
  };

  // 优化评分细则
  const handleRefine = async () => {
    if (!rubricText.trim() || !refineSuggestion.trim()) return;
    setStatus('refining');
    setShowRefineInput(false);
    try {
      const refined = await refineRubric(rubricText, refineSuggestion);
      setRubricText(refined);
      setStatus('done');
      setRefineSuggestion('');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (e) {
      console.error(e);
      toast.error('优化失败，请检查 API 连接');
      setStatus('done');
    }
  };

  // 导出评分标准为 JSON 文件
  const handleExport = () => {
    if (!rubricText.trim()) {
      toast.warning('没有可导出的评分标准');
      return;
    }
    const exportData = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      rubric: rubricText
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `评分标准_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 导入评分标准
  const normalizeRubricText = (raw: string) => {
    if (!raw) return '';
    let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n');
    const nonEmpty = lines.filter(l => l.trim().length > 0);
    const quoted = nonEmpty.filter(l => l.trim().startsWith('>'));
    if (nonEmpty.length > 0 && quoted.length / nonEmpty.length > 0.7) {
      text = lines.map(l => l.replace(/^\s*>\s?/, '')).join('\n');
    }
    text = text.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>');
    text = text.replace(/\n{4,}/g, '\n\n\n');
    return text.trim() + '\n';
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = (event.target?.result as string) || '';
        const trimmed = content.trim();

        if (trimmed.startsWith('{')) {
          const data = JSON.parse(content);
          if (data.rubric && typeof data.rubric === 'string') {
            setRubricText(data.rubric);
            setStatus('done');
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 3000);
          } else {
            toast.error('无效的评分标准 JSON 文件格式');
          }
          return;
        }

        if (trimmed.length > 0) {
          setRubricText(normalizeRubricText(content));
          setStatus('done');
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 3000);
          return;
        }

        toast.warning('导入内容为空');
      } catch (err) {
        toast.error('文件解析失败');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 w-full h-full bg-white transform transition-transform duration-300 z-20 flex flex-col shadow-2xl">

      {/* Header */}
      <nav className="flex items-center justify-between px-5 bg-white border-b border-gray-100 shrink-0 z-20 h-[64px]">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-gray-50 text-gray-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-gray-900">评分细则配置</h1>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => importInputRef.current?.click()} className="p-2 rounded-full hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors" title="导入配置">
            <Upload className="w-[18px] h-[18px]" />
          </button>
          <button onClick={handleExport} className="p-2 rounded-full hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors" title="导出配置">
            <Download className="w-[18px] h-[18px]" />
          </button>
        </div>
      </nav>

      {/* Success Toast - Optimized visual */}
      {showSuccessToast && (
        <div className="absolute top-[70px] left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-gray-900/90 text-white px-4 py-2 rounded-full shadow-lg backdrop-blur-sm flex items-center space-x-2 border border-white/10">
            <div className="bg-green-500 rounded-full p-0.5"><Check className="w-2.5 h-2.5 stroke-[3]" /></div>
            <span className="text-xs font-medium">操作成功</span>
          </div>
        </div>
      )}

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        <div className="p-5 space-y-5">

          {/* AI 智能生成区域 */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <UploadBox
                label="上传试卷"
                hasImage={!!qImage}
                onClick={() => qInputRef.current?.click()}
                icon={FileQuestion}
              />
              <UploadBox
                label="参考答案"
                hasImage={!!aImage}
                onClick={() => aInputRef.current?.click()}
                icon={FileCheck2}
              />
              <input type="file" ref={qInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, setQImage)} />
              <input type="file" ref={aInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, setAImage)} />
            </div>

            {/* Smart Generator Button */}
            <div className="relative group">
              <div className={`absolute -inset-0.5 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500 ${!qImage && !aImage ? 'hidden' : ''}`}></div>
              <Button
                variant="gradient"
                size="md"
                fullWidth
                className="relative shadow-sm"
                icon={status === 'processing' ? <BrainCircuit className="w-3.5 h-3.5 animate-pulse" /> : <Sparkles className="w-3.5 h-3.5" />}
                disabled={(!qImage && !aImage) || status === 'processing'}
                onClick={handleGenerate}
                loading={status === 'processing'}
              >
                {status === 'processing' ? '正在分析试卷...' : '开始生成评分细则'}
              </Button>
            </div>
          </div>

          {/* Editor Area */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50/80 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Editor
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-[10px] text-gray-300">{rubricText.length} chars</div>
                {/* 格式化按钮 */}
                <button
                  onClick={handleStandardize}
                  disabled={!rubricText.trim() || status === 'standardizing'}
                  className="px-2 py-1 text-[10px] font-medium rounded-md transition-all flex items-center gap-1 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="一键格式化"
                >
                  <TableProperties className="w-3 h-3" />
                  格式化
                </button>
              </div>
            </div>

            {/* Refine Input */}
            {showRefineInput && (
              <div className="bg-purple-50/50 border-b border-purple-100 p-3 animate-in slide-in-from-top-2 duration-200">
                <div className="relative">
                  <textarea
                    className="w-full text-xs p-3 pr-10 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400 outline-none resize-none bg-white min-h-[60px]"
                    placeholder="告诉 AI 如何修改，例如：给每个得分点增加具体示例…"
                    value={refineSuggestion}
                    onChange={(e) => setRefineSuggestion(e.target.value)}
                    autoFocus
                  />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1">
                    <button
                      onClick={() => setShowRefineInput(false)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                      title="关闭"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <button
                      onClick={handleRefine}
                      disabled={!refineSuggestion.trim()}
                      className="p-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm"
                      title="发送指令"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content Area - Editor */}
            <div className="relative group">
              <textarea
                className="w-full h-[320px] p-4 text-xs leading-relaxed font-mono bg-white text-gray-700 outline-none resize-none selection:bg-blue-100"
                placeholder="// 评分细则将显示在这里…"
                value={rubricText}
                onChange={(e) => setRubricText(e.target.value)}
                spellCheck={false}
              />
              {status === 'standardizing' && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center z-10 font-medium text-xs text-emerald-600">
                  <BrainCircuit className="w-4 h-4 animate-pulse mr-2" />
                  正在标准化格式...
                </div>
              )}
              {status === 'refining' && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center z-10 font-medium text-xs text-purple-600">
                  <BrainCircuit className="w-4 h-4 animate-pulse mr-2" />
                  正在优化内容...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Two buttons side by side */}
      <footer className="bg-white p-4 border-t border-gray-100 z-20">
        <div className="flex items-center gap-3">
          {/* AI 优化按钮 */}
          <button
            onClick={() => setShowRefineInput(!showRefineInput)}
            disabled={!rubricText.trim()}
            className={`flex-1 h-11 rounded-xl font-medium transition-all flex items-center justify-center gap-2 border ${showRefineInput
              ? 'bg-purple-100 border-purple-300 text-purple-700'
              : 'bg-white border-gray-200 text-gray-700 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Wand2 className="w-4 h-4" />
            AI 优化
          </button>
          {/* 保存按钮 */}
          <button
            onClick={() => {
              if (rubricText.trim()) {
                onSave(rubricText);
              } else {
                toast.warning('请先生成或输入评分标准');
              }
            }}
            disabled={!rubricText.trim()}
            className="flex-1 bg-gray-900 hover:bg-black text-white h-11 rounded-xl font-medium shadow-lg shadow-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:translate-y-[-1px] active:translate-y-[0px]"
          >
            <Save className="w-4 h-4" />
            保存配置
          </button>
        </div>
      </footer>

    </div>
  );
};

// 上传框组件
const UploadBox = ({ label, hasImage, onClick, icon: Icon }: any) => (
  <div
    onClick={onClick}
    className={`
      relative h-24 rounded-xl cursor-pointer transition-all duration-300 overflow-hidden group
      flex flex-col items-center justify-center gap-2 border-2
      ${hasImage
        ? 'bg-blue-50/50 border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]'
        : 'bg-gray-50 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/30'
      }
    `}
  >
    {hasImage && (
      <div className="absolute top-2 right-2">
        <div className="bg-blue-500 text-white rounded-full p-0.5 shadow-sm">
          <Check className="w-2.5 h-2.5" strokeWidth={3} />
        </div>
      </div>
    )}
    <div className={`
      p-2.5 rounded-full transition-all duration-300
      ${hasImage
        ? 'bg-white text-blue-600 shadow-sm scale-110'
        : 'bg-white text-gray-400 shadow-sm group-hover:text-blue-500 group-hover:scale-110'
      }
    `}>
      <Icon className="w-5 h-5" />
    </div>
    <span className={`text-[11px] font-medium transition-colors ${hasImage ? 'text-blue-700' : 'text-gray-500 group-hover:text-blue-600'}`}>
      {hasImage ? '已上传' : label}
    </span>
  </div>
);

export default RubricDrawer;