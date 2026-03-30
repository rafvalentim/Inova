import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Tag, Avatar, Select, Input, Space, Spin, Empty, Tooltip, Badge, Button, Modal, Form, DatePicker, message, Row, Col, Statistic } from 'antd';
import { ClockCircleOutlined, CommentOutlined, PaperClipOutlined, UserOutlined, CheckCircleOutlined, BugOutlined, FireOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

dayjs.locale('pt-br');

const COLUMNS = [
    { id: 'TODO',        title: 'A Fazer',      color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
    { id: 'IN_PROGRESS', title: 'Em Progresso', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
    { id: 'IN_REVIEW',   title: 'Em Revisão',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
    { id: 'DONE',        title: 'Concluído',    color: '#22c55e', bg: 'rgba(34,197,94,0.08)'  },
];

const PRIORITY_COLORS: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' };
const PRIORITY_LABELS: Record<string, string> = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' };
const STATUS_OPTIONS = [
    { value: 'TODO', label: 'A Fazer' },
    { value: 'IN_PROGRESS', label: 'Em Progresso' },
    { value: 'IN_REVIEW', label: 'Em Revisão' },
    { value: 'DONE', label: 'Concluído' },
];

export default function MyTasksPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [filterPriority, setFilterPriority] = useState<string | undefined>();
    const [detailTask, setDetailTask] = useState<any>(null);
    const [statusForm] = Form.useForm();

    const { data: tasks, isLoading } = useQuery({
        queryKey: ['my-tasks', user?.id],
        queryFn: () => api.get('/tasks/my-tasks').then(r => r.data.data.items),
        enabled: !!user?.id,
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            api.patch(`/tasks/${id}/status`, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
            message.success('Status atualizado!');
            setDetailTask(null);
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro ao atualizar'),
    });

    const filtered = (tasks || []).filter((t: any) => {
        const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.code?.toLowerCase().includes(search.toLowerCase());
        const matchPriority = !filterPriority || t.priority === filterPriority;
        return matchSearch && matchPriority;
    });

    const tasksByStatus = COLUMNS.reduce((acc, col) => {
        acc[col.id] = filtered.filter((t: any) => t.status === col.id);
        return acc;
    }, {} as Record<string, any[]>);

    const totalTasks = filtered.length;
    const doneTasks = tasksByStatus['DONE']?.length || 0;
    const overdue = filtered.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE').length;
    const inProgress = tasksByStatus['IN_PROGRESS']?.length || 0;

    if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: 16 }}>
                <div>
                    <h2 style={{ margin: 0 }}>Minhas Tasks</h2>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Olá, {user?.name}! Veja todas as suas tarefas abaixo.</span>
                </div>
            </div>

            {/* Estatísticas rápidas */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card bordered={false} style={{ background: 'rgba(99,102,241,0.07)' }}>
                        <Statistic title="Total" value={totalTasks} prefix={<BugOutlined />} valueStyle={{ color: '#6366f1' }} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card bordered={false} style={{ background: 'rgba(245,158,11,0.07)' }}>
                        <Statistic title="Em Progresso" value={inProgress} prefix={<FireOutlined />} valueStyle={{ color: '#f59e0b' }} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card bordered={false} style={{ background: 'rgba(34,197,94,0.07)' }}>
                        <Statistic title="Concluídas" value={doneTasks} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#22c55e' }} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card bordered={false} style={{ background: 'rgba(239,68,68,0.07)' }}>
                        <Statistic title="Atrasadas" value={overdue} prefix={<ClockCircleOutlined />} valueStyle={{ color: overdue > 0 ? '#ef4444' : 'inherit' }} />
                    </Card>
                </Col>
            </Row>

            {/* Filtros */}
            <Card style={{ marginBottom: 20 }} bodyStyle={{ padding: '12px 20px' }}>
                <Space wrap>
                    <Input
                        prefix={<SearchOutlined />}
                        placeholder="Buscar por título ou código..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: 260 }}
                        allowClear
                    />
                    <Select
                        placeholder="Prioridade"
                        allowClear
                        style={{ width: 150 }}
                        value={filterPriority}
                        onChange={setFilterPriority}
                    >
                        {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                            <Select.Option key={k} value={k}>{v}</Select.Option>
                        ))}
                    </Select>
                </Space>
            </Card>

            {/* Quadro Kanban pessoal */}
            {filtered.length === 0 ? (
                <Empty description="Nenhuma task encontrada" style={{ marginTop: 60 }} />
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                    {COLUMNS.map(col => (
                        <div key={col.id}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                marginBottom: 12, padding: '6px 12px',
                                background: col.bg, borderRadius: 8,
                                borderLeft: `3px solid ${col.color}`,
                            }}>
                                <span style={{ fontWeight: 600, color: col.color }}>{col.title}</span>
                                <Badge count={tasksByStatus[col.id]?.length || 0} style={{ background: col.color }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {tasksByStatus[col.id]?.length === 0 && (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: 13 }}>
                                        Nenhuma task
                                    </div>
                                )}
                                {tasksByStatus[col.id]?.map((task: any) => (
                                    <TaskCard key={task.id} task={task} onClick={() => setDetailTask(task)} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de detalhes / mudança de status */}
            <Modal
                title={
                    <Space>
                        <Tag color="purple">{detailTask?.code}</Tag>
                        <span style={{ fontSize: 15 }}>{detailTask?.title}</span>
                    </Space>
                }
                open={!!detailTask}
                onCancel={() => setDetailTask(null)}
                footer={null}
                width={520}
            >
                {detailTask && (
                    <div>
                        <Space direction="vertical" style={{ width: '100%' }} size={12}>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <Tag color={PRIORITY_COLORS[detailTask.priority]}>{PRIORITY_LABELS[detailTask.priority]}</Tag>
                                {detailTask.storyPoints && <Tag icon={<FireOutlined />}>{detailTask.storyPoints} pts</Tag>}
                                {detailTask.dueDate && (
                                    <Tag icon={<ClockCircleOutlined />} color={new Date(detailTask.dueDate) < new Date() && detailTask.status !== 'DONE' ? 'red' : 'default'}>
                                        {dayjs(detailTask.dueDate).format('DD/MM/YYYY')}
                                    </Tag>
                                )}
                            </div>

                            {detailTask.description && (
                                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>
                                    {detailTask.description}
                                </div>
                            )}

                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Mover para:</div>
                                <Space wrap>
                                    {STATUS_OPTIONS.filter(s => s.value !== detailTask.status).map(s => (
                                        <Button
                                            key={s.value}
                                            size="small"
                                            type="primary"
                                            ghost
                                            loading={updateStatusMutation.isPending}
                                            onClick={() => updateStatusMutation.mutate({ id: detailTask.id, status: s.value })}
                                        >
                                            {s.label}
                                        </Button>
                                    ))}
                                </Space>
                            </div>
                        </Space>
                    </div>
                )}
            </Modal>
        </div>
    );
}

function TaskCard({ task, onClick }: { task: any; onClick: () => void }) {
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

    return (
        <Card
            size="small"
            hoverable
            onClick={onClick}
            style={{
                cursor: 'pointer',
                borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}`,
                borderRadius: 8,
            }}
            bodyStyle={{ padding: '10px 12px' }}
        >
            {task.code && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{task.code}</div>
            )}
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8, color: 'var(--text-main)' }}>
                {task.title}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size={6}>
                    <Tag color={PRIORITY_COLORS[task.priority]} style={{ fontSize: 11, margin: 0 }}>
                        {PRIORITY_LABELS[task.priority]}
                    </Tag>
                    {task.storyPoints && (
                        <Tooltip title="Story Points">
                            <Badge count={task.storyPoints} style={{ background: '#6366f1' }} />
                        </Tooltip>
                    )}
                </Space>
                <Space size={8}>
                    {task._count?.comments > 0 && (
                        <Tooltip title={`${task._count.comments} comentário(s)`}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                <CommentOutlined /> {task._count.comments}
                            </span>
                        </Tooltip>
                    )}
                    {task._count?.attachments > 0 && (
                        <Tooltip title={`${task._count.attachments} anexo(s)`}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                <PaperClipOutlined /> {task._count.attachments}
                            </span>
                        </Tooltip>
                    )}
                </Space>
            </div>
            {task.dueDate && (
                <div style={{ fontSize: 11, marginTop: 8, color: isOverdue ? '#ef4444' : 'var(--text-muted)' }}>
                    <ClockCircleOutlined /> Prazo: {dayjs(task.dueDate).format('DD/MM/YYYY')}
                    {isOverdue && <span style={{ marginLeft: 4, fontWeight: 600 }}>— ATRASADA</span>}
                </div>
            )}
        </Card>
    );
}
