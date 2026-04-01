import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Tag, Select, Input, Space, Spin, Empty, Tooltip, Badge, Button, Modal, message, Avatar } from 'antd';
import { ClockCircleOutlined, CommentOutlined, PaperClipOutlined, CheckCircleOutlined, BugOutlined, FireOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { DndContext, closestCorners, DragEndEvent, DragStartEvent, DragOverlay, useSensor, useSensors, PointerSensor, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
    { value: 'TODO',        label: 'A Fazer' },
    { value: 'IN_PROGRESS', label: 'Em Progresso' },
    { value: 'IN_REVIEW',   label: 'Em Revisão' },
    { value: 'DONE',        label: 'Concluído' },
];

// ─── Droppable column wrapper ─────────────────────────────────────────────────
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
    const { setNodeRef } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '4px 2px',
                overflowY: 'auto',
            }}
        >
            {children}
        </div>
    );
}

// ─── Sortable task card ───────────────────────────────────────────────────────
function SortableTaskCard({ task, onClick }: { task: any; onClick: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { task } });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <Card
                size="small"
                hoverable
                onClick={onClick}
                style={{ cursor: 'pointer', borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}`, borderRadius: 8 }}
                styles={{ body: { padding: '10px 12px' } }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{task.code}</span>
                    {task.project && (
                        <Tag color="purple" style={{ fontSize: 10, margin: 0, padding: '0 5px', lineHeight: '18px' }}>
                            {task.project.name}
                        </Tag>
                    )}
                </div>
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
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MyTasksPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [filterPriority, setFilterPriority] = useState<string | undefined>();
    const [filterProject, setFilterProject] = useState<string | undefined>();
    const [detailTask, setDetailTask] = useState<any>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [commentText, setCommentText] = useState('');

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const { data: tasks, isLoading } = useQuery({
        queryKey: ['my-tasks', user?.id],
        queryFn: () => api.get('/tasks/my-tasks').then(r => r.data.data.items),
        enabled: !!user?.id,
    });

    // Busca detalhes completos da task (com comentários) quando o modal abre
    const { data: taskDetail, isLoading: loadingDetail } = useQuery({
        queryKey: ['task-detail', detailTask?.id],
        queryFn: () => api.get(`/tasks/${detailTask.id}`).then(r => r.data.data),
        enabled: !!detailTask?.id,
    });

    const addComment = useMutation({
        mutationFn: (content: string) => api.post(`/tasks/${detailTask.id}/comments`, { content }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['task-detail', detailTask?.id] });
            setCommentText('');
            message.success('Comentário adicionado!');
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro ao comentar'),
    });

    // Mutation for modal status change
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

    const projectsForFilter = (() => {
        const seen = new Set<string>();
        const result: any[] = [];
        (tasks || []).forEach((t: any) => {
            if (t.project && !seen.has(t.project.id)) {
                seen.add(t.project.id);
                result.push(t.project);
            }
        });
        return result.sort((a: any, b: any) => a.name.localeCompare(b.name));
    })();

    const filtered = (tasks || []).filter((t: any) => {
        const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.code?.toLowerCase().includes(search.toLowerCase());
        const matchPriority = !filterPriority || t.priority === filterPriority;
        const matchProject = !filterProject || t.project?.id === filterProject;
        return matchSearch && matchPriority && matchProject;
    });

    const tasksByStatus = COLUMNS.reduce((acc, col) => {
        acc[col.id] = filtered.filter((t: any) => t.status === col.id);
        return acc;
    }, {} as Record<string, any[]>);

    const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

    // Drag-end handler — uses direct API call to avoid closing modal or showing toast
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;
        const taskId = active.id as string;
        const newStatus = (over.data?.current as any)?.sortable?.containerId || over.id;
        if (typeof newStatus === 'string' && COLUMNS.some(c => c.id === newStatus)) {
            const currentTask = (tasks || []).find((t: any) => t.id === taskId);
            if (currentTask && currentTask.status !== newStatus) {
                api.patch(`/tasks/${taskId}/status`, { status: newStatus })
                    .then(() => queryClient.invalidateQueries({ queryKey: ['my-tasks'] }))
                    .catch(() => message.error('Erro ao mover task'));
            }
        }
    }, [tasks, queryClient]);

    const totalTasks = filtered.length;
    const doneTasks = tasksByStatus['DONE']?.length || 0;
    const overdue = filtered.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE').length;
    const inProgress = tasksByStatus['IN_PROGRESS']?.length || 0;

    const activeTask = (tasks || []).find((t: any) => t.id === activeId);

    if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

    return (
        <div className="fade-in">
            {/* Estatísticas rápidas */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {[
                    { label: 'Total',        value: totalTasks, color: '#6366f1', icon: <BugOutlined />,          bg: 'rgba(99,102,241,0.07)' },
                    { label: 'Em Progresso', value: inProgress, color: '#f59e0b', icon: <FireOutlined />,         bg: 'rgba(245,158,11,0.07)' },
                    { label: 'Concluídas',   value: doneTasks,  color: '#22c55e', icon: <CheckCircleOutlined />,  bg: 'rgba(34,197,94,0.07)'  },
                    { label: 'Atrasadas',    value: overdue,    color: overdue > 0 ? '#ef4444' : 'var(--text-muted)', icon: <ClockCircleOutlined />, bg: 'rgba(239,68,68,0.07)' },
                ].map(s => (
                    <div key={s.label} style={{
                        flex: '1 1 120px', display: 'flex', alignItems: 'center', gap: 10,
                        background: s.bg, borderRadius: 8, padding: '8px 14px',
                    }}>
                        <span style={{ fontSize: 18, color: s.color }}>{s.icon}</span>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.2 }}>{s.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <Card style={{ marginBottom: 20 }} styles={{ body: { padding: '12px 20px' } }}>
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
                    <Select
                        placeholder="Projeto"
                        allowClear
                        showSearch
                        optionFilterProp="children"
                        style={{ width: 220 }}
                        value={filterProject}
                        onChange={setFilterProject}
                    >
                        {projectsForFilter.map((p: any) => (
                            <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                        ))}
                    </Select>
                </Space>
            </Card>

            {/* Quadro Kanban pessoal */}
            {filtered.length === 0 ? (
                <Empty description="Nenhuma task encontrada" style={{ marginTop: 60 }} />
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', overflowX: 'auto', height: 'calc(100vh - 340px)', minHeight: 320 }}>
                        {COLUMNS.map(col => (
                            <div key={col.id} style={{ flex: 1, minWidth: 220, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                                {/* Cabeçalho da coluna */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexGrow: 0,
                                    marginBottom: 12, padding: '6px 12px',
                                    background: col.bg, borderRadius: 8,
                                    borderLeft: `3px solid ${col.color}`,
                                }}>
                                    <span style={{ fontWeight: 600, color: col.color }}>{col.title}</span>
                                    <Badge count={tasksByStatus[col.id]?.length || 0} style={{ background: col.color }} />
                                </div>

                                {/* Cards com scroll independente por coluna */}
                                <SortableContext items={tasksByStatus[col.id].map((t: any) => t.id)} strategy={verticalListSortingStrategy} id={col.id}>
                                    <DroppableColumn id={col.id}>
                                        {tasksByStatus[col.id]?.length === 0 ? (
                                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: 13 }}>
                                                Nenhuma task
                                            </div>
                                        ) : (
                                            tasksByStatus[col.id].map((task: any) => (
                                                <SortableTaskCard key={task.id} task={task} onClick={() => setDetailTask(task)} />
                                            ))
                                        )}
                                    </DroppableColumn>
                                </SortableContext>
                            </div>
                        ))}
                    </div>

                    {/* Card fantasma durante o drag */}
                    <DragOverlay>
                        {activeTask && (
                            <div style={{
                                background: 'var(--bg-elevated)',
                                borderRadius: 8,
                                padding: '10px 12px',
                                boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
                                fontSize: 13,
                                fontWeight: 500,
                                color: 'var(--text-main)',
                                borderLeft: `3px solid ${PRIORITY_COLORS[activeTask.priority]}`,
                                display: 'flex',
                                gap: 8,
                                alignItems: 'center',
                            }}>
                                {activeTask.project && (
                                    <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>{activeTask.project.name}</Tag>
                                )}
                                {activeTask.title}
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            )}

            {/* Modal de detalhes */}
            <Modal
                title={
                    <Space wrap>
                        <Tag color="purple">{detailTask?.code}</Tag>
                        {detailTask?.project && (
                            <Tag color="geekblue">{detailTask.project.name}</Tag>
                        )}
                        <span style={{ fontSize: 15 }}>{detailTask?.title}</span>
                    </Space>
                }
                open={!!detailTask}
                onCancel={() => { setDetailTask(null); setCommentText(''); }}
                footer={null}
                width="min(1100px, 96vw)"
            >
                {detailTask && (
                    loadingDetail ? (
                        <Spin style={{ display: 'block', margin: '40px auto' }} />
                    ) : (
                        <div style={{ display: 'flex', gap: 24 }}>
                            {/* Coluna esquerda: metadados + descrição + ações */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Tags de metadados */}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                                    <Tag color={PRIORITY_COLORS[detailTask.priority]}>{PRIORITY_LABELS[detailTask.priority]}</Tag>
                                    {detailTask.storyPoints && <Tag icon={<FireOutlined />}>{detailTask.storyPoints} pts</Tag>}
                                    {detailTask.estimatedHours && <Tag icon={<ClockCircleOutlined />}>{detailTask.estimatedHours}h estimadas</Tag>}
                                    {detailTask.dueDate && (
                                        <Tag
                                            icon={<ClockCircleOutlined />}
                                            color={new Date(detailTask.dueDate) < new Date() && detailTask.status !== 'DONE' ? 'red' : 'default'}
                                        >
                                            {dayjs(detailTask.dueDate).format('DD/MM/YYYY')}
                                        </Tag>
                                    )}
                                </div>

                                {/* Descrição em Markdown */}
                                {(taskDetail?.description || detailTask.description) ? (
                                    <div style={{ marginBottom: 20 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Descrição:</div>
                                        <div className="md-preview" style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 8 }}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {taskDetail?.description || detailTask.description}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                ) : null}

                                {/* Mover para outra fase */}
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
                            </div>

                            {/* Divisor */}
                            <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />

                            {/* Coluna direita: comentários */}
                            <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                                    <CommentOutlined style={{ marginRight: 6 }} />
                                    Comentários ({taskDetail?.comments?.length || 0})
                                </div>

                                <div style={{ flex: 1, maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {taskDetail?.comments?.length ? (
                                        taskDetail.comments.map((c: any) => (
                                            <div key={c.id} style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 8 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <Space size={6}>
                                                        <Avatar size={18} icon={<UserOutlined />} src={c.user.avatarUrl} style={{ background: 'var(--primary)' }} />
                                                        <strong style={{ fontSize: 12, color: 'var(--text-main)' }}>{c.user.name}</strong>
                                                    </Space>
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dayjs(c.createdAt).format('DD/MM HH:mm')}</span>
                                                </div>
                                                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{c.content}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Nenhum comentário ainda.</p>
                                    )}
                                </div>

                                <Space.Compact style={{ width: '100%' }}>
                                    <Input
                                        value={commentText}
                                        onChange={e => setCommentText(e.target.value)}
                                        placeholder="Adicionar comentário..."
                                        onPressEnter={() => commentText.trim() && addComment.mutate(commentText)}
                                    />
                                    <Button
                                        type="primary"
                                        loading={addComment.isPending}
                                        onClick={() => commentText.trim() && addComment.mutate(commentText)}
                                    >
                                        Enviar
                                    </Button>
                                </Space.Compact>
                            </div>
                        </div>
                    )
                )}
            </Modal>
        </div>
    );
}
