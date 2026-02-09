/**
 * CreateRubricWizard - 创建评分细则向导组件
 * 三步流程：基本信息 → AI 生成 → 确认
 */
import React, { useState } from 'react';
import {
    ChevronLeft,
    ImagePlus,
    Sparkles,
    FileText,
    BookOpen,
    Hash
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/components/Toast';

interface CreateRubricWizardProps {
    onBack: () => void;
    onComplete: (questionKey: string) => void;
}

type WizardStep = 'basic' | 'upload' | 'generating';

const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'];
const GRADES = ['初一', '初二', '初三', '高一', '高二', '高三'];

const CreateRubricWizard: React.FC<CreateRubricWizardProps> = ({ onBack, onComplete }) => {
    const { exams } = useAppStore();

    // Form state
    const [step, setStep] = useState<WizardStep>('basic');
    const [examId, setExamId] = useState<string>('');
    const [grade, setGrade] = useState<string>('初三');
    const [subject, setSubject] = useState<string>('历史');
    const [questionNo, setQuestionNo] = useState<string>('');

    // Image state
    const [questionImage, setQuestionImage] = useState<string | null>(null);
    const [answerImage, setAnswerImage] = useState<string | null>(null);

    const stepProgress = step === 'basic' ? 1 : step === 'upload' ? 2 : 3;

    const handleImageUpload = (type: 'question' | 'answer') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = ev.target?.result as string;
            if (type === 'question') {
                setQuestionImage(base64);
            } else {
                setAnswerImage(base64);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleNext = () => {
        if (step === 'basic') {
            if (!questionNo.trim()) {
                toast.warning('请输入题号');
                return;
            }
            setStep('upload');
        } else if (step === 'upload') {
            if (!questionImage) {
                toast.warning('请上传试题图片');
                return;
            }
            // 触发 AI 生成
            setStep('generating');
            // TODO: 调用 AI 生成服务
            setTimeout(() => {
                const questionKey = `${grade}${subject}_${questionNo}`;
                onComplete(questionKey);
            }, 2000);
        }
    };

    const canProceed = step === 'basic'
        ? questionNo.trim() !== ''
        : step === 'upload'
            ? questionImage !== null
            : false;

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <header className="px-4 py-3 flex items-center justify-between border-b border-[#E5E4E1] bg-white sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h2 className="text-base font-black text-[#1A1918] tracking-tight">AI 识别生成</h2>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${stepProgress >= 1 ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                    <div className={`w-1.5 h-1.5 rounded-full ${stepProgress >= 2 ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                </div>
            </header>


            {/* Content */}
            <main className="flex-1 overflow-y-auto px-4 py-4">
                {step === 'basic' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* 1:1 Configuration Grid */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-[#9C9B99] uppercase tracking-wider ml-1">考试</label>
                                    <select
                                        value={examId}
                                        onChange={(e) => setExamId(e.target.value)}
                                        className="w-full h-11 px-3 bg-slate-50 border border-[#E5E4E1] rounded-2xl text-[12px] font-bold text-[#1A1918] outline-none focus:border-indigo-300 focus:bg-white transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">请选择考试...</option>
                                        {exams.map(exam => (
                                            <option key={exam.id} value={exam.id}>{exam.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-[#9C9B99] uppercase tracking-wider ml-1">年级</label>
                                    <select
                                        value={grade}
                                        onChange={(e) => setGrade(e.target.value)}
                                        className="w-full h-11 px-3 bg-slate-50 border border-[#E5E4E1] rounded-2xl text-[12px] font-bold text-[#1A1918] outline-none focus:border-indigo-300 focus:bg-white transition-all appearance-none cursor-pointer"
                                    >
                                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-[#9C9B99] uppercase tracking-wider ml-1">科目</label>
                                    <select
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        className="w-full h-11 px-3 bg-slate-50 border border-[#E5E4E1] rounded-2xl text-[12px] font-bold text-[#1A1918] outline-none focus:border-indigo-300 focus:bg-white transition-all appearance-none cursor-pointer"
                                    >
                                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-[#9C9B99] uppercase tracking-wider ml-1">题号</label>
                                    <input
                                        type="text"
                                        value={questionNo}
                                        onChange={(e) => setQuestionNo(e.target.value)}
                                        placeholder="例如：13"
                                        className="w-full h-11 px-3 bg-slate-50 border border-[#E5E4E1] rounded-2xl text-[12px] font-bold text-[#1A1918] placeholder:text-slate-300 outline-none focus:border-indigo-300 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Visual upload tips */}
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 border border-indigo-100 shadow-sm">
                                <Sparkles className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[13px] font-black text-indigo-600 leading-tight">接下来...</span>
                                <span className="text-[11px] font-bold text-indigo-400/80 leading-relaxed">
                                    请上传清晰的试题图片及其对应的参考答案，AI 将根据图片内容自动生成采分条目。
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'upload' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* 图片上传区 */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* 试题图片 */}
                            <label className={`aspect-[1/1.1] border-2 border-dashed rounded-[20px] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${questionImage
                                ? 'border-indigo-500 bg-indigo-50/30'
                                : 'border-[#E5E4E1] bg-slate-50/50 hover:border-indigo-300 hover:bg-slate-50'
                                }`}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload('question')}
                                />
                                {questionImage ? (
                                    <div className="relative w-full h-full p-2">
                                        <img src={questionImage} alt="试题" className="w-full h-full object-cover rounded-2xl" />
                                        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-indigo-600/80 backdrop-blur-sm text-[8px] font-black text-white">试卷题目</div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                                            <ImagePlus className="w-5 h-5 text-indigo-400" />
                                        </div>
                                        <span className="text-[11px] font-black text-[#1A1918]">试卷题目</span>
                                        <span className="text-[9px] font-bold text-[#9C9B99]">(必填)</span>
                                    </>
                                )}
                            </label>

                            {/* 参考答案 */}
                            <label className={`aspect-[1/1.1] border-2 border-dashed rounded-[20px] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${answerImage
                                ? 'border-emerald-500 bg-emerald-50/30'
                                : 'border-[#E5E4E1] bg-slate-50/50 hover:border-emerald-300 hover:bg-slate-50'
                                }`}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload('answer')}
                                />
                                {answerImage ? (
                                    <div className="relative w-full h-full p-2">
                                        <img src={answerImage} alt="答案" className="w-full h-full object-cover rounded-2xl" />
                                        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-emerald-600/80 backdrop-blur-sm text-[8px] font-black text-white">正确答案</div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                                            <FileText className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <span className="text-[11px] font-black text-[#1A1918]">正确答案</span>
                                        <span className="text-[9px] font-bold text-[#9C9B99]">(可选)</span>
                                    </>
                                )}
                            </label>
                        </div>

                        <div className="px-2">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                                <span className="text-[12px] font-black text-[#1A1918]">识别提示</span>
                            </div>
                            <ul className="space-y-1.5">
                                <li className="flex items-start gap-2 text-[11px] font-bold text-[#64748B]">
                                    <span className="text-indigo-400 mt-0.5">•</span>
                                    请拍摄清晰、正向的试卷照片，避免反光。
                                </li>
                                <li className="flex items-start gap-2 text-[11px] font-bold text-[#64748B]">
                                    <span className="text-indigo-400 mt-0.5">•</span>
                                    同时上传答案可显著提升 AI 的给分点识别准确度。
                                </li>
                            </ul>
                        </div>
                    </div>
                )}

                {step === 'generating' && (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 animate-in fade-in duration-300">
                        <div className="w-16 h-16 rounded-full bg-brand-gradient flex items-center justify-center shadow-brand animate-pulse">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <p className="mt-6 text-slate-600 font-medium">AI 正在分析试题...</p>
                        <p className="mt-2 text-sm text-slate-400">生成评分细则中，请稍候</p>
                    </div>
                )}
            </main>

            {/* Footer */}
            {step !== 'generating' && (
                <footer className="px-4 py-4 shrink-0 bg-white border-t border-[#F0EFED]">
                    <div className="mb-4 text-center">
                        <p className="text-[10px] font-bold text-[#9C9B99] flex items-center justify-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            AI 智能识别图片内容 · 生成评分后可自由微调
                        </p>
                    </div>
                    <button
                        onClick={handleNext}
                        disabled={!canProceed}
                        className={`w-full h-12 font-black rounded-2xl transition-all flex items-center justify-center gap-2 text-[14px] ${canProceed
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98]'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        {step === 'basic' ? (
                            '确认信息 · 进入识别上传'
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                开始 AI 智能识别
                            </>
                        )}
                    </button>
                </footer>
            )}
        </div>
    );
};

export default CreateRubricWizard;
