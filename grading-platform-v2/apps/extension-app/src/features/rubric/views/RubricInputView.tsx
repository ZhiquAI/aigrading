import type { ChangeEvent, ReactNode, RefObject } from "react";
import { GearIcon } from "../../shared/icons";

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
  onBack: () => void;
  onOpenSettings?: () => void;
  onClear: () => void;
  onGenerate: () => void;
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
  onBack,
  onOpenSettings,
  onClear,
  onGenerate,
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
  onImportJson
}: RubricInputViewProps) => {
  return (
    <section className="legacy-rubric-workspace">
      <header className="legacy-rubric-subheader">
        <button type="button" onClick={onBack}>←</button>
        <h3>生成评分细则</h3>
        <div className="legacy-rubric-subheader-actions">
          <span className="legacy-trial-chip">试用版</span>
          <button
            type="button"
            className="legacy-rubric-settings-btn"
            aria-label="打开设置"
            onClick={onOpenSettings}
          >
            <GearIcon className="legacy-gear-icon" />
          </button>
        </div>
      </header>

      {statusMessage}

      <div className="legacy-rubric-generate-panel">
        <section>
          <h4>1.上传评分图片</h4>
          <div className="legacy-rubric-upload-grid">
            <button
              type="button"
              className="legacy-rubric-upload-btn legacy-rubric-upload-btn-primary"
              onClick={() => questionImageRef.current?.click()}
            >
              {questionImage ? (
                <>
                  <img src={questionImage} alt="试题图片" />
                  <span className="legacy-rubric-upload-badge">已上传</span>
                  <span
                    className="legacy-rubric-upload-remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveQuestionImage();
                    }}
                  >
                    ✕
                  </span>
                </>
              ) : (
                <div className="legacy-rubric-upload-placeholder">
                  <strong>上传试题（必填）</strong>
                </div>
              )}
            </button>
            <button
              type="button"
              className="legacy-rubric-upload-btn"
              onClick={() => answerImageRef.current?.click()}
            >
              {answerImage ? (
                <>
                  <img src={answerImage} alt="答案图片" />
                  <span className="legacy-rubric-upload-badge">已上传</span>
                  <span
                    className="legacy-rubric-upload-remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveAnswerImage();
                    }}
                  >
                    ✕
                  </span>
                </>
              ) : (
                <div className="legacy-rubric-upload-placeholder">
                  <strong>上传答案（可选）</strong>
                </div>
              )}
            </button>
          </div>
          <input
            ref={questionImageRef}
            type="file"
            accept="image/*"
            className="legacy-hidden-input"
            onChange={onQuestionImageChange}
          />
          <input
            ref={answerImageRef}
            type="file"
            accept="image/*"
            className="legacy-hidden-input"
            onChange={onAnswerImageChange}
          />
        </section>

        <section>
          <h4>2.填写基本信息</h4>
          <div className="legacy-rubric-form-grid">
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
            className="legacy-rubric-rules-textarea"
            rows={3}
            value={specialRulesText}
            onChange={(event) => onSpecialRulesChange(event.target.value)}
            placeholder={"例如：\n错别字每3个扣1分\n未写结论扣1分"}
          />
          <p className="legacy-rubric-rules-hint">每行一条，AI 生成时会自动纳入规则约束。</p>
        </section>

        <p className="legacy-rubric-ai-note">AI 将自动拆分并填充：问题词、得分点、分值、关键词。</p>
      </div>

      <div className="legacy-rubric-bottom-bar">
        <button type="button" className="secondary" onClick={onClear} disabled={busy}>清空</button>
        <button type="button" className="primary" onClick={onGenerate} disabled={busy}>
          {busy ? "生成中..." : "生成细则"}
        </button>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="legacy-hidden-input"
        onChange={onImportJson}
      />
    </section>
  );
};
