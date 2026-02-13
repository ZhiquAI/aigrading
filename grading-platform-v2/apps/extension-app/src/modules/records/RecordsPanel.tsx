import { useEffect, useState } from "react";
import {
  createRecordBatch,
  createSingleRecord,
  deleteRecordById,
  deleteRecordsByFilter,
  fetchRecords,
  type RecordInputDTO,
  type RecordItemDTO,
  type RecordListResultDTO
} from "../../lib/api";

type RecordsPanelProps = {
  questionKey: string;
};

const parseScore = (raw: string, label: string): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} 必须是数字`);
  }
  return parsed;
};

const normalizePositiveInt = (raw: string, fallback: number): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
};

const parseBreakdown = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
};

const parseBatchRecords = (raw: string): RecordInputDTO[] => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("批量导入 JSON 格式无效");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("批量导入必须是数组 JSON");
  }

  if (parsed.length === 0) {
    throw new Error("批量导入数组不能为空");
  }

  if (parsed.length > 100) {
    throw new Error("单次最多导入 100 条记录");
  }

  return parsed as RecordInputDTO[];
};

const formatScore = (value: number): string => {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const safeText = (value: string | null): string => {
  return value ?? "-";
};

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString();
};

export const RecordsPanel = ({ questionKey }: RecordsPanelProps) => {
  const [page, setPage] = useState("1");
  const [limit, setLimit] = useState("20");
  const [filterQuestionKey, setFilterQuestionKey] = useState(questionKey);
  const [filterQuestionNo, setFilterQuestionNo] = useState("");
  const [recordsData, setRecordsData] = useState<RecordListResultDTO | null>(null);

  const [studentName, setStudentName] = useState("张三");
  const [newQuestionNo, setNewQuestionNo] = useState("Q1");
  const [examNo, setExamNo] = useState("EX-2026-001");
  const [score, setScore] = useState("8");
  const [maxScore, setMaxScore] = useState("10");
  const [comment, setComment] = useState("观点完整，史实准确");
  const [breakdown, setBreakdown] = useState('[{"label":"史实","score":4,"max":5,"comment":"基本准确"}]');

  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [batchJson, setBatchJson] = useState(
    JSON.stringify(
      [
        {
          studentName: "李四",
          questionNo: "Q1",
          examNo: "EX-2026-001",
          score: 9,
          maxScore: 10,
          comment: "论证完整",
          breakdown: [{ label: "史实", score: 5, max: 5, comment: "准确" }]
        },
        {
          studentName: "王五",
          questionNo: "Q1",
          examNo: "EX-2026-001",
          score: 7,
          maxScore: 10,
          comment: "要点有遗漏"
        }
      ],
      null,
      2
    )
  );

  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!filterQuestionKey.trim() && questionKey.trim()) {
      setFilterQuestionKey(questionKey.trim());
    }

    if (!newQuestionNo.trim() && questionKey.trim()) {
      setNewQuestionNo(questionKey.trim());
    }
  }, [questionKey]);

  const resetMessage = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const loadRecords = async (pageOverride?: number): Promise<void> => {
    setBusy(true);
    resetMessage();

    const nextPage = pageOverride ?? normalizePositiveInt(page, 1);
    const nextLimit = Math.min(normalizePositiveInt(limit, 20), 100);

    try {
      const data = await fetchRecords({
        page: nextPage,
        limit: nextLimit,
        questionNo: filterQuestionNo.trim() || undefined,
        questionKey: filterQuestionKey.trim() || undefined
      });

      setPage(String(nextPage));
      setLimit(String(nextLimit));
      setRecordsData(data);
      setSuccessMessage(`读取成功：${data.records.length} / ${data.total}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取记录失败");
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (): Promise<void> => {
    setBusy(true);
    resetMessage();

    try {
      const result = await createSingleRecord({
        studentName: studentName.trim() || undefined,
        questionNo: newQuestionNo.trim() || undefined,
        questionKey: questionKey.trim() || undefined,
        examNo: examNo.trim() || undefined,
        score: parseScore(score, "score"),
        maxScore: parseScore(maxScore, "maxScore"),
        comment: comment.trim() || undefined,
        breakdown: parseBreakdown(breakdown)
      });

      setSuccessMessage(`新增成功：${result.created} 条`);
      await loadRecords();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "新增记录失败");
    } finally {
      setBusy(false);
    }
  };

  const handleBatchCreate = async (): Promise<void> => {
    setBusy(true);
    resetMessage();

    try {
      const records = parseBatchRecords(batchJson);
      const result = await createRecordBatch(records, idempotencyKey.trim() || undefined);

      setSuccessMessage(`批量导入成功：${result.created} 条`);
      await loadRecords();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "批量导入失败");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteByFilter = async (): Promise<void> => {
    const normalizedQuestionKey = filterQuestionKey.trim();
    const normalizedQuestionNo = filterQuestionNo.trim();

    if (!normalizedQuestionKey && !normalizedQuestionNo) {
      setErrorMessage("批量删除至少需要 questionKey 或 questionNo");
      return;
    }

    setBusy(true);
    resetMessage();

    try {
      const result = await deleteRecordsByFilter({
        questionKey: normalizedQuestionKey || undefined,
        questionNo: normalizedQuestionNo || undefined
      });

      setSuccessMessage(`删除成功：${result.deleted} 条`);
      await loadRecords(1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除记录失败");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSingle = async (record: RecordItemDTO): Promise<void> => {
    setBusy(true);
    resetMessage();

    try {
      const result = await deleteRecordById(record.id);
      setSuccessMessage(`已删除 ${result.deleted} 条记录`);
      await loadRecords();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除单条记录失败");
    } finally {
      setBusy(false);
    }
  };

  const handlePrevPage = async (): Promise<void> => {
    const current = recordsData?.page ?? normalizePositiveInt(page, 1);
    if (current <= 1) {
      return;
    }

    await loadRecords(current - 1);
  };

  const handleNextPage = async (): Promise<void> => {
    const current = recordsData?.page ?? normalizePositiveInt(page, 1);
    const totalPages = recordsData?.totalPages ?? current;
    if (current >= totalPages) {
      return;
    }

    await loadRecords(current + 1);
  };

  return (
    <section className="card card-wide">
      <header className="card-header">
        <h2>Records</h2>
        <span className="hint">接口: /api/v2/records*</span>
      </header>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="records-page">Page</label>
          <input id="records-page" type="number" min={1} value={page} onChange={(event) => setPage(event.target.value)} />
        </div>

        <div className="field-group">
          <label htmlFor="records-limit">Limit</label>
          <input
            id="records-limit"
            type="number"
            min={1}
            max={100}
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
          />
        </div>

        <div className="field-group">
          <label htmlFor="records-filter-question-key">Filter Question Key</label>
          <input
            id="records-filter-question-key"
            type="text"
            value={filterQuestionKey}
            onChange={(event) => setFilterQuestionKey(event.target.value)}
            placeholder="Q1"
          />
        </div>

        <div className="field-group">
          <label htmlFor="records-filter-question-no">Filter Question No</label>
          <input
            id="records-filter-question-no"
            type="text"
            value={filterQuestionNo}
            onChange={(event) => setFilterQuestionNo(event.target.value)}
            placeholder="Q1"
          />
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="secondary-btn" onClick={() => void loadRecords()} disabled={busy}>
          查询
        </button>
        <button type="button" className="secondary-btn" onClick={() => void handlePrevPage()} disabled={busy}>
          上一页
        </button>
        <button type="button" className="secondary-btn" onClick={() => void handleNextPage()} disabled={busy}>
          下一页
        </button>
        <button type="button" className="danger-btn" onClick={() => void handleDeleteByFilter()} disabled={busy}>
          按筛选批量删除
        </button>
      </div>

      <div className="field-row">
        <div className="field-group">
          <label htmlFor="records-student">学生姓名</label>
          <input
            id="records-student"
            type="text"
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
          />
        </div>

        <div className="field-group">
          <label htmlFor="records-question-no">Question No</label>
          <input
            id="records-question-no"
            type="text"
            value={newQuestionNo}
            onChange={(event) => setNewQuestionNo(event.target.value)}
          />
        </div>

        <div className="field-group">
          <label htmlFor="records-exam-no">Exam No</label>
          <input id="records-exam-no" type="text" value={examNo} onChange={(event) => setExamNo(event.target.value)} />
        </div>

        <div className="field-group">
          <label htmlFor="records-score">Score</label>
          <input id="records-score" type="number" value={score} onChange={(event) => setScore(event.target.value)} />
        </div>

        <div className="field-group">
          <label htmlFor="records-max-score">Max Score</label>
          <input
            id="records-max-score"
            type="number"
            value={maxScore}
            onChange={(event) => setMaxScore(event.target.value)}
          />
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="records-comment">评语</label>
        <textarea id="records-comment" value={comment} onChange={(event) => setComment(event.target.value)} rows={2} />
      </div>

      <div className="field-group">
        <label htmlFor="records-breakdown">Breakdown（JSON 或文本）</label>
        <textarea
          id="records-breakdown"
          value={breakdown}
          onChange={(event) => setBreakdown(event.target.value)}
          rows={3}
        />
      </div>

      <div className="btn-row">
        <button type="button" className="primary-btn" onClick={() => void handleCreate()} disabled={busy}>
          新增记录
        </button>
      </div>

      <div className="field-group">
        <label htmlFor="records-idempotency-key">幂等键（可选，批量导入用）</label>
        <input
          id="records-idempotency-key"
          type="text"
          value={idempotencyKey}
          onChange={(event) => setIdempotencyKey(event.target.value)}
          placeholder="例如: import-20260214-001"
        />
      </div>

      <div className="field-group">
        <label htmlFor="records-batch-json">批量导入 JSON（数组）</label>
        <textarea
          id="records-batch-json"
          value={batchJson}
          onChange={(event) => setBatchJson(event.target.value)}
          rows={8}
        />
      </div>

      <div className="btn-row">
        <button type="button" className="primary-btn" onClick={() => void handleBatchCreate()} disabled={busy}>
          批量导入
        </button>
      </div>

      {recordsData ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>学生</th>
                <th>题号</th>
                <th>分数</th>
                <th>评语</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {recordsData.records.map((record) => (
                <tr key={record.id}>
                  <td>{record.studentName}</td>
                  <td>{safeText(record.questionNo ?? record.questionKey)}</td>
                  <td>{`${formatScore(record.score)} / ${formatScore(record.maxScore)}`}</td>
                  <td>{safeText(record.comment)}</td>
                  <td>{formatDateTime(record.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="danger-btn table-btn"
                      onClick={() => void handleDeleteSingle(record)}
                      disabled={busy}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">共 {recordsData.total} 条，当前第 {recordsData.page}/{recordsData.totalPages} 页</p>
        </div>
      ) : null}

      {successMessage ? <p className="success-text">{successMessage}</p> : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
};
