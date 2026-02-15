import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, RefreshCw, Save, Settings } from 'lucide-react';
import type { RubricJSONV3, StrategyType } from '@/types/rubric-v3';
import { useAppStore } from '@/stores/useAppStore';
import { Tab } from '@/types';
import {
  applyEditableItems,
  getRubricTotalScore,
  getScoringStrategy,
  toEditableItems,
} from './rubric-view-model';
import {
  validateRubricDraft,
  validateRubricForTemplate,
  type RubricValidationResult,
} from './rubric-validator';

interface RubricResultViewProps {
  rubric: RubricJSONV3;
  examName: string;
  subject: string;
  questionNo: string;
  onSave: (rubric: RubricJSONV3) => void;
  onRegenerate: () => void;
  onBack?: () => void;
  onSaveTemplate?: (rubric: RubricJSONV3) => Promise<void> | void;
  defaultDensity?: 'compact' | 'full';
  onValidate?: (result: RubricValidationResult) => void;
  headerMode?: 'default' | 'simple';
  headerTitle?: string;
}

interface SimpleRow {
  id: string;
  questionSegment: string;
  content: string;
  score: number;
  keywords: string[];
}

function getStrategyTypeLabel(strategyType: StrategyType): string {
  if (strategyType === 'point_accumulation') return '按点给分';
  if (strategyType === 'sequential_logic') return '步骤给分';
  return '等级矩阵';
}

function getScoringTypeLabel(type: 'weighted' | 'all' | 'pick_n'): string {
  if (type === 'weighted') return '按权重累计';
  if (type === 'all') return '全点命中';
  return '任答 N 点';
}

