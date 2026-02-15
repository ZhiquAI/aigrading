export type RubricResultPoint = {
  id: string;
  questionSegment: string;
  content: string;
  score: number;
  keywords: string[];
};

export type RubricResultPreview = {
  title: string;
  questionId: string;
  subject: string;
  questionType: string;
  strategyLabel: string;
  totalScore: number;
  points: RubricResultPoint[];
};
