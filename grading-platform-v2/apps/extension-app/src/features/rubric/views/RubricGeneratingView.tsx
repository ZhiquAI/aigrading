import { Button, Card, Progress } from "@ai-grading/ui-kit";

type RubricGeneratingViewProps = {
  generationStep: number;
  generationProgress: number;
  generationMessages: readonly string[];
  onBack: () => void;
};

export const RubricGeneratingView = ({
  generationStep,
  generationProgress,
  generationMessages,
  onBack
}: RubricGeneratingViewProps) => {
  return (
    <section className="classic-rubric-workspace classic-rubric-generating">
      <header className="classic-rubric-subheader">
        <Button type="button" variant="unstyled" onClick={onBack}>
          ←
        </Button>
        <h3>正在生成细则</h3>
        <span />
      </header>

      <Card variant="unstyled" className="classic-rubric-progress-card">
        <div className="classic-rubric-loader" aria-hidden="true" />
        <strong>{generationMessages[generationStep]}</strong>
        <Progress value={generationProgress} className="classic-rubric-progress-track" />
        <p>预计 3-10 秒，请稍候</p>
      </Card>
    </section>
  );
};
