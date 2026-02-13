import type { PrismaClient } from "@prisma/client";
import { normalizeNonEmpty } from "@ai-grading/domain-core";

export class ExamDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ExamDomainError";
  }
}

export const isExamDomainError = (error: unknown): error is ExamDomainError => {
  return error instanceof ExamDomainError;
};

type ExamSessionDTO = {
  id: string;
  name: string;
  date: string | null;
  subject: string | null;
  grade: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

const toExamSessionDTO = (exam: {
  id: string;
  name: string;
  date: Date | null;
  subject: string | null;
  grade: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ExamSessionDTO => {
  return {
    id: exam.id,
    name: exam.name,
    date: exam.date ? exam.date.toISOString() : null,
    subject: exam.subject,
    grade: exam.grade,
    description: exam.description,
    createdAt: exam.createdAt.toISOString(),
    updatedAt: exam.updatedAt.toISOString()
  };
};

const parseExamDate = (raw?: string): Date | null => {
  const value = normalizeNonEmpty(raw);
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ExamDomainError("INVALID_EXAM_DATE", "考试日期格式无效", 400);
  }

  return parsed;
};

export const listExams = async (
  db: PrismaClient,
  scopeKey: string
): Promise<ExamSessionDTO[]> => {
  const exams = await db.examSession.findMany({
    where: { scopeKey },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }]
  });

  return exams.map(toExamSessionDTO);
};

export const createExam = async (
  db: PrismaClient,
  input: {
    scopeKey: string;
    name?: string;
    date?: string;
    subject?: string;
    grade?: string;
    description?: string;
  }
): Promise<ExamSessionDTO> => {
  const name = normalizeNonEmpty(input.name);
  if (!name) {
    throw new ExamDomainError("MISSING_EXAM_NAME", "考试名称不能为空", 400);
  }

  const created = await db.examSession.create({
    data: {
      scopeKey: input.scopeKey,
      name,
      date: parseExamDate(input.date),
      subject: normalizeNonEmpty(input.subject) ?? null,
      grade: normalizeNonEmpty(input.grade) ?? null,
      description: normalizeNonEmpty(input.description) ?? null
    }
  });

  return toExamSessionDTO(created);
};
