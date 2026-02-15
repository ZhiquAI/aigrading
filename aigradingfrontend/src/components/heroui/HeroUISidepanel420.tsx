import React from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Select,
  SelectItem,
  Tab,
  Tabs,
  Textarea,
} from "@heroui/react";
import {
  Brain,
  ClipboardList,
  History,
  LayoutPanelTop,
  Settings,
  Sparkles,
} from "lucide-react";

const metricCards = [
  { label: "今日批改", value: "128" },
  { label: "平均分", value: "72.4" },
];

const queueRows = [
  { name: "张同学 · 第3题", hint: "待批改 · 上传于 10:24", status: "wait" },
  { name: "李同学 · 第3题", hint: "已完成 · AI 建议 86 分", status: "ok" },
];

const historyRows = [
  { name: "期中测试 · 第3题", hint: "2026-02-05 · 平均分 76.4", status: "ok" },
  { name: "单元测验 · 第2题", hint: "2026-02-03 · 平均分 69.1", status: "wait" },
];

function statusChip(status: "ok" | "wait" | "warn"): React.ReactNode {
  if (status === "ok") {
    return <Chip color="success" size="sm" variant="flat">完成</Chip>;
  }
  if (status === "warn") {
    return <Chip color="danger" size="sm" variant="flat">未开始</Chip>;
  }
  return <Chip color="warning" size="sm" variant="flat">待处理</Chip>;
}

const cardStyle = "border border-default-200 bg-content1 shadow-sm";