function parseKeywords(input: string): string[] {
  return input
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getReadOnlyReason(strategyType: StrategyType, hasSegments: boolean): string {
  if (hasSegments) {
    return '当前细则包含多小问分段结构，为避免破坏结构，本页仅展示 AI 结果，可直接保存。';
  }
  if (strategyType === 'rubric_matrix') {
    return '当前题型为分档矩阵，系统已自动转换为基础表格预览，可直接保存。';
  }
  return '';
}

export default function RubricResultView({
  rubric,
  examName,
  subject,
  questionNo,
  onSave,
  onRegenerate,
  onBack,
  onSaveTemplate,
  defaultDensity: _defaultDensity,
  onValidate,
  headerMode = 'default',
  headerTitle,
}: RubricResultViewProps) {
  const quota = useAppStore((state) => state.quota);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const [draft, setDraft] = useState<RubricJSONV3>(rubric);
  const [rows, setRows] = useState<SimpleRow[]>([]);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  useEffect(() => {
    setDraft(rubric);
  }, [rubric]);

  const hasSegments = useMemo(() => {
    const content = draft.content as { segments?: unknown[] };
    return Array.isArray(content.segments) && content.segments.length > 0;
  }, [draft.content]);

  const isReadOnly = hasSegments;

  useEffect(() => {
    const nextRows = toEditableItems(draft).map((item, index) => ({
      id: item.id || `${draft.metadata.questionId || 'Q'}-${index + 1}`,
      questionSegment: item.questionSegment || '',
      content: item.content || '',
      score: Number(item.score) || 0,
      keywords: item.keywords || [],
    }));
    setRows(nextRows);
  }, [draft]);

  const workingRubric = useMemo(() => {
    if (isReadOnly) return draft;
    const editableItems = rows.map((row) => ({
      id: row.id,
      content: row.content,
      score: Number(row.score) || 0,
      keywords: row.keywords,
      requiredKeywords: [],
      questionSegment: row.questionSegment,
      deductionRules: '',
      openEnded: false,
    }));
    return applyEditableItems(draft, editableItems);
  }, [draft, isReadOnly, rows]);

  const validation = useMemo(() => validateRubricDraft(workingRubric), [workingRubric]);
  const templateValidation = useMemo(() => validateRubricForTemplate(workingRubric), [workingRubric]);
  const hasBlockingErrors = validation.errors.length > 0;
  const hasTemplateBlockingErrors = templateValidation.errors.length > 0;
  const totalScore = useMemo(() => getRubricTotalScore(workingRubric), [workingRubric]);
  const scoringStrategy = useMemo(() => getScoringStrategy(workingRubric), [workingRubric]);
  const scoringStrategyTypeLabel = useMemo(() => {
    if (workingRubric.strategyType === 'rubric_matrix') return '矩阵分档';
    return getScoringTypeLabel(scoringStrategy?.type || 'weighted');
  }, [scoringStrategy, workingRubric.strategyType]);
  const scoringStrategyParamLabel = useMemo(() => {
    if (workingRubric.strategyType === 'rubric_matrix') return '不适用';
    if (scoringStrategy?.type !== 'pick_n') return '默认';
    const maxPoints = Number(scoringStrategy.maxPoints);
    const pointValue = Number(scoringStrategy.pointValue);
    const nLabel = Number.isFinite(maxPoints) && maxPoints > 0 ? String(maxPoints) : '-';
    const pointLabel = Number.isFinite(pointValue) && pointValue > 0 ? String(pointValue) : '-';
    return `N=${nLabel}，每点 ${pointLabel} 分`;
  }, [scoringStrategy, workingRubric.strategyType]);
  const readOnlyReason = useMemo(
    () => getReadOnlyReason(draft.strategyType, hasSegments),
    [draft.strategyType, hasSegments]
  );

  useEffect(() => {
    onValidate?.(validation);
  }, [onValidate, validation]);

  const handleRowChange = (rowId: string, patch: Partial<SimpleRow>) => {
    if (isReadOnly) return;
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const buildSavePayload = (): RubricJSONV3 => {
    return {
      ...workingRubric,
      metadata: {
        ...workingRubric.metadata,
        examName: examName || workingRubric.metadata.examName,
        subject: subject || workingRubric.metadata.subject,
        questionId: workingRubric.metadata.questionId || questionNo,
      },
    };
  };

  const handleSave = () => {
    const currentValidation = validateRubricDraft(workingRubric);
    onValidate?.(currentValidation);
    if (currentValidation.errors.length > 0) {
      window.alert(currentValidation.errors.join('\n'));
      return;
    }
    onSave(buildSavePayload());
  };

  const handleSaveTemplate = async () => {
    if (!onSaveTemplate) return;

    const currentTemplateValidation = validateRubricForTemplate(workingRubric);
    if (currentTemplateValidation.errors.length > 0) {
      window.alert(currentTemplateValidation.errors.join('\n'));
      return;
    }

    try {
      setIsSavingTemplate(true);
      await onSaveTemplate(buildSavePayload());
    } catch (error) {
      const message = error instanceof Error ? error.message : '模板保存失败，请重试';
      window.alert(message);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const resolvedHeaderTitle = headerTitle || (headerMode === 'simple' ? '生成评分细则' : '步骤 3/3 · 核对并保存');
  const handleBack = onBack || onRegenerate;

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#EFF4FA] via-[#F7FAFD] to-[#FFFFFF]">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#E2E9F5] bg-white/92 px-4 backdrop-blur">
        <button
          type="button"
          onClick={handleBack}
          className="grid h-8 w-8 place-items-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100"
          aria-label="返回重生成"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <h1 className="text-[15px] font-black tracking-tight text-[#17233A]">{resolvedHeaderTitle}</h1>
        <div className="flex items-center gap-1">
          <span className="rounded-full border border-[#F2D9B8] bg-[#FFF7EC] px-2 py-0.5 text-[10px] font-bold text-[#8B5A1F]">
            {quota.isPaid ? 'PRO' : '试用版'}
          </span>
          <button
            type="button"
            aria-label="打开设置"
            onClick={() => setActiveTab(Tab.Settings)}
            className="grid h-8 w-8 place-items-center rounded-full border border-[#E2E9F5] bg-white text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
        <section className="rounded-2xl border border-[#DCE6F6] bg-white px-3 py-2.5 shadow-[0_10px_20px_rgba(28,49,84,0.08)]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#5B6F92]">AI 已自动拆分并填充</p>
              <p className="mt-0.5 text-[12px] font-semibold text-[#1E2F4E]">
                题号 {questionNo || draft.metadata.questionId || '-'} · {subject || draft.metadata.subject || '历史'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold text-[#7386A9]">总分</p>
              <p className="text-xl font-black text-[#1F3C78]">{totalScore}</p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg border border-[#E2EAF8] bg-[#F6F9FF] px-2.5 py-2">
            <div>
              <p className="text-[10px] font-semibold text-[#7084AA]">评分模型</p>
              <p className="mt-0.5 text-[11px] font-bold text-[#1E3B74]">{getStrategyTypeLabel(workingRubric.strategyType)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#7084AA]">评分策略</p>
              <p className="mt-0.5 text-[11px] font-bold text-[#1E3B74]">{scoringStrategyTypeLabel}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[#7084AA]">策略参数</p>
              <p className="mt-0.5 text-[11px] font-bold text-[#1E3B74]">{scoringStrategyParamLabel}</p>
            </div>
          </div>

          {readOnlyReason ? (
            <p className="mt-2 rounded-lg border border-[#E2EAF8] bg-[#F6F9FF] px-2.5 py-2 text-[10px] font-semibold text-[#5671A8]">
              {readOnlyReason}
            </p>
          ) : (
            <p className="mt-2 rounded-lg border border-[#E2EAF8] bg-[#F6F9FF] px-2.5 py-2 text-[10px] font-semibold text-[#5671A8]">
              如需微调，只改下表四个基础字段即可：问题词、得分点、分值、关键词。
            </p>
          )}
        </section>

        <section className="mt-3 overflow-hidden rounded-2xl border border-[#DCE6F6] bg-white shadow-[0_10px_20px_rgba(28,49,84,0.08)]">
          <div className="grid grid-cols-[44px_92px_1fr_84px_132px] border-b border-[#E7EDF8] bg-[#F7FAFF] px-2 py-2 text-[10px] font-black uppercase tracking-[0.06em] text-[#5570A4]">
            <div>#</div>
            <div>问题词</div>
            <div>得分点内容</div>
            <div>分值</div>
            <div>关键词</div>
          </div>

          {rows.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] font-semibold text-[#7A8AA8]">AI 暂未识别到得分点，请返回重生成。</div>
          ) : (
            <div className="divide-y divide-[#EEF2FA]">
              {rows.map((row, index) => (
                <div key={row.id} className="grid grid-cols-[44px_92px_1fr_84px_132px] gap-2 px-2 py-2.5">
                  <div className="pt-2 text-[11px] font-bold text-[#6A7FA6]">{index + 1}</div>

                  <input
                    value={row.questionSegment}
                    onChange={(e) => handleRowChange(row.id, { questionSegment: e.target.value })}
                    disabled={isReadOnly}
                    placeholder="可空"
                    className="h-9 rounded-md border border-[#DFE7F5] bg-[#FAFCFF] px-2 text-[11px] font-semibold text-[#27406B] outline-none focus:border-[#9EB4E8] disabled:cursor-not-allowed disabled:bg-slate-100"
                  />

                  <textarea
                    value={row.content}
                    onChange={(e) => handleRowChange(row.id, { content: e.target.value })}
                    disabled={isReadOnly}
                    rows={2}
                    placeholder="输入或调整得分点内容"
                    className="min-h-[54px] rounded-md border border-[#DFE7F5] bg-[#FAFCFF] px-2 py-1.5 text-[11px] font-semibold leading-5 text-[#243B63] outline-none focus:border-[#9EB4E8] disabled:cursor-not-allowed disabled:bg-slate-100"
                  />

                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.score}
                    onChange={(e) => handleRowChange(row.id, { score: Number(e.target.value) || 0 })}
                    disabled={isReadOnly}
                    className="h-9 rounded-md border border-[#DFE7F5] bg-[#FAFCFF] px-2 text-[11px] font-bold text-[#1F3C78] outline-none focus:border-[#9EB4E8] disabled:cursor-not-allowed disabled:bg-slate-100"
                  />

                  <input
                    value={row.keywords.join('，')}
                    onChange={(e) => handleRowChange(row.id, { keywords: parseKeywords(e.target.value) })}
                    disabled={isReadOnly}
                    placeholder="词1，词2"
                    className="h-9 rounded-md border border-[#DFE7F5] bg-[#FAFCFF] px-2 text-[11px] font-semibold text-[#27406B] outline-none focus:border-[#9EB4E8] disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="shrink-0 border-t border-[#E2E9F5] bg-white/92 p-3 backdrop-blur">
        <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-[#FDE8C2] bg-[#FFF9EC] px-3 py-2">
          <AlertCircle className={`h-4 w-4 shrink-0 ${hasBlockingErrors ? 'text-red-500' : 'text-[#C67E1C]'}`} />
          <p className={`text-[10px] font-semibold ${hasBlockingErrors ? 'text-red-700' : 'text-[#8B5A1F]'}`}>
            {hasBlockingErrors ? validation.errors[0] : '确认无误后即可保存到细则库（备用）'}
          </p>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onRegenerate}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-zinc-100 text-sm font-black text-zinc-600 transition-colors hover:bg-zinc-200"
          >
            <RefreshCw className="h-4 w-4" />
            返回重生成
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={hasBlockingErrors}
            className="flex h-11 flex-[1.65] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#2E56C8] to-[#3D67DB] text-sm font-black text-white shadow-[0_14px_26px_rgba(46,86,200,0.32)] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            <Save className="h-4 w-4" />
            保存备用
          </button>
        </div>

        {onSaveTemplate ? (
          <>
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={hasTemplateBlockingErrors || isSavingTemplate}
              className="mt-2.5 flex h-10 w-full items-center justify-center rounded-xl border border-[#DCE5F2] bg-white text-[12px] font-extrabold text-[#425778] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingTemplate ? '模板保存中...' : '另存为模板'}
            </button>
            {hasTemplateBlockingErrors ? (
              <p className="mt-1.5 text-[10px] font-semibold text-[#B91C1C]">
                模板保存受限：{templateValidation.errors[0]}
              </p>
            ) : null}
          </>
        ) : null}
      </footer>
    </div>
  );
}
