import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardBody, Chip, Progress } from '@heroui/react';
import { ClipboardList, History, LayoutPanelTop, Settings, Sparkles } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { Tab } from '@/types';
import GradingViewHero from './modules/GradingViewHero';
import RubricPanelHeroSimple from './modules/RubricPanelHeroSimple';
import HistoryViewHero from './modules/HistoryViewHero';
import SettingsViewHero from './modules/SettingsViewHero';

const navigationItems = [
  { key: Tab.Rubric, label: '评分细则', icon: ClipboardList },
  { key: Tab.Grading, label: '智能批改', icon: LayoutPanelTop },
  { key: Tab.History, label: '阅卷记录', icon: History },
];

const HeroUIDefaultLayout: React.FC = () => {
  const { activeTab, setActiveTab, tasks, quota, status } = useAppStore();
  const isRubricTab = activeTab === Tab.Rubric;
  const [rubricHeaderTitle, setRubricHeaderTitle] = useState('设置评分细则');

  const activeView = useMemo(() => {
    switch (activeTab) {
      case Tab.Rubric:
        return <RubricPanelHeroSimple />;
      case Tab.Grading:
        return <GradingViewHero />;
      case Tab.History:
        return <HistoryViewHero />;
      case Tab.Settings:
        return <SettingsViewHero />;
      default:
        return <RubricPanelHeroSimple />;
    }
  }, [activeTab]);

  useEffect(() => {
    const handleRubricTitle = (event: Event) => {
      const customEvent = event as CustomEvent<{ title?: string }>;
      if (customEvent.detail?.title) {
        setRubricHeaderTitle(customEvent.detail.title);
      }
    };

    window.addEventListener('heroui:rubric-title', handleRubricTitle as EventListener);
    return () => {
      window.removeEventListener('heroui:rubric-title', handleRubricTitle as EventListener);
    };
  }, []);

  const globalHeaderTitle = useMemo(() => {
    if (activeTab === Tab.Rubric) return rubricHeaderTitle;
    if (activeTab === Tab.Grading) return 'AI 批改';
    if (activeTab === Tab.History) return '批改历史';
    return '系统设置';
  }, [activeTab, rubricHeaderTitle]);
  const showRubricImmersiveHeader = false;

  return (
    <div
      className={`relative flex h-screen w-full flex-col bg-background text-foreground ${
        isRubricTab ? 'mesh-bg-colorful' : ''
      }`}
    >
      {showRubricImmersiveHeader ? (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-white/80 via-white/55 to-transparent px-3 pt-2 pb-4 backdrop-blur-xl">
          <div className="pointer-events-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full border border-white/60 bg-white/55 shadow-sm backdrop-blur-xl">
                <span className="text-[11px] font-black text-primary">AI</span>
              </div>
              <span className="rounded-lg bg-white/35 px-2 py-0.5 text-sm font-bold text-default-700/85 backdrop-blur-md">智能阅卷</span>
            </div>
            <div className="flex items-center gap-1">
              <Chip size="sm" color="warning" variant="flat">
                {quota.isPaid ? 'PRO' : '试用'}
              </Chip>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label="打开设置"
                className="h-8 min-h-8 w-8 min-w-8 rounded-full border border-white/60 bg-white/55 text-default-600 shadow-sm backdrop-blur-xl"
                onPress={() => setActiveTab(Tab.Settings)}
              >
                <Settings size={15} />
              </Button>
            </div>
          </div>
        </header>
      ) : !isRubricTab ? (
        <header className="border-b border-default-200 bg-background px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-sm font-semibold">{globalHeaderTitle}</p>
            </div>
            <div className="flex items-center gap-1">
              <Chip size="sm" color={quota.isPaid ? 'success' : 'warning'} variant="flat">
                {quota.isPaid ? '专业版' : '试用版'}
              </Chip>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label="打开设置"
                className="h-8 min-h-8 w-8 min-w-8 rounded-full border border-default-200 bg-white text-default-600"
                onPress={() => setActiveTab(Tab.Settings)}
              >
                <Settings size={15} />
              </Button>
            </div>
          </div>
        </header>
      ) : null}

      {tasks.length > 0 ? (
        <div className="space-y-2 border-b border-default-200 px-3 py-2">
          {tasks.slice(0, 3).map((task) => (
            <Card key={task.id} shadow="none" className="border border-default-200">
              <CardBody className="gap-2 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium">{task.label}</p>
                  <Chip size="sm" variant="flat" color={task.status === 'error' ? 'danger' : 'primary'}>
                    {Math.round(task.percent)}%
                  </Chip>
                </div>
                <Progress
                  size="sm"
                  value={Math.max(0, Math.min(100, task.percent))}
                  color={task.status === 'error' ? 'danger' : 'primary'}
                />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      <main
        className={`flex-1 ${
          isRubricTab
            ? `overflow-hidden px-0 ${showRubricImmersiveHeader ? 'pt-16' : 'pt-0'} pb-[calc(56px+env(safe-area-inset-bottom,0px)+4px)]`
            : 'overflow-y-auto px-3 pt-3 pb-[calc(56px+env(safe-area-inset-bottom,0px)+8px)]'
        }`}
      >
        {activeView}
      </main>

      <footer
        className={`fixed bottom-0 left-0 right-0 z-20 border-t px-2 py-2 ${
          isRubricTab
            ? 'border-white/50 bg-white/78 backdrop-blur-xl'
            : 'border-default-200 bg-background/95 backdrop-blur'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
      >
        <div className="grid w-full grid-cols-3 gap-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <Button
                key={item.key}
                size="sm"
                color={active ? 'primary' : 'default'}
                variant={active ? 'solid' : 'light'}
                startContent={<Icon size={14} />}
                onPress={() => setActiveTab(item.key)}
                className="font-medium"
              >
                {item.label}
              </Button>
            );
          })}
        </div>
      </footer>

      {status === 'thinking' ? (
        <div className="pointer-events-none fixed bottom-16 left-1/2 z-30 -translate-x-1/2">
          <Chip color="primary" variant="shadow" startContent={<Sparkles size={14} />}>
            AI 正在处理
          </Chip>
        </div>
      ) : null}
    </div>
  );
};

export default HeroUIDefaultLayout;