const HeroUISidepanel420: React.FC = () => {
  return (
    <div className="mx-auto h-screen w-full max-w-[420px] overflow-hidden border-x border-default-200 bg-gradient-to-b from-default-100 via-default-50 to-default-100">
      <header className="sticky top-0 z-20 border-b border-default-200/80 bg-background/90 px-3 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-medium">
              <Sparkles size={14} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-foreground">AI 批改助手</p>
              <p className="truncate text-[10px] font-bold text-default-500">HeroUI 紧凑侧边栏</p>
            </div>
          </div>
          <Button size="sm" variant="flat" color="primary">
            切换题目
          </Button>
        </div>
      </header>

      <div className="border-b border-default-200/80 bg-background/80 px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          <Chip color="primary" variant="flat" size="sm">企业版</Chip>
          <Chip color="primary" variant="flat" size="sm">额度 2340</Chip>
          <Chip color="primary" variant="flat" size="sm">第 3 题</Chip>
        </div>
      </div>

      <main className="h-[calc(100vh-146px)] overflow-y-auto px-3 pb-24 pt-2">
        <Tabs
          aria-label="module tabs"
          radius="md"
          size="sm"
          color="primary"
          className="mb-2"
          classNames={{
            tabList: "grid w-full grid-cols-4 bg-default-100",
            tab: "text-xs font-extrabold",
          }}
        >
          <Tab
            key="grading"
            title={
              <span className="flex items-center gap-1">
                <LayoutPanelTop size={12} />
                批改
              </span>
            }
          />
          <Tab
            key="rubric"
            title={
              <span className="flex items-center gap-1">
                <ClipboardList size={12} />
                细则
              </span>
            }
          />
          <Tab
            key="history"
            title={
              <span className="flex items-center gap-1">
                <History size={12} />
                历史
              </span>
            }
          />
          <Tab
            key="settings"
            title={
              <span className="flex items-center gap-1">
                <Settings size={12} />
                设置
              </span>
            }
          />
        </Tabs>

        <section className="space-y-2">
          <Card radius="lg" className={cardStyle}>
            <CardHeader className="flex items-center justify-between gap-2 py-2">
              <p className="text-xs font-black">GradingView</p>
              <Button size="sm" color="primary">开始批改</Button>
            </CardHeader>
            <CardBody className="space-y-2 pt-0">
              <div className="grid grid-cols-2 gap-2">
                {metricCards.map((metric) => (
                  <Card key={metric.label} radius="md" className="border border-default-200 bg-content1 shadow-none">
                    <CardBody className="gap-1 p-2">
                      <p className="text-[10px] font-bold text-default-500">{metric.label}</p>
                      <p className="text-lg font-black leading-none tracking-tight">{metric.value}</p>
                    </CardBody>
                  </Card>
                ))}
              </div>
              <div className="space-y-1.5">
                {queueRows.map((item) => (
                  <div
                    key={item.name}
                    className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-default-200 bg-content1 px-2 py-1.5"
                  >
                    <div>
                      <p className="text-[11px] font-extrabold text-foreground">{item.name}</p>
                      <p className="text-[10px] font-bold text-default-500">{item.hint}</p>
                    </div>
                    {statusChip(item.status as "ok" | "wait")}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card radius="lg" className={cardStyle}>
            <CardHeader className="flex items-center justify-between gap-2 py-2">
              <p className="text-xs font-black">RubricPanel</p>
              <Chip color="primary" variant="flat" size="sm">步骤 1/3</Chip>
            </CardHeader>
            <CardBody className="space-y-2 pt-0">
              <div className="space-y-1.5">
                <div className="grid grid-cols-[22px_1fr_auto] items-center gap-2 rounded-xl border border-default-200 bg-content2 px-2 py-1.5">
                  <div className="grid h-5 w-5 place-items-center rounded-lg bg-primary-100 text-[10px] font-black text-primary-600">1</div>
                  <div>
                    <p className="text-[11px] font-extrabold">上传评分图片</p>
                    <p className="text-[10px] font-bold text-default-500">试题图 + 参考答案图</p>
                  </div>
                  {statusChip("ok")}
                </div>
                <div className="grid grid-cols-[22px_1fr_auto] items-center gap-2 rounded-xl border border-default-200 bg-content2 px-2 py-1.5">
                  <div className="grid h-5 w-5 place-items-center rounded-lg bg-primary-100 text-[10px] font-black text-primary-600">2</div>
                  <div>
                    <p className="text-[11px] font-extrabold">基本信息</p>
                    <p className="text-[10px] font-bold text-default-500">考试、题号、策略</p>
                  </div>
                  {statusChip("wait")}
                </div>
                <div className="grid grid-cols-[22px_1fr_auto] items-center gap-2 rounded-xl border border-default-200 bg-content2 px-2 py-1.5">
                  <div className="grid h-5 w-5 place-items-center rounded-lg bg-primary-100 text-[10px] font-black text-primary-600">3</div>
                  <div>
                    <p className="text-[11px] font-extrabold">特殊规则</p>
                    <p className="text-[10px] font-bold text-default-500">关键词 / 扣分 / 字数</p>
                  </div>
                  {statusChip("warn")}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input label="考试名称" size="sm" labelPlacement="outside" defaultValue="2026 春季期中" />
                <Input label="题号" size="sm" labelPlacement="outside" defaultValue="第 3 题" />
                <Textarea
                  className="col-span-2"
                  label="规则"
                  size="sm"
                  labelPlacement="outside"
                  defaultValue={"无标题扣2分\n每3个错别字扣1分"}
                  minRows={3}
                />
              </div>
            </CardBody>
          </Card>

          <Card radius="lg" className={cardStyle}>
            <CardHeader className="flex items-center justify-between gap-2 py-2">
              <p className="text-xs font-black">HistoryView</p>
              <Button size="sm" variant="flat">导出</Button>
            </CardHeader>
            <CardBody className="space-y-2 pt-0">
              <Input size="sm" label="筛选" labelPlacement="outside" placeholder="考试名 / 题号 / 时间" />
              <div className="space-y-1.5">
                {historyRows.map((item) => (
                  <div
                    key={item.name}
                    className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-default-200 bg-content1 px-2 py-1.5"
                  >
                    <div>
                      <p className="text-[11px] font-extrabold text-foreground">{item.name}</p>
                      <p className="text-[10px] font-bold text-default-500">{item.hint}</p>
                    </div>
                    {statusChip(item.status as "ok" | "wait")}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card radius="lg" className={cardStyle}>
            <CardHeader className="flex items-center justify-between gap-2 py-2">
              <p className="text-xs font-black">SettingsView</p>
              <Button size="sm" variant="flat">测试连接</Button>
            </CardHeader>
            <CardBody className="space-y-2 pt-0">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  label="模型平台"
                  size="sm"
                  labelPlacement="outside"
                  defaultSelectedKeys={["gemini"]}
                >
                  <SelectItem key="gemini">Google Gemini</SelectItem>
                  <SelectItem key="openai">OpenAI</SelectItem>
                  <SelectItem key="glm">智谱 GLM</SelectItem>
                </Select>
                <Select
                  label="默认模型"
                  size="sm"
                  labelPlacement="outside"
                  defaultSelectedKeys={["flash"]}
                >
                  <SelectItem key="flash">Gemini 2.5 Flash</SelectItem>
                  <SelectItem key="gpt4o">GPT-4o</SelectItem>
                </Select>
                <Input
                  className="col-span-2"
                  label="API Key"
                  size="sm"
                  labelPlacement="outside"
                  defaultValue="sk-********************************"
                />
              </div>
            </CardBody>
          </Card>
        </section>
      </main>

      <footer className="fixed bottom-0 z-20 mx-auto flex w-full max-w-[420px] gap-2 border-t border-default-200/80 bg-background/90 px-3 py-2 backdrop-blur-md">
        <Button className="flex-1" variant="bordered">返回</Button>
        <Button className="flex-1" color="primary">保存设置</Button>
      </footer>
    </div>
  );
};

export default HeroUISidepanel420;
