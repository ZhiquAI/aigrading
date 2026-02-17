import * as React from "react";
import { cn } from "../../lib/utils";
import type { GradingSegmentResult } from "./types";

export type GradingSegmentSectionProps = {
  segment: GradingSegmentResult;
  className?: string;
};

const renderScore = (score: number, maxScore: number): string => `${score} / ${maxScore}`;

export const GradingSegmentSection = ({ segment, className }: GradingSegmentSectionProps) => {
  return (
    <section className={cn("ag-grading-segment", className)}>
      <header className="ag-grading-segment-header">
        <div>
          <h4>{segment.title}</h4>
          <p>{segment.strategyType}</p>
        </div>
        <strong>{renderScore(segment.score, segment.maxScore)}</strong>
      </header>

      <div className="ag-grading-segment-items">
        {segment.items.map((item) => {
          if (item.type === "dimension") {
            return (
              <article key={`${segment.segmentId}-${item.dimensionId}`} className="ag-grading-item">
                <div className="ag-grading-item-head">
                  <span>{item.dimensionName}</span>
                  <span>{renderScore(item.score, item.maxScore)}</span>
                </div>
                <p>等级：{item.selectedLevel}</p>
                {item.comment ? <p>{item.comment}</p> : null}
              </article>
            );
          }

          if (item.type === "step") {
            return (
              <article key={`${segment.segmentId}-${item.stepId}`} className="ag-grading-item">
                <div className="ag-grading-item-head">
                  <span>{item.label}</span>
                  <span>{renderScore(item.score, item.maxScore)}</span>
                </div>
                <p>{item.comment || (item.skippedByDependency ? "前置步骤未满足" : "无补充说明")}</p>
                {item.matchedText ? <blockquote>{item.matchedText}</blockquote> : null}
              </article>
            );
          }

          return (
            <article key={`${segment.segmentId}-${item.pointId}`} className="ag-grading-item">
              <div className="ag-grading-item-head">
                <span>{item.label}</span>
                <span>{renderScore(item.score, item.maxScore)}</span>
              </div>
              <p>{item.comment || (item.matched ? "匹配成功" : "未命中关键点")}</p>
              {item.matchedText ? <blockquote>{item.matchedText}</blockquote> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
};
