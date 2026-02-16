import type { ChangeEvent, ReactNode, RefObject } from "react";
import type { RubricSummaryDTO } from "../../../lib/api";
import type { RubricLifecycleStatus } from "../../../lib/api";
import { GearIcon } from "../../shared/icons";
import type { RubricResultPreview } from "../types";

type RubricInputViewProps = {
  statusMessage: ReactNode;
  busy: boolean;
  examName: string;
  grade: string;
  subject: string;
  questionType: string;
  questionKey: string;
  totalScore: string;
  specialRulesText: string;
  questionImage: string | null;
  answerImage: string | null;
  gradeOptions: readonly string[];
  subjectOptions: readonly string[];
  questionTypeOptions: readonly string[];
  importInputRef: RefObject<HTMLInputElement>;
  questionImageRef: RefObject<HTMLInputElement>;
  answerImageRef: RefObject<HTMLInputElement>;
  examId: string;
  loadingList: boolean;
  summaries: RubricSummaryDTO[];
  templatePanelOpen: boolean;
  hasGeneratedResult: boolean;
  resultPreview: RubricResultPreview;
  lifecycleStatus: RubricLifecycleStatus;
  onBack: () => void;
  onOpenSettings?: () => void;
  onClear: () => void;
  onGenerate: () => void;
  onToggleTemplatePanel: () => void;
  onRefreshTemplate: () => void;
  onLoadTemplate: (questionKey: string) => void;
  onOpenResultPreview: () => void;
  onExamNameChange: (value: string) => void;
  onGradeChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onQuestionTypeChange: (value: string) => void;
  onQuestionKeyChange: (value: string) => void;
  onTotalScoreChange: (value: string) => void;
  onSpecialRulesChange: (value: string) => void;
  onQuestionImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAnswerImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveQuestionImage: () => void;
  onRemoveAnswerImage: () => void;
  onExamIdChange: (value: string) => void;
  formatSummarySubline: (item: RubricSummaryDTO) => string;
  onImportJson: (event: ChangeEvent<HTMLInputElement>) => void;
};

