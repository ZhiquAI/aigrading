import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Progress,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react';
import {
  CheckCheck,
  ClipboardCheck,
  RefreshCw,
  ScanSearch,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { gradeWithProxy } from '@/services/proxyService';
import { Tab, type PageContext, type StudentResult } from '@/types';
import { toast } from '@/components/Toast';

function resolveScoreColor(score: number, maxScore: number): 'success' | 'warning' | 'danger' {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.85) return 'success';
  if (ratio >= 0.6) return 'warning';
  return 'danger';
}

const GradingViewHero: React.FC = () => {
  const {
    isRubricConfigured,
    rubricContent,
    currentQuestionKey,
    gradingMode,
    status,
    setStatus,
    addHistoryRecord,
    setActiveTab,
    syncQuota,
  } = useAppStore();

  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [result, setResult] = useState<StudentResult | null>(null);
  const [currentScore, setCurrentScore] = useState(0);
  const [maxScore, setMaxScore] = useState(10);
  const [isScanning, setIsScanning] = useState(false);

  const scorePercent = useMemo(() => {
    if (maxScore <= 0) return 0;
    return Math.max(0, Math.min(100, (currentScore / maxScore) * 100));
  }, [currentScore, maxScore]);

  const requestPageContext = useCallback(async (): Promise<PageContext | null> => {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return null;
    }

    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (!activeTab?.id) {
          resolve(null);
          return;
        }

        chrome.tabs.sendMessage(
          activeTab.id,
          { type: 'REQUEST_PAGE_DATA' },
          (response?: { success?: boolean; data?: PageContext }) => {
            if (chrome.runtime.lastError || !response?.success || !response.data) {
              resolve(null);
              return;
            }
            resolve(response.data);
          }
        );
      });
    });
  }, []);

  const detectPageContext = useCallback(
    async (showToast = true) => {
      setIsScanning(true);
      try {
        const ctx = await requestPageContext();
        setPageContext(ctx);
        if (showToast) {
          if (ctx?.answerImageBase64) {
            toast.success('答题卡检测完成，可以开始批改');
          } else {
            toast.warning('未检测到答题卡，请检查当前页面');
          }
        }
      } catch (error) {
        if (showToast) {
          toast.error('页面数据检测失败');
        }
      } finally {
        setIsScanning(false);
      }
    },
    [requestPageContext]
  );

  useEffect(() => {
    void detectPageContext(false);
  }, [detectPageContext]);

  const startGrading = useCallback(async () => {
    if (!isRubricConfigured || !rubricContent.trim()) {
      toast.warning('请先在细则模块完成评分细则配置');
      setActiveTab(Tab.Rubric);
      return;
    }

    setStatus('thinking');
    setResult(null);

    try {
      const ctx = (await requestPageContext()) || pageContext;
      if (!ctx?.answerImageBase64) {
        throw new Error('未识别到答题卡图片');
      }

      const gradingResult = await gradeWithProxy(
        ctx.answerImageBase64,
        rubricContent,
        ctx.studentName,
        ctx.questionNo || undefined,
        'pro',
        {
          questionKey: ctx.questionKey || currentQuestionKey || undefined,
          examNo: ctx.examNo || undefined,
        }
      );

      setPageContext(ctx);
      setResult(gradingResult);
      setCurrentScore(gradingResult.score);
      setMaxScore(gradingResult.maxScore || 10);
      setStatus('result');
    } catch (error) {
      const message = error instanceof Error ? error.message : '批改失败，请稍后重试';
      toast.error(message);
      setStatus('error');
    }
  }, [
    currentQuestionKey,
    isRubricConfigured,
    pageContext,
    requestPageContext,
    rubricContent,
    setActiveTab,
    setStatus,
  ]);

  const submitResult = useCallback(async () => {
    if (!result) {
      toast.warning('当前没有可提交的批改结果');
      return;
    }

    addHistoryRecord({
      questionNo: pageContext?.questionNo || '未识别',
      questionKey: pageContext?.questionKey || currentQuestionKey || 'unknown',
      score: currentScore,
      maxScore,
      comment: result.comment,
      breakdown: result.breakdown.map((item) => ({
        label: item.label,
        score: item.score,
        max: item.max,
        comment: item.comment,
      })),
    });

    window.dispatchEvent(new Event('grading_complete'));
    await syncQuota();
    toast.success('评分结果已提交并写入历史记录');
    setStatus('idle');
    setActiveTab(Tab.History);
  }, [
    addHistoryRecord,
    currentQuestionKey,
    currentScore,
    maxScore,
    pageContext,
    result,
    setActiveTab,
    setStatus,
    syncQuota,
  ]);

  const resetResult = useCallback(() => {
    setResult(null);
    setStatus('idle');
  }, [setStatus]);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-semibold">GradingView</p>
            <p className="text-xs text-default-500">默认主题批改工作台</p>
          </div>
          <Chip color={isRubricConfigured ? 'success' : 'warning'} size="sm" variant="flat">
            {isRubricConfigured ? '细则已就绪' : '缺少细则'}
          </Chip>
        </CardHeader>
        <CardBody className="space-y-3 pt-0">
          <div className="grid grid-cols-2 gap-2">
            <Button
              color="primary"
              startContent={<Sparkles size={14} />}
              isDisabled={status === 'thinking' || isScanning}
              onPress={() => {
                void startGrading();
              }}
            >
              开始批改
            </Button>
            <Button
              variant="flat"
              startContent={isScanning ? <Spinner size="sm" /> : <RefreshCw size={14} />}
              isDisabled={status === 'thinking'}
              onPress={() => {
                void detectPageContext();
              }}
            >
              重新检测
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Card shadow="none" className="border border-default-200">
              <CardBody className="gap-1 p-3">
                <p className="text-xs text-default-500">当前题目标识</p>
                <p className="truncate text-sm font-medium">{currentQuestionKey || '未设置'}</p>
              </CardBody>
            </Card>
            <Card shadow="none" className="border border-default-200">
              <CardBody className="gap-1 p-3">
                <p className="text-xs text-default-500">检测状态</p>
                <p className="text-sm font-medium">
                  {pageContext?.answerImageBase64 ? '已检测到答题卡' : isScanning ? '检测中' : '未检测到'}
                </p>
              </CardBody>
            </Card>
          </div>

          <div className="flex items-center justify-between rounded-medium border border-default-200 p-3">
            <div className="min-w-0">
              <p className="text-xs text-default-500">学生</p>
              <p className="truncate text-sm font-medium">
                {pageContext?.studentName || '未识别'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Chip size="sm" variant="flat" color="primary">
                {gradingMode === 'auto' ? '自动模式' : '辅助模式'}
              </Chip>
              <UserRound size={14} className="text-default-500" />
            </div>
          </div>

          {status === 'thinking' && (
            <Card shadow="none" className="border border-default-200 bg-default-50">
              <CardBody className="flex items-center gap-3 py-3">
                <Spinner size="sm" color="primary" />
                <div>
                  <p className="text-sm font-medium">AI 正在批改中</p>
                  <p className="text-xs text-default-500">请稍候，正在分析答卷与评分细则</p>
                </div>
              </CardBody>
            </Card>
          )}

          {result && status === 'result' && (
            <Card shadow="none" className="border border-default-200">
              <CardHeader className="flex items-center justify-between gap-2 py-3">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={16} className="text-default-600" />
                  <p className="text-sm font-semibold">批改结果</p>
                </div>
                <Chip size="sm" color={resolveScoreColor(currentScore, maxScore)} variant="flat">
                  {currentScore}/{maxScore}
                </Chip>
              </CardHeader>
              <CardBody className="space-y-3 pt-0">
                <Progress value={scorePercent} color={resolveScoreColor(currentScore, maxScore)} size="sm" />

                <div className="flex gap-2">
                  <Button size="sm" variant="flat" onPress={() => setCurrentScore((prev) => Math.max(0, prev - 0.5))}>
                    -0.5
                  </Button>
                  <Button size="sm" variant="flat" onPress={() => setCurrentScore((prev) => Math.min(maxScore, prev + 0.5))}>
                    +0.5
                  </Button>
                  <Button size="sm" color="primary" startContent={<CheckCheck size={14} />} onPress={() => void submitResult()}>
                    提交结果
                  </Button>
                  <Button size="sm" variant="light" onPress={resetResult}>
                    取消
                  </Button>
                </div>

                <Divider />

                <div className="space-y-1">
                  <p className="text-xs text-default-500">AI 评语</p>
                  <p className="text-sm leading-6">{result.comment || '暂无评语'}</p>
                </div>

                <Table removeWrapper aria-label="grading breakdown" className="text-xs">
                  <TableHeader>
                    <TableColumn>评分项</TableColumn>
                    <TableColumn>得分</TableColumn>
                    <TableColumn>说明</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {result.breakdown.map((item, index) => (
                      <TableRow key={`${item.label}-${index}`}>
                        <TableCell>{item.label}</TableCell>
                        <TableCell>
                          {item.score}/{item.max}
                        </TableCell>
                        <TableCell>{item.comment || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          )}

          {status === 'error' && (
            <Card shadow="none" className="border border-danger-200 bg-danger-50">
              <CardBody className="py-3">
                <div className="flex items-center gap-2 text-danger-600">
                  <ScanSearch size={16} />
                  <p className="text-sm font-medium">批改失败，请检查网络或答题卡识别状态后重试。</p>
                </div>
              </CardBody>
            </Card>
          )}
        </CardBody>
      </Card>

      {!isRubricConfigured && (
        <Card shadow="none" className="border border-warning-200 bg-warning-50">
          <CardBody className="flex items-center justify-between gap-3 py-3">
            <p className="text-xs text-warning-700">尚未配置评分细则，当前无法进行批改。</p>
            <Button
              size="sm"
              color="warning"
              variant="flat"
              onPress={() => setActiveTab(Tab.Rubric)}
            >
              前往配置
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default GradingViewHero;
