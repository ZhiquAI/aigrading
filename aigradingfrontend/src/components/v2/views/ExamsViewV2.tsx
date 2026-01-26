import React, { useState, useEffect } from 'react';
import {
    Plus,
    Calendar,
    BookOpen,
    ChevronRight,
    MoreVertical,
    Search,
    Clock,
    GraduationCap,
    Edit3,
    Trash2,
    ArrowLeft,
    FileText,
    Settings2,
    LayoutGrid,
    Zap
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { Exam } from '@/services/proxyService';
import { toast } from '@/components/Toast';

export default function ExamsViewV2() {
    const {
        exams,
        loadExams,
        setActiveExamId,
        createExamAction,
        updateExamAction,
        deleteExamAction,
        rubricLibrary
    } = useAppStore();

    const [view, setView] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
    const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        subject: '历史',
        grade: '初三',
        date: new Date().toISOString().split('T')[0],
        description: ''
    });

    useEffect(() => {
        loadExams();
    }, []);

    const filteredExams = exams.filter(e =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.subject?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreate = async () => {
        if (!formData.name) {
            toast.error('请输入考试名称');
            return;
        }
        const exam = await createExamAction(formData);
        if (exam) {
            toast.success('考试创建成功');
            setView('list');
            resetForm();
        }
    };

    const handleUpdate = async () => {
        if (!selectedExam || !formData.name) return;
        const exam = await updateExamAction(selectedExam.id, formData);
        if (exam) {
            toast.success('修改成功');
            setView('list');
            resetForm();
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('确定要删除这场考试吗？关联的题目将变为“未归类”。')) {
            const success = await deleteExamAction(id);
            if (success) toast.success('已删除');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            subject: '历史',
            grade: '初三',
            date: new Date().toISOString().split('T')[0],
            description: ''
        });
        setSelectedExam(null);
    };

    const openEdit = (e: React.MouseEvent, exam: Exam) => {
        e.stopPropagation();
        setSelectedExam(exam);
        setFormData({
            name: exam.name,
            subject: exam.subject || '历史',
            grade: exam.grade || '初三',
            date: exam.date ? new Date(exam.date).toISOString().split('T')[0] : '',
            description: exam.description || ''
        });
        setView('edit');
    };

    const openDetail = (exam: Exam) => {
        setSelectedExam(exam);
        setActiveExamId(exam.id);
        setView('detail');
    };

    // --- Sub-View: LIST ---
    if (view === 'list') {
        return (
            <div className="flex flex-col h-full bg-white animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Header Actions */}
                <div className="p-4 bg-slate-50/50 border-b border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-black text-slate-800 tracking-tight">考试管理</h2>
                        <button
                            onClick={() => { resetForm(); setView('create'); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl shadow-lg shadow-indigo-100 transition-all active:scale-95"
                        >
                            <Plus size={18} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
                        <input
                            type="text"
                            placeholder="搜索考试名称或学科..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Exam Grid/List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {filteredExams.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                            <LayoutGrid size={48} className="text-slate-300 mb-4" />
                            <p className="text-sm font-bold text-slate-400">暂无考试记录</p>
                            <p className="text-[10px] mt-1 text-slate-400">点击上方按钮创建一个新考试</p>
                        </div>
                    ) : (
                        filteredExams.map(exam => (
                            <div
                                key={exam.id}
                                onClick={() => openDetail(exam)}
                                className="group relative bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-xl hover:border-indigo-100 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden"
                            >
                                {/* Active Indicator */}
                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 group-hover:w-1.5 transition-all" />

                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-md">{exam.subject}</span>
                                            <span className="text-[10px] font-bold text-slate-400">{exam.grade}</span>
                                        </div>
                                        <h3 className="text-sm font-black text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">{exam.name}</h3>
                                    </div>
                                    <button
                                        onClick={(e) => openEdit(e, exam)}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-300 hover:text-slate-600 transition-colors"
                                    >
                                        <Settings2 size={16} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                            <Calendar size={12} className="text-indigo-400" />
                                            {exam.date ? new Date(exam.date).toLocaleDateString() : '未设时间'}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                            <FileText size={12} className="text-indigo-400" />
                                            {rubricLibrary.filter(r => (r as any).examId === exam.id).length} 题
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // --- Sub-View: DETAIL (Slide-in Style) ---
    if (view === 'detail' && selectedExam) {
        const examQuestions = rubricLibrary.filter(r => (r as any).examId === selectedExam.id);

        return (
            <div className="flex flex-col h-full bg-white animate-in slide-in-from-right duration-300 z-50 overflow-hidden">
                <header className="px-4 py-4 bg-slate-900 text-white shrink-0">
                    <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-slate-400 hover:text-white mb-4 transition-colors">
                        <ArrowLeft size={16} />
                        <span className="text-xs font-bold">返回列表</span>
                    </button>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-black rounded border border-indigo-400/20">{selectedExam.subject}</span>
                            <span className="text-[10px] font-bold text-slate-400">{selectedExam.grade}</span>
                        </div>
                        <h1 className="text-lg font-black tracking-tight leading-tight">{selectedExam.name}</h1>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 pt-1 opacity-70">
                            <Clock size={10} /> 更新于 {new Date(selectedExam.updatedAt).toLocaleString()}
                        </p>
                    </div>
                </header>

                <div className="p-4 shrink-0 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">包含题目 ({examQuestions.length})</h3>
                    <button className="flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-700">
                        <Plus size={12} /> 添加题目
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                    {examQuestions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                            <FileText size={32} />
                            <p className="text-xs font-bold mt-2">暂无题目</p>
                            <p className="text-[9px]">在评分细则设置中关联到此考试</p>
                        </div>
                    ) : (
                        examQuestions.map((q: any) => (
                            <div key={q.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 transition-all group cursor-pointer shadow-sm">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-xs font-black text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    {q.questionNo}
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-xs font-bold text-slate-800 truncate">{q.alias}</h4>
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{q.keywords.join(' · ')}</p>
                                </div>
                                <div className="text-[9px] font-black text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                                    去批改 <ChevronRight size={10} />
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-white">
                    <button
                        onClick={() => {/* Trigger Auto Grade for this exam set */ }}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                        <Zap size={14} className="fill-white" />
                        以此配置开始阅卷
                    </button>
                </div>
            </div>
        );
    }

    // --- Sub-View: CREATE / EDIT (Modal Form) ---
    if (view === 'create' || view === 'edit') {
        const isEdit = view === 'edit';
        return (
            <div className="flex flex-col h-full bg-white animate-in slide-in-from-bottom duration-300 z-50">
                <header className="px-4 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setView('list')} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
                            <ArrowLeft size={18} />
                        </button>
                        <h2 className="text-sm font-black text-slate-800">{isEdit ? '编辑考试' : '新建考试'}</h2>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">考试名称</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="如：2024年初三历史二模测试"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">学科</label>
                                <select
                                    value={formData.subject}
                                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all appearance-none"
                                >
                                    <option>历史</option>
                                    <option>政治</option>
                                    <option>语文</option>
                                    <option>地理</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">年级</label>
                                <select
                                    value={formData.grade}
                                    onChange={e => setFormData({ ...formData, grade: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all appearance-none"
                                >
                                    <option>初三</option>
                                    <option>初二</option>
                                    <option>高一</option>
                                    <option>高三</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">考试日期</label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">考试备注</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="添加一点备注说明..."
                                className="w-full h-24 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all resize-none"
                            />
                        </div>
                    </div>

                    {isEdit && (
                        <div className="pt-4 mt-6 border-t border-slate-100">
                            <button
                                onClick={(e) => {
                                    handleDelete(e, selectedExam!.id);
                                    if (!isDeleting) setView('list');
                                }}
                                className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                            >
                                <Trash2 size={16} /> 删除此考试
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-slate-100 bg-white">
                    <button
                        onClick={isEdit ? handleUpdate : handleCreate}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all"
                    >
                        {isEdit ? '确认保存修改' : '立即创建考试'}
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
