/**
 * API 平台管理面板组件
 * 支持多平台配置、切换、对比测试
 */

import React, { useState, useEffect } from 'react';
import {
    Card,
    Table,
    Button,
    Input,
    Switch,
    Modal,
    message,
    Tag,
    Statistic,
    Row,
    Col,
    Tabs,
    Progress,
    Alert,
    Space,
    Tooltip
} from 'antd';
import {
    ThunderboltOutlined,
    DollarOutlined,
    SafetyOutlined,
    TrophyOutlined,
    SyncOutlined,
    DownloadOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined
} from '@ant-design/icons';
import {
    PlatformName,
    getAllPlatforms,
    savePlatformConfig,
    getActivePlatform,
    setActivePlatform,
    PLATFORM_CONFIGS,
    getPlatformCostComparison,
    estimateMonthlyCost,
    StoredPlatformConfig
} from '../services/api-platform-manager';
import {
    benchmarkGrading,
    generateComparisonReport,
    exportReportAsMarkdown,
    quickCompare,
    BenchmarkResult,
    ComparisonReport
} from '../services/api-benchmark';

const { TabPane } = Tabs;
const { Password } = Input;

export const ApiPlatformManager: React.FC = () => {
    const [platforms, setPlatforms] = useState(getAllPlatforms());
    const [activePlatform, setActivePlatformState] = useState(getActivePlatform());
    const [benchmarking, setBenchmarking] = useState(false);
    const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
    const [comparisonReport, setComparisonReport] = useState<ComparisonReport | null>(null);
    const [configModalVisible, setConfigModalVisible] = useState(false);
    const [editingPlatform, setEditingPlatform] = useState<PlatformName | null>(null);

    useEffect(() => {
        // 监听平台切换事件
        const handlePlatformChange = () => {
            setActivePlatformState(getActivePlatform());
            setPlatforms(getAllPlatforms());
        };

        window.addEventListener('platform_changed', handlePlatformChange);
        return () => window.removeEventListener('platform_changed', handlePlatformChange);
    }, []);

    // 切换平台
    const handleSwitchPlatform = (name: PlatformName) => {
        const config = platforms[name];
        if (!config.enabled || !config.apiKey) {
            message.warning('请先配置该平台的 API Key');
            return;
        }

        setActivePlatform(name);
        setActivePlatformState(name);
        message.success(`已切换到 ${config.displayName}`);
    };

    // 启用/禁用平台
    const handleTogglePlatform = (name: PlatformName, enabled: boolean) => {
        savePlatformConfig(name, { enabled });
        setPlatforms(getAllPlatforms());
        message.success(enabled ? '已启用' : '已禁用');
    };

    // 配置 API Key
    const handleConfigApiKey = (name: PlatformName) => {
        setEditingPlatform(name);
        setConfigModalVisible(true);
    };

    const handleSaveApiKey = (apiKey: string) => {
        if (!editingPlatform) return;

        savePlatformConfig(editingPlatform, {
            apiKey,
            enabled: true,
        });

        setPlatforms(getAllPlatforms());
        setConfigModalVisible(false);
        setEditingPlatform(null);
        message.success('配置保存成功');
    };

    // 快速对比测试
    const handleQuickCompare = async () => {
        setBenchmarking(true);
        try {
            const { results, fastest } = await quickCompare();
            setBenchmarkResults(results);
            message.success(`测试完成!最快平台: ${PLATFORM_CONFIGS[fastest].displayName}`);
        } catch (error) {
            message.error('测试失败: ' + (error as Error).message);
        } finally {
            setBenchmarking(false);
        }
    };

    // 完整评分对比测试
    const handleFullBenchmark = async (imageBase64: string, rubricText: string) => {
        setBenchmarking(true);
        try {
            const results = await benchmarkGrading(imageBase64, rubricText, 'pro');
            setBenchmarkResults(results);

            const report = generateComparisonReport(results);
            setComparisonReport(report);

            message.success('对比测试完成!');
        } catch (error) {
            message.error('测试失败: ' + (error as Error).message);
        } finally {
            setBenchmarking(false);
        }
    };

    // 导出报告
    const handleExportReport = () => {
        if (!comparisonReport) {
            message.warning('请先运行对比测试');
            return;
        }

        const markdown = exportReportAsMarkdown(comparisonReport);
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `api-comparison-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);

        message.success('报告已导出');
    };

    // 平台列表表格列
    const columns = [
        {
            title: '平台',
            dataIndex: 'displayName',
            key: 'displayName',
            render: (text: string, record: any) => (
                <Space>
                    {record.name === activePlatform && <Tag color="green">当前</Tag>}
                    <strong>{text}</strong>
                </Space>
            ),
        },
        {
            title: '状态',
            key: 'status',
            render: (_: any, record: StoredPlatformConfig & { name: PlatformName }) => (
                <Space>
                    {record.enabled && record.apiKey ? (
                        <Tag icon={<CheckCircleOutlined />} color="success">已配置</Tag>
                    ) : (
                        <Tag icon={<CloseCircleOutlined />} color="default">未配置</Tag>
                    )}
                </Space>
            ),
        },
        {
            title: 'Gemini 2.5 Flash 价格',
            key: 'price',
            render: (_: any, record: any) => (
                <span>¥{record.pricing['gemini-2.5-flash'].toFixed(2)}/百万tokens</span>
            ),
        },
        {
            title: '可靠性',
            key: 'reliability',
            render: (_: any, record: any) => (
                <Progress
                    percent={Math.round(record.performance.reliability * 100)}
                    size="small"
                    status="active"
                />
            ),
        },
        {
            title: '平均延迟',
            key: 'latency',
            render: (_: any, record: any) => (
                <span>{record.performance.avgLatency}ms</span>
            ),
        },
        {
            title: '操作',
            key: 'actions',
            render: (_: any, record: StoredPlatformConfig & { name: PlatformName }) => (
                <Space>
                    {record.name !== activePlatform && (
                        <Button
                            size="small"
                            type="primary"
                            onClick={() => handleSwitchPlatform(record.name)}
                            disabled={!record.enabled || !record.apiKey}
                        >
                            切换
                        </Button>
                    )}
                    <Button
                        size="small"
                        onClick={() => handleConfigApiKey(record.name)}
                    >
                        配置
                    </Button>
                    <Switch
                        size="small"
                        checked={record.enabled}
                        onChange={(checked) => handleTogglePlatform(record.name, checked)}
                    />
                </Space>
            ),
        },
    ];

    // 成本对比数据
    const costComparison = getPlatformCostComparison('gemini-2.5-flash');
    const estimations = Object.keys(PLATFORM_CONFIGS).map(name =>
        estimateMonthlyCost(name as PlatformName, 'gemini-2.5-flash', 200, 2500)
    );

    return (
        <div style={{ padding: '20px' }}>
            <Card title="API 平台管理" extra={
                <Space>
                    <Button
                        icon={<SyncOutlined />}
                        onClick={handleQuickCompare}
                        loading={benchmarking}
                    >
                        快速测试
                    </Button>
                    {comparisonReport && (
                        <Button
                            icon={<DownloadOutlined />}
                            onClick={handleExportReport}
                        >
                            导出报告
                        </Button>
                    )}
                </Space>
            }>

                {/* 当前激活平台摘要 */}
                <Alert
                    message={`当前使用: ${platforms[activePlatform].displayName}`}
                    description={`Gemini 2.5 Flash 价格: ¥${platforms[activePlatform].pricing['gemini-2.5-flash']}/百万tokens`}
                    type="info"
                    showIcon
                    style={{ marginBottom: 20 }}
                />

                <Tabs defaultActiveKey="platforms">
                    {/* 平台列表 */}
                    <TabPane tab="平台列表" key="platforms">
                        <Table
                            dataSource={Object.entries(platforms).map(([name, config]) => ({
                                ...config,
                                name,
                                key: name,
                            }))}
                            columns={columns}
                            pagination={false}
                        />
                    </TabPane>

                    {/* 成本对比 */}
                    <TabPane tab="成本对比" key="cost">
                        <Row gutter={16} style={{ marginBottom: 20 }}>
                            <Col span={6}>
                                <Card>
                                    <Statistic
                                        title="最便宜平台"
                                        value={costComparison[0]?.name}
                                        prefix={<DollarOutlined />}
                                        suffix={`¥${costComparison[0]?.cost}/M`}
                                    />
                                </Card>
                            </Col>
                            <Col span={6}>
                                <Card>
                                    <Statistic
                                        title="最快平台"
                                        value="老张AI"
                                        prefix={<ThunderboltOutlined />}
                                        suffix="1500ms"
                                    />
                                </Card>
                            </Col>
                            <Col span={6}>
                                <Card>
                                    <Statistic
                                        title="最可靠平台"
                                        value="老张AI / DMXAPI"
                                        prefix={<SafetyOutlined />}
                                        suffix="99%"
                                    />
                                </Card>
                            </Col>
                            <Col span={6}>
                                <Card>
                                    <Statistic
                                        title="综合推荐"
                                        value="老张AI"
                                        prefix={<TrophyOutlined />}
                                    />
                                </Card>
                            </Col>
                        </Row>

                        <Card title="月度成本预估 (假设每天评200份,每份2500 tokens)">
                            <Table
                                dataSource={estimations}
                                columns={[
                                    {
                                        title: '平台',
                                        dataIndex: 'platform',
                                        key: 'platform',
                                    },
                                    {
                                        title: '月度成本',
                                        dataIndex: 'costPerMonth',
                                        key: 'costPerMonth',
                                        render: (cost: string) => `¥${cost}`,
                                        sorter: (a, b) => parseFloat(a.costPerMonth) - parseFloat(b.costPerMonth),
                                    },
                                    {
                                        title: '年度成本',
                                        dataIndex: 'costPerYear',
                                        key: 'costPerYear',
                                        render: (cost: string) => `¥${cost}`,
                                    },
                                    {
                                        title: 'vs 最贵',
                                        key: 'savings',
                                        render: (_: any, record: any) => {
                                            const max = Math.max(...estimations.map(e => parseFloat(e.costPerMonth)));
                                            const savings = max - parseFloat(record.costPerMonth);
                                            return savings > 0 ? (
                                                <Tag color="green">省¥{savings.toFixed(2)}/月</Tag>
                                            ) : (
                                                <Tag>-</Tag>
                                            );
                                        },
                                    },
                                ]}
                                pagination={false}
                            />
                        </Card>
                    </TabPane>

                    {/* 测试结果 */}
                    <TabPane tab="测试结果" key="benchmark">
                        {benchmarkResults.length > 0 ? (
                            <>
                                <Table
                                    dataSource={benchmarkResults}
                                    columns={[
                                        {
                                            title: '平台',
                                            key: 'platform',
                                            render: (record: BenchmarkResult) => PLATFORM_CONFIGS[record.platform].displayName,
                                        },
                                        {
                                            title: '状态',
                                            key: 'status',
                                            render: (record: BenchmarkResult) =>
                                                record.success ?
                                                    <Tag color="success">成功</Tag> :
                                                    <Tag color="error">失败</Tag>,
                                        },
                                        {
                                            title: '延迟',
                                            dataIndex: 'latency',
                                            key: 'latency',
                                            render: (latency: number) => `${latency}ms`,
                                            sorter: (a, b) => a.latency - b.latency,
                                        },
                                        {
                                            title: '成本',
                                            dataIndex: 'cost',
                                            key: 'cost',
                                            render: (cost?: number) => cost ? `¥${cost.toFixed(4)}` : '-',
                                            sorter: (a, b) => (a.cost || 0) - (b.cost || 0),
                                        },
                                        {
                                            title: '评分',
                                            key: 'score',
                                            render: (record: BenchmarkResult) =>
                                                record.result ?
                                                    `${record.result.score}/${record.result.maxScore}` :
                                                    '-',
                                        },
                                        {
                                            title: '错误',
                                            dataIndex: 'error',
                                            key: 'error',
                                            render: (error?: string) => error ? (
                                                <Tooltip title={error}>
                                                    <Tag color="error">查看</Tag>
                                                </Tooltip>
                                            ) : '-',
                                        },
                                    ]}
                                    pagination={false}
                                />

                                {comparisonReport && (
                                    <Card title="综合评估" style={{ marginTop: 20 }}>
                                        <Row gutter={16}>
                                            <Col span={6}>
                                                <Statistic
                                                    title="最快"
                                                    value={PLATFORM_CONFIGS[comparisonReport.summary.fastest].displayName}
                                                    prefix={<ThunderboltOutlined />}
                                                />
                                            </Col>
                                            <Col span={6}>
                                                <Statistic
                                                    title="最便宜"
                                                    value={PLATFORM_CONFIGS[comparisonReport.summary.cheapest].displayName}
                                                    prefix={<DollarOutlined />}
                                                />
                                            </Col>
                                            <Col span={6}>
                                                <Statistic
                                                    title="最可靠"
                                                    value={PLATFORM_CONFIGS[comparisonReport.summary.mostReliable].displayName}
                                                    prefix={<SafetyOutlined />}
                                                />
                                            </Col>
                                            <Col span={6}>
                                                <Statistic
                                                    title="综合推荐"
                                                    value={PLATFORM_CONFIGS[comparisonReport.summary.recommended].displayName}
                                                    prefix={<TrophyOutlined />}
                                                    valueStyle={{ color: '#3f8600' }}
                                                />
                                            </Col>
                                        </Row>
                                    </Card>
                                )}
                            </>
                        ) : (
                            <Alert
                                message="暂无测试数据"
                                description="点击右上角'快速测试'按钮开始测试所有已配置的平台"
                                type="info"
                                showIcon
                            />
                        )}
                    </TabPane>
                </Tabs>
            </Card>

            {/* API Key 配置弹窗 */}
            <Modal
                title={`配置 ${editingPlatform ? PLATFORM_CONFIGS[editingPlatform].displayName : ''}`}
                open={configModalVisible}
                onOk={() => {
                    const input = document.getElementById('apikey-input') as HTMLInputElement;
                    if (input && input.value) {
                        handleSaveApiKey(input.value);
                    }
                }}
                onCancel={() => {
                    setConfigModalVisible(false);
                    setEditingPlatform(null);
                }}
            >
                <div style={{ marginBottom: 10 }}>
                    <strong>API Key:</strong>
                </div>
                <Password
                    id="apikey-input"
                    placeholder="请输入 API Key"
                    defaultValue={editingPlatform ? platforms[editingPlatform].apiKey : ''}
                />
                <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
                    <p>API Key 将被加密存储在本地浏览器中</p>
                    {editingPlatform && (
                        <p>
                            获取 API Key: <a href={PLATFORM_CONFIGS[editingPlatform].baseUrl} target="_blank" rel="noopener noreferrer">
                                {PLATFORM_CONFIGS[editingPlatform].displayName}
                            </a>
                        </p>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default ApiPlatformManager;
