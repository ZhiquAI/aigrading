import React from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Select,
  SelectItem,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
  Textarea,
} from "@heroui/react";
import { ClipboardList, History, LayoutPanelTop, Settings } from "lucide-react";

const HeroUIDefaultThemeDraft: React.FC = () => {
  return (
    <div className="mx-auto h-screen w-full max-w-[420px] overflow-hidden border-x border-default-200 bg-background">
      <header className="sticky top-0 z-20 border-b border-default-200 bg-background px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">AI 智能批改助手</p>
            <p className="truncate text-xs text-default-500">HeroUI 默认主题设计稿</p>
          </div>
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="flat">
              企业版
            </Chip>
            <Button size="sm" color="primary" variant="flat">
              新建
            </Button>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-65px)] overflow-y-auto px-3 pb-24 pt-2">
        <Tabs
          aria-label="view tabs"
          color="primary"
          radius="md"
          size="sm"
          className="mb-3"
          classNames={{
            tabList: "grid w-full grid-cols-4",
            tab: "text-xs font-semibold",
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

        <div className="space-y-3">
          <Card>
            <CardHeader className="flex items-center justify-between gap-2 py-2">
              <p className="text-xs font-semibold">GradingView</p>
              <Button size="sm" color="primary">
                开始批改
              </Button>
            </CardHeader>
            <CardBody className="space-y-2 pt-0">
              <div className="grid grid-cols-2 gap-2">
                <Card shadow="none" className="border border-default-200">
                  <CardBody className="p-2">
                    <p className="text-[11px] text-default-500">今日批改</p>
                    <p className="text-lg font-semibold leading-none">128</p>
                  </CardBody>
                </Card>
                <Card shadow="none" className="border border-default-200">
                  <CardBody className="p-2">
                    <p className="text-[11px] text-default-500">平均分</p>
                    <p className="text-lg font-semibold leading-none">72.4</p>
                  </CardBody>
                </Card>
              </div>
              <Table aria-label="queue table" removeWrapper className="text-xs">
                <TableHeader>
                  <TableColumn>学生</TableColumn>
                  <TableColumn>状态</TableColumn>
                </TableHeader>
                <TableBody>
                  <TableRow key="1">
                    <TableCell>张同学 · 第3题</TableCell>
                    <TableCell>
                      <Chip size="sm" color="warning" variant="flat">
                        待处理
                      </Chip>
                    </TableCell>
                  </TableRow>
                  <TableRow key="2">
                    <TableCell>李同学 · 第3题</TableCell>
                    <TableCell>
                      <Chip size="sm" color="success" variant="flat">
                        完成
                      </Chip>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-2 py-2">
              <p className="text-xs font-semibold">RubricPanel</p>
              <Chip size="sm" color="primary" variant="flat">
                步骤 1/3
              </Chip>
            </CardHeader>
            <CardBody className="space-y-2 pt-0">
              <div className="grid gap-1">
                <div className="flex items-center justify-between rounded-medium border border-default-200 px-2 py-1.5 text-xs">
                  <span>1. 上传评分图片</span>
                  <Chip size="sm" color="success" variant="flat">完成</Chip>
                </div>
                <div className="flex items-center justify-between rounded-medium border border-default-200 px-2 py-1.5 text-xs">
                  <span>2. 基本信息</span>
                  <Chip size="sm" color="warning" variant="flat">进行中</Chip>
                </div>
                <div className="flex items-center justify-between rounded-medium border border-default-200 px-2 py-1.5 text-xs">
                  <span>3. 特殊规则</span>
                  <Chip size="sm" color="danger" variant="flat">未开始</Chip>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input size="sm" label="考试名称" labelPlacement="outside" defaultValue="2026 春季期中" />
                <Input size="sm" label="题号" labelPlacement="outside" defaultValue="第 3 题" />
                <Select
                  className="col-span-2"
                  size="sm"
                  label="评分策略"
                  labelPlacement="outside"
                  defaultSelectedKeys={["point"]}
                >
                  <SelectItem key="point">按点给分</SelectItem>
                  <SelectItem key="step">步骤给分</SelectItem>
                  <SelectItem key="level">分档评分</SelectItem>
                </Select>
                <Textarea
                  className="col-span-2"
                  size="sm"
                  label="规则"
                  labelPlacement="outside"
                  defaultValue={"无标题扣2分\n每3个错别字扣1分"}
                  minRows={3}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-2 py-2">
              <p className="text-xs font-semibold">HistoryView</p>
              <Button size="sm" variant="flat">
                导出
              </Button>
            </CardHeader>
            <CardBody className="space-y-2 pt-0">
              <Input size="sm" label="筛选" labelPlacement="outside" placeholder="考试名 / 题号 / 时间" />
              <Table aria-label="history table" removeWrapper className="text-xs">
                <TableHeader>
                  <TableColumn>考试</TableColumn>
                  <TableColumn>状态</TableColumn>
                </TableHeader>
                <TableBody>
                  <TableRow key="h1">
                    <TableCell>期中测试 · 第3题</TableCell>
                    <TableCell>
                      <Chip size="sm" color="success" variant="flat">已同步</Chip>
                    </TableCell>
                  </TableRow>
                  <TableRow key="h2">
                    <TableCell>单元测验 · 第2题</TableCell>
                    <TableCell>
                      <Chip size="sm" color="warning" variant="flat">待同步</Chip>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-2 py-2">
              <p className="text-xs font-semibold">SettingsView</p>
              <Switch size="sm" defaultSelected>
                深色模式
              </Switch>
            </CardHeader>
            <CardBody className="space-y-2 pt-0">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  size="sm"
                  label="模型平台"
                  labelPlacement="outside"
                  defaultSelectedKeys={["gemini"]}
                >
                  <SelectItem key="gemini">Google Gemini</SelectItem>
                  <SelectItem key="openai">OpenAI</SelectItem>
                  <SelectItem key="glm">智谱 GLM</SelectItem>
                </Select>
                <Select
                  size="sm"
                  label="默认模型"
                  labelPlacement="outside"
                  defaultSelectedKeys={["flash"]}
                >
                  <SelectItem key="flash">Gemini 2.5 Flash</SelectItem>
                  <SelectItem key="gpt4o">GPT-4o</SelectItem>
                </Select>
              </div>
              <Input
                size="sm"
                label="API Key"
                labelPlacement="outside"
                defaultValue="sk-********************************"
              />
            </CardBody>
          </Card>
        </div>
      </main>

      <footer className="fixed bottom-0 z-20 mx-auto flex w-full max-w-[420px] gap-2 border-t border-default-200 bg-background px-3 py-2">
        <Button className="flex-1" variant="bordered">
          返回
        </Button>
        <Button className="flex-1" color="primary">
          保存设置
        </Button>
      </footer>
      <Divider />
    </div>
  );
};

export default HeroUIDefaultThemeDraft;