export const RubricInputView = ({
  statusMessage,
  busy,
  examName,
  grade,
  subject,
  questionType,
  questionKey,
  totalScore,
  specialRulesText,
  questionImage,
  answerImage,
  gradeOptions,
  subjectOptions,
  questionTypeOptions,
  importInputRef,
  questionImageRef,
  answerImageRef,
  examId,
  loadingList,
  summaries,
  templatePanelOpen,
  hasGeneratedResult,
  resultPreview,
  lifecycleStatus,
  onBack,
  onOpenSettings,
  onClear,
  onGenerate,
  onToggleTemplatePanel,
  onRefreshTemplate,
  onLoadTemplate,
  onOpenResultPreview,
  onExamNameChange,
  onGradeChange,
  onSubjectChange,
  onQuestionTypeChange,
  onQuestionKeyChange,
  onTotalScoreChange,
  onSpecialRulesChange,
  onQuestionImageChange,
  onAnswerImageChange,
  onRemoveQuestionImage,
  onRemoveAnswerImage,
  onExamIdChange,
  formatSummarySubline,
  onImportJson
}: RubricInputViewProps) => {
  return (
    <section className="classic-rubric-workspace">
      <header className="classic-rubric-subheader">
        <button type="button" onClick={onBack}>←</button>
        <h3>生成评分细则</h3>
        <div className="classic-rubric-subheader-actions">
          <span className="classic-trial-chip">试用版</span>
          <button
            type="button"
            className="classic-rubric-settings-btn"
            aria-label="打开设置"
            onClick={onOpenSettings}
          >
            <GearIcon className="classic-gear-icon" />
          </button>
        </div>
      </header>

      {statusMessage}

      <div className="classic-rubric-generate-panel">
        <section>
          <h4>1.上传评分图片</h4>
          <div className="classic-rubric-upload-grid">
            <button
              type="button"
              className="classic-rubric-upload-btn classic-rubric-upload-btn-primary"
              onClick={() => questionImageRef.current?.click()}
            >
              {questionImage ? (
                <>
                  <img src={questionImage} alt="试题图片" />
                  <span className="classic-rubric-upload-badge">已上传</span>
                  <span
                    className="classic-rubric-upload-remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveQuestionImage();
                    }}
                  >
                    ✕
                  </span>
                </>
              ) : (
                <div className="classic-rubric-upload-placeholder">
                  <strong>上传试题（必填）</strong>
                </div>
              )}
            </button>
            <button
              type="button"
              className="classic-rubric-upload-btn"
              onClick={() => answerImageRef.current?.click()}
            >
              {answerImage ? (
                <>
                  <img src={answerImage} alt="答案图片" />
                  <span className="classic-rubric-upload-badge">已上传</span>
                  <span
                    className="classic-rubric-upload-remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveAnswerImage();
                    }}
                  >
                    ✕
                  </span>
                </>
              ) : (
                <div className="classic-rubric-upload-placeholder">
                  <strong>上传答案（可选）</strong>
                </div>
              )}
            </button>
          </div>
          <input
            ref={questionImageRef}
            type="file"
            accept="image/*"
            className="classic-hidden-input"
            onChange={onQuestionImageChange}
          />
          <input
            ref={answerImageRef}
            type="file"
            accept="image/*"
            className="classic-hidden-input"
            onChange={onAnswerImageChange}
          />
        </section>

        <section>
          <h4>2.填写基本信息</h4>
          <div className="classic-rubric-form-grid">
            <label>
              考试名称（可选）
              <input
                type="text"
                value={examName}
                onChange={(event) => onExamNameChange(event.target.value)}
                placeholder="例如：2026 春季期中"
              />
            </label>
            <label>
              学段
              <select value={grade} onChange={(event) => onGradeChange(event.target.value)}>
                {gradeOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              学科
              <select value={subject} onChange={(event) => onSubjectChange(event.target.value)}>
                {subjectOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              题型
              <select value={questionType} onChange={(event) => onQuestionTypeChange(event.target.value)}>
                {questionTypeOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              题号 *
              <input
                type="text"
                value={questionKey}
                onChange={(event) => onQuestionKeyChange(event.target.value)}
                placeholder="例如：13 或 13-1"
              />
            </label>
            <label>
              总分 *
              <input
                type="number"
                min={1}
                value={totalScore}
                onChange={(event) => onTotalScoreChange(event.target.value)}
                placeholder="例如：10"
              />
            </label>
          </div>
        </section>

        <section>
          <h4>3.添加特殊规则</h4>
          <textarea
            className="classic-rubric-rules-textarea"
            rows={3}
            value={specialRulesText}
            onChange={(event) => onSpecialRulesChange(event.target.value)}
            placeholder={"例如：\n错别字每3个扣1分\n未写结论扣1分"}
          />
          <p className="classic-rubric-rules-hint">每行一条，AI 生成时会自动纳入规则约束。</p>
        </section>

        <p className="classic-rubric-ai-note">AI 将自动拆分并填充：问题词、得分点、分值、关键词。</p>
      </div>

      {hasGeneratedResult ? (
        <section className="classic-rubric-latest-card">
          <header className="classic-rubric-latest-card-head">
            <h4>已生成结果</h4>
            <span>{lifecycleStatus === "published" ? "已发布" : "草稿"}</span>
          </header>
          <p className="classic-rubric-latest-card-title">{resultPreview.title}</p>
          <p className="classic-rubric-latest-card-meta">
            题号 {resultPreview.questionId} · 得分点 {resultPreview.points.length} 条 · 总分 {resultPreview.totalScore}
          </p>
          <button type="button" className="classic-rubric-latest-card-btn" onClick={onOpenResultPreview}>
            查看结果预览
          </button>
        </section>
      ) : null}

      <section className="classic-rubric-template-panel">
        <header className="classic-rubric-template-head">
          <div>
            <h4>模板库</h4>
            <p>在当前页直接加载历史评分细则，减少来回切换。</p>
          </div>
          <div className="classic-rubric-template-actions">
            <button
              type="button"
              className="classic-rubric-template-action"
              onClick={onRefreshTemplate}
              disabled={loadingList}
            >
              {loadingList ? "加载中..." : "刷新"}
            </button>
            <button
              type="button"
              className="classic-rubric-template-action classic-rubric-template-action-primary"
              onClick={onToggleTemplatePanel}
            >
              {templatePanelOpen ? "收起" : "展开"}
            </button>
          </div>
        </header>

        {templatePanelOpen ? (
          <>
            <div className="classic-rubric-toolbar">
              <input
                type="text"
                value={examId}
                onChange={(event) => onExamIdChange(event.target.value)}
                placeholder="按考试 ID 筛选（可选）"
              />
              <button type="button" onClick={onRefreshTemplate} disabled={loadingList}>
                {loadingList ? "加载中..." : "加载"}
              </button>
            </div>
            {summaries.length === 0 ? (
              <div className="classic-rubric-empty">暂无匹配细则，可先点击刷新。</div>
            ) : (
              <ul className="classic-rubric-list">
                {summaries.map((item) => (
                  <li key={item.questionId}>
                    <button type="button" onClick={() => onLoadTemplate(item.questionId)}>
                      <div>
                        <strong>{item.title || item.questionId}</strong>
                        <span>{formatSummarySubline(item)}</span>
                      </div>
                      <em>{item.lifecycleStatus === "published" ? "已发布" : "草稿"}</em>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </section>

      <div className="classic-rubric-bottom-bar">
        <button type="button" className="secondary" onClick={onClear} disabled={busy}>清空</button>
        <button type="button" className="primary" onClick={onGenerate} disabled={busy}>
          {busy ? "生成中..." : "生成细则"}
        </button>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="classic-hidden-input"
        onChange={onImportJson}
      />
    </section>
  );
};
