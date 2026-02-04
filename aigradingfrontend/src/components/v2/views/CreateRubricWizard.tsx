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
            <header className="px-4 pt-6 pb-3 flex items-center gap-3 shrink-0">
                <button
                    onClick={onBack}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-lg font-bold text-slate-900">创建细则</h2>
            </header>

            {/* Step Indicator */}
            <div className="px-4 py-3 shrink-0">
                <div className="flex items-center gap-2">
                    <div className={`flex-1 h-1.5 rounded-full transition-colors ${stepProgress >= 1 ? 'bg-primary' : 'bg-slate-100'}`} />
                    <div className={`flex-1 h-1.5 rounded-full transition-colors ${stepProgress >= 2 ? 'bg-primary' : 'bg-slate-100'}`} />
                    <div className={`flex-1 h-1.5 rounded-full transition-colors ${stepProgress >= 3 ? 'bg-primary' : 'bg-slate-100'}`} />
                </div>
                <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className={stepProgress >= 1 ? 'text-primary' : 'text-slate-300'}>1. 基本信息</span>
                    <span className={stepProgress >= 2 ? 'text-primary' : 'text-slate-300'}>2. AI 生成</span>
                    <span className={stepProgress >= 3 ? 'text-primary' : 'text-slate-300'}>3. 确认</span>
                </div>
            </div>

            {/* Content */}
            <main className="flex-1 overflow-y-auto px-4 py-4">
                {step === 'basic' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        {/* 考试名称 */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />
                                考试名称
                            </label>
                            <select
                                value={examId}
                                onChange={(e) => setExamId(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-primary transition-colors"
                            >
                                <option value="">请选择考试...</option>
                                {exams.map(exam => (
                                    <option key={exam.id} value={exam.id}>{exam.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* 学段/学科 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">学段</label>
                                <select
                                    value={grade}
                                    onChange={(e) => setGrade(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-primary transition-colors"
                                >
                                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">学科</label>
                                <select
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-primary transition-colors"
                                >
                                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* 题号 */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                题号
                            </label>
                            <input
                                type="text"
                                value={questionNo}
                                onChange={(e) => setQuestionNo(e.target.value)}
                                placeholder="例如：第15题"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-primary transition-colors"
                            />
                        </div>
                    </div>
                )}

                {step === 'upload' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <p className="text-sm text-slate-500 text-center mb-4">
                            上传试题和参考答案图片，AI 将自动生成评分细则
                        </p>

                        {/* 图片上传区 */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* 试题图片 */}
                            <label className={`aspect-square border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${questionImage
                                    ? 'border-primary bg-primary-subtle'
                                    : 'border-slate-200 hover:border-primary hover:bg-primary-subtle/30'
                                }`}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload('question')}
                                />
                                {questionImage ? (
                                    <img src={questionImage} alt="试题" className="w-full h-full object-cover rounded-3xl" />
                                ) : (
                                    <>
                                        <ImagePlus className="w-6 h-6 text-slate-300" />
                                        <span className="text-[10px] font-bold text-slate-400">试题图片</span>
                                    </>
                                )}
                            </label>

                            {/* 参考答案 */}
                            <label className={`aspect-square border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${answerImage
                                    ? 'border-success bg-success-subtle'
                                    : 'border-slate-200 hover:border-success hover:bg-success-subtle/30'
                                }`}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload('answer')}
                                />
                                {answerImage ? (
                                    <img src={answerImage} alt="答案" className="w-full h-full object-cover rounded-3xl" />
                                ) : (
                                    <>
                                        <FileText className="w-6 h-6 text-slate-300" />
                                        <span className="text-[10px] font-bold text-slate-400">参考答案</span>
                                        <span className="text-[8px] text-slate-300">(可选)</span>
                                    </>
                                )}
                            </label>
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
                <footer className="p-4 shrink-0">
                    <button
                        onClick={handleNext}
                        disabled={!canProceed}
                        className={`w-full py-3.5 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 ${canProceed
                                ? 'bg-brand-gradient text-white shadow-brand hover:shadow-brand-lg active:scale-[0.98]'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        {step === 'basic' ? (
                            '下一步：上传图片'
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                AI 生成细则
                            </>
                        )}
                    </button>
                </footer>
            )}
        </div>
    );
};

export default CreateRubricWizard;
