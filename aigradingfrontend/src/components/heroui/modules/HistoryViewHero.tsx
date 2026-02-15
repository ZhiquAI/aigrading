import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react';
import { Download, Search, Trash2 } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/components/Toast';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const HistoryViewHero: React.FC = () => {
  const { historyRecords, isHistoryLoading, loadHistory, deleteHistoryRecord } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const visibleRecords = useMemo(
    () => historyRecords.filter((item) => !item.isHidden),
    [historyRecords]
  );

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return visibleRecords;

    return visibleRecords.filter((item) => {
      const fields = [
        item.questionNo,
        item.questionKey,
        item.comment,
        ...(item.breakdown?.map((row) => row.label) || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return fields.includes(query);
    });
  }, [searchTerm, visibleRecords]);

  const selectedRecord = useMemo(
    () => filteredRecords.find((item) => item.id === selectedId) || null,
    [filteredRecords, selectedId]
  );

  const handleExportJson = () => {
    if (filteredRecords.length === 0) {
      toast.warning('暂无可导出的历史记录');
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      count: filteredRecords.length,
      records: filteredRecords,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    downloadBlob(blob, `grading-history-${Date.now()}.json`);
    toast.success('JSON 导出成功');
  };

  const handleExportCsv = () => {
    if (filteredRecords.length === 0) {
      toast.warning('暂无可导出的历史记录');
      return;
    }

    const header = ['时间', '题目', '得分', '满分', '评语'];
    const lines = filteredRecords.map((item) => {
      const row = [
        new Date(item.timestamp).toLocaleString('zh-CN', { hour12: false }),
        item.questionNo || item.questionKey || '-',
        item.score,
        item.maxScore,
        (item.comment || '').replace(/"/g, '""'),
      ];
      return `${row[0]},${row[1]},${row[2]},${row[3]},"${row[4]}"`;
    });

    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8',
    });

    downloadBlob(blob, `grading-history-${Date.now()}.csv`);
    toast.success('CSV 导出成功');
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('确认删除这条记录吗？此操作不可恢复。')) {
      return;
    }
    deleteHistoryRecord(id, true);
    if (selectedId === id) setSelectedId(null);
    toast.success('记录已删除');
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-semibold">HistoryView</p>
            <p className="text-xs text-default-500">历史记录检索与导出</p>
          </div>
          <Chip size="sm" variant="flat">
            {filteredRecords.length} 条
          </Chip>
        </CardHeader>
        <CardBody className="space-y-3 pt-0">
          <Input
            size="sm"
            placeholder="搜索题号、题目标识或评语关键词"
            startContent={<Search size={14} className="text-default-500" />}
            value={searchTerm}
            onValueChange={setSearchTerm}
          />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="flat" startContent={<Download size={14} />} onPress={handleExportCsv}>
              导出 CSV
            </Button>
            <Button size="sm" variant="flat" startContent={<Download size={14} />} onPress={handleExportJson}>
              导出 JSON
            </Button>
          </div>

          <Table aria-label="history records" removeWrapper className="text-xs">
            <TableHeader>
              <TableColumn>时间</TableColumn>
              <TableColumn>题目</TableColumn>
              <TableColumn>得分</TableColumn>
              <TableColumn>操作</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent={isHistoryLoading ? '加载中...' : '暂无历史记录'}
            >
              {filteredRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setSelectedId((prev) => (prev === record.id ? null : record.id))}
                      className="text-left text-xs text-default-700 hover:text-primary"
                    >
                      {new Date(record.timestamp).toLocaleString('zh-CN', { hour12: false })}
                    </button>
                  </TableCell>
                  <TableCell>{record.questionNo || record.questionKey || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      color={record.score / Math.max(1, record.maxScore) >= 0.85 ? 'success' : 'warning'}
                      variant="flat"
                    >
                      {record.score}/{record.maxScore}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      isIconOnly
                      aria-label="删除"
                      onPress={() => handleDelete(record.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {selectedRecord && (
        <Card>
          <CardHeader className="py-3">
            <p className="text-sm font-semibold">记录详情</p>
          </CardHeader>
          <CardBody className="space-y-3 pt-0">
            <div>
              <p className="text-xs text-default-500">AI 评语</p>
              <p className="mt-1 text-sm leading-6">{selectedRecord.comment || '暂无评语'}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-default-500">分项得分</p>
              {(selectedRecord.breakdown || []).length === 0 ? (
                <p className="text-sm text-default-500">暂无分项信息</p>
              ) : (
                selectedRecord.breakdown?.map((item, index) => (
                  <div
                    key={`${item.label}-${index}`}
                    className="rounded-medium border border-default-200 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{item.label}</p>
                      <Chip size="sm" variant="flat">
                        {item.score}/{item.max}
                      </Chip>
                    </div>
                    {item.comment ? (
                      <p className="mt-1 text-xs text-default-500">{item.comment}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default HistoryViewHero;
