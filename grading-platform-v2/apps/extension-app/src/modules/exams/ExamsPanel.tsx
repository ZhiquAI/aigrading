import { useEffect, useMemo, useState } from "react";
import { copyText } from "../../lib/clipboard";
import { createExam, fetchExams, type ExamSessionDTO } from "../../lib/api";

type ExamsPanelProps = {
  selectedExamId: string;
  onSelectExamId: (examId: string) => void;
  onSelectedExamNameChange?: (examName: string) => void;
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const toDateInputValue = (value: string | null): string => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
};

export const ExamsPanel = ({ selectedExamId, onSelectExamId, onSelectedExamNameChange }: ExamsPanelProps) => {
  const [name, setName] = useState("高二历史月考");
  const [date, setDate] = useState("");
  const [subject, setSubject] = useState("history");
  const [grade, setGrade] = useState("高二");
  const [description, setDescription] = useState("阶段性练习");
  const [keyword, setKeyword] = useState("");
  const [exams, setExams] = useState<ExamSessionDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedExam = useMemo(() => {
    return exams.find((item) => item.id === selectedExamId) ?? null;
  }, [exams, selectedExamId]);

  const filteredExams = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return exams;
    }

    return exams.filter((item) => {
      return (
        item.name.toLowerCase().includes(normalizedKeyword) ||
        (item.subject ?? "").toLowerCase().includes(normalizedKeyword) ||
        (item.grade ?? "").toLowerCase().includes(normalizedKeyword)
      );
    });
  }, [keyword, exams]);

  const resetMessage = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const loadExams = async (): Promise<void> => {
    setBusy(true);
    resetMessage();

    try {
      const items = await fetchExams();
      setExams(items);
      setSuccessMessage(`已加载 ${items.length} 条考试会话`);

      const firstExam = items.at(0);
      if (!selectedExamId && firstExam) {
        onSelectExamId(firstExam.id);
        onSelectedExamNameChange?.(firstExam.name);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取考试列表失败");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadExams();
  }, []);

  const handleCreate = async (): Promise<void> => {
    if (!name.trim()) {
      setErrorMessage("考试名称不能为空");
      return;
    }

    setBusy(true);
    resetMessage();

    try {
      const created = await createExam({
        name: name.trim(),
        date: date || undefined,
        subject: subject.trim() || undefined,
        grade: grade.trim() || undefined,
        description: description.trim() || undefined
      });

      setExams((current) => [created, ...current]);
      onSelectExamId(created.id);
      onSelectedExamNameChange?.(created.name);
      setSuccessMessage(`考试已创建并选中：${created.name}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建考试失败");
    } finally {
      setBusy(false);
    }
  };

  const handleSelectChange = (id: string): void => {
    onSelectExamId(id);

    const matched = exams.find((item) => item.id === id);
    if (matched) {
      onSelectedExamNameChange?.(matched.name);
      setName(matched.name);
      setDate(toDateInputValue(matched.date));
      setSubject(matched.subject ?? "");
      setGrade(matched.grade ?? "");
      setDescription(matched.description ?? "");
      setSuccessMessage(`已切换考试：${matched.name}`);
      setErrorMessage(null);
    } else if (!id) {
      onSelectedExamNameChange?.("");
    }
  };

  const handleCopyExamId = async (): Promise<void> => {
    if (!selectedExam) {
      setErrorMessage("当前未选中考试");
      return;
    }

    try {
      await copyText(selectedExam.id);
      setSuccessMessage("考试 ID 已复制");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "复制考试 ID 失败");
    }
  };

  return (
    <section className="card card-wide">
      <header className="card-header">
        <h2>Exams</h2>
        <span className="hint">接口: /api/v2/exams</span>
      </header>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="exam-keyword">筛选关键词</label>
          <input
            id="exam-keyword"
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="名称/学科/年级"
          />
        </div>

        <div className="field-group">
          <label htmlFor="exam-select">当前考试</label>
          <select
            id="exam-select"
            value={selectedExamId}
            onChange={(event) => handleSelectChange(event.target.value)}
          >
            <option value="">不绑定考试</option>
            {filteredExams.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field-group">
          <label htmlFor="exam-name">考试名称</label>
          <input id="exam-name" type="text" value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <div className="field-group">
          <label htmlFor="exam-date">考试日期</label>
          <input id="exam-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="exam-subject">学科</label>
          <input
            id="exam-subject"
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="history"
          />
        </div>

        <div className="field-group">
          <label htmlFor="exam-grade">年级</label>
          <input id="exam-grade" type="text" value={grade} onChange={(event) => setGrade(event.target.value)} />
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="exam-description">说明</label>
        <textarea
          id="exam-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />
      </div>

      <div className="btn-row">
        <button type="button" className="secondary-btn" onClick={() => void loadExams()} disabled={busy}>
          刷新列表
        </button>
        <button type="button" className="secondary-btn" onClick={() => void handleCopyExamId()} disabled={busy}>
          复制考试 ID
        </button>
        <button type="button" className="primary-btn" onClick={() => void handleCreate()} disabled={busy}>
          新建考试
        </button>
      </div>

      <p className="hint">当前显示 {filteredExams.length} / {exams.length} 条考试</p>

      {selectedExam ? (
        <div className="status-box">
          <h3>当前选中考试</h3>
          <pre>
{JSON.stringify(
  {
    id: selectedExam.id,
    name: selectedExam.name,
    date: selectedExam.date,
    subject: selectedExam.subject,
    grade: selectedExam.grade,
    description: selectedExam.description,
    updatedAt: formatDateTime(selectedExam.updatedAt)
  },
  null,
  2
)}
          </pre>
        </div>
      ) : null}

      {successMessage ? <p className="success-text">{successMessage}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
};
