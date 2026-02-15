import { AppTopHeader } from "../../app-shell/AppTopHeader";
import { Badge, Button, Card, EmptyState } from "@ai-grading/ui-kit";
import { GearIcon, SearchIcon } from "../shared/icons";

type RecordsHomeViewProps = {
  recordCount: number;
  onOpenSettings: () => void;
  onOpenWorkspace: () => void;
};

export const RecordsHomeView = ({
  recordCount,
  onOpenSettings,
  onOpenWorkspace
}: RecordsHomeViewProps) => {
  return (
    <>
      <AppTopHeader
        title="批改历史"
        onOpenSettings={onOpenSettings}
        gearIcon={<GearIcon className="classic-gear-icon" />}
      />

      <div className="classic-page-scroll">
        <Card variant="unstyled" className="classic-module-card">
          <header className="classic-module-header">
            <div>
              <h2>HistoryView</h2>
              <p>历史记录检索与导出</p>
            </div>
            <Badge variant="blue" className="classic-count-chip">
              {recordCount} 条
            </Badge>
          </header>

          <div className="classic-search-input">
            <SearchIcon className="classic-symbol-icon classic-search-svg" />
            <span>搜索题号、题目标识或评语关键词</span>
          </div>

          <div className="classic-export-buttons">
            <Button type="button" variant="unstyled" className="classic-btn-flat" onClick={onOpenWorkspace}>
              导出 CSV
            </Button>
            <Button type="button" variant="unstyled" className="classic-btn-flat" onClick={onOpenWorkspace}>
              导出 JSON
            </Button>
          </div>

          <div className="classic-table-head-row">
            <span>时间</span>
            <span>题目</span>
            <span>得分</span>
            <span>操作</span>
          </div>

          <EmptyState
            title="暂无历史记录"
            description="先完成一次批改，系统会自动沉淀记录并支持导出。"
            className="classic-history-empty"
          />
        </Card>
      </div>
    </>
  );
};
