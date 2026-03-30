import { useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Modal, Form, Input, InputNumber, Select, DatePicker, Tag, Space, message, Spin, Avatar, Tooltip, Badge } from 'antd';
import { PlusOutlined, CommentOutlined, PaperClipOutlined, ClockCircleOutlined, UserOutlined, EditOutlined, DeleteOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import { DndContext, closestCorners, DragEndEvent, DragStartEvent, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dayjs from 'dayjs';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const { confirm } = Modal;

const COLUMNS = [
    { id: 'BACKLOG', title: 'Backlog', color: '#6b7280' },
    { id: 'TODO', title: 'To Do', color: '#3b82f6' },
    { id: 'IN_PROGRESS', title: 'Em Progresso', color: '#f59e0b' },
    { id: 'IN_REVIEW', title: 'Em Revisão', color: '#8b5cf6' },
    { id: 'DONE', title: 'Concluído', color: '#22c55e' },
];

const PRIORITY_COLORS: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' };
const PRIORITY_LABELS: Record<string, string> = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' };

function KanbanCard({ task, onClick }: { task: any; onClick: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { task } });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="kanban-card" onClick={onClick}>
            <div className="kanban-card-title">{task.title}</div>
            <div className="kanban-card-meta">
                <Tag color={PRIORITY_COLORS[task.priority]} style={{ fontSize: 11, margin: 0 }}>{PRIORITY_LABELS[task.priority]}</Tag>
                <Space size={8}>
                    {task.storyPoints && <Tooltip title="Story Points"><Badge count={task.storyPoints} style={{ background: '#6366f1' }} /></Tooltip>}
                    {task.estimatedHours && <Tooltip title="Horas estimadas"><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏱ {task.estimatedHours}h</span></Tooltip>}
                    {task._count?.comments > 0 && <Tooltip title="Comentários"><span style={{ fontSize: 12 }}><CommentOutlined /> {task._count.comments}</span></Tooltip>}
                    {task._count?.attachments > 0 && <Tooltip title="Anexos"><span style={{ fontSize: 12 }}><PaperClipOutlined /> {task._count.attachments}</span></Tooltip>}
                </Space>
            </div>
            {task.dueDate && (
                <div style={{ fontSize: 11, color: new Date(task.dueDate) < new Date() ? '#ef4444' : '#9090b0', marginTop: 6 }}>
                    <ClockCircleOutlined /> {dayjs(task.dueDate).format('DD/MM')}
                </div>
            )}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                {task.assignees?.map((a: any) => (
                    <Tooltip key={a.user.id} title={a.user.name}>
                        <Avatar size={24} src={a.user.avatarUrl} icon={<UserOutlined />} style={{ background: '#6366f1' }} />
                    </Tooltip>
                ))}
            </div>
        </div>
    );
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
    const { setNodeRef } = useDroppable({ id });
    return <div ref={setNodeRef} className="kanban-column-body">{children}</div>;
}

function TaskFormFields({ projectUsers, sprints, showSprintField }: { projectUsers: any[]; sprints?: any[]; showSprintField?: boolean }) {
    return (
        <>
            <Form.Item name="title" label="Título" rules={[{ required: true, message: 'Informe o título' }]}>
                <Input />
            </Form.Item>
            <Form.Item name="description" label="Descrição" extra="Suporta Markdown: **negrito**, *itálico*, `código`, listas, etc.">
                <Input.TextArea rows={5} placeholder="Descreva a task em Markdown..." />
            </Form.Item>
            <Space style={{ width: '100%' }} size={16}>
                <Form.Item name="priority" label="Prioridade" initialValue="MEDIUM" style={{ flex: 1 }}>
                    <Select>
                        <Select.Option value="LOW">Baixa</Select.Option>
                        <Select.Option value="MEDIUM">Média</Select.Option>
                        <Select.Option value="HIGH">Alta</Select.Option>
                        <Select.Option value="CRITICAL">Crítica</Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item name="storyPoints" label="Story Points" style={{ flex: 1 }}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
                <Form.Item name="estimatedHours" label="Horas Estimadas" style={{ flex: 1 }}>
                    <InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={1} placeholder="Ex: 8" />
                </Form.Item>
            </Space>
            {showSprintField && (
                <Form.Item name="sprintId" label="Sprint">
                    <Select placeholder="Selecione uma sprint (opcional)" allowClear>
                        {sprints?.map((s: any) => (
                            <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
            )}
            <Form.Item name="assigneeIds" label="Responsáveis">
                <Select mode="multiple" placeholder="Selecione">
                    {projectUsers?.map((m: any) => (
                        <Select.Option key={m.user.id} value={m.user.id}>{m.user.name}</Select.Option>
                    ))}
                </Select>
            </Form.Item>
            <Form.Item name="dueDate" label="Data Limite">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
        </>
    );
}

export default function KanbanPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams] = useSearchParams();
    const sprintId = searchParams.get('sprint');
    const queryClient = useQueryClient();
    const { hasPermission } = useAuthStore();

    const canEdit = hasPermission('tasks', 'update');
    const canDelete = hasPermission('tasks', 'delete');

    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [createForm] = Form.useForm();
    const [editForm] = Form.useForm();
    const [commentText, setCommentText] = useState('');

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const { data: tasks, isLoading } = useQuery({
        queryKey: ['tasks', projectId, sprintId],
        queryFn: () => {
            const params = new URLSearchParams();
            if (sprintId) params.set('sprintId', sprintId);
            return api.get(`/tasks/projects/${projectId}/tasks?${params}`).then((r) => r.data.data.items);
        },
    });

    const { data: sprints } = useQuery({
        queryKey: ['sprints', projectId],
        queryFn: () => api.get(`/sprints/projects/${projectId}/sprints`).then((r) => r.data.data),
    });

    const { data: projectUsers } = useQuery({
        queryKey: ['project-members', projectId],
        queryFn: () => api.get(`/projects/${projectId}/members`).then((r) => r.data.data),
    });

    const { data: taskDetail, isLoading: isLoadingDetail } = useQuery({
        queryKey: ['task-detail', selectedTask?.id],
        queryFn: () => api.get(`/tasks/${selectedTask.id}`).then((r) => r.data.data),
        enabled: !!selectedTask,
    });

    const moveTask = useMutation({
        mutationFn: ({ taskId, status, position }: { taskId: string; status: string; position: number }) =>
            api.patch(`/tasks/${taskId}/status`, { status }).then(() =>
                api.patch(`/tasks/${taskId}/position`, { position, status })
            ),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    });

    const createTask = useMutation({
        mutationFn: (values: any) => api.post(`/tasks/projects/${projectId}/tasks`, {
            ...values,
            sprintId: sprintId || values.sprintId,
            dueDate: values.dueDate?.toISOString(),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            message.success('Task criada!');
            setCreateModalOpen(false);
            createForm.resetFields();
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro ao criar task'),
    });

    const updateTask = useMutation({
        mutationFn: ({ taskId, values }: { taskId: string; values: any }) =>
            api.put(`/tasks/${taskId}`, {
                ...values,
                dueDate: values.dueDate ? values.dueDate.toISOString() : null,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['task-detail', selectedTask?.id] });
            message.success('Task atualizada!');
            setEditModalOpen(false);
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro ao atualizar task'),
    });

    const deleteTask = useMutation({
        mutationFn: (taskId: string) => api.delete(`/tasks/${taskId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            message.success('Task excluída!');
            setDetailModalOpen(false);
            setSelectedTask(null);
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro ao excluir task'),
    });

    const addComment = useMutation({
        mutationFn: (content: string) => api.post(`/tasks/${selectedTask.id}/comments`, { content }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['task-detail'] });
            setCommentText('');
            message.success('Comentário adicionado!');
        },
    });

    const openEditModal = () => {
        if (!taskDetail) return;
        editForm.setFieldsValue({
            title: taskDetail.title,
            description: taskDetail.description,
            priority: taskDetail.priority,
            storyPoints: taskDetail.storyPoints,
            estimatedHours: taskDetail.estimatedHours,
            status: taskDetail.status,
            sprintId: taskDetail.sprints?.[0]?.sprint?.id ?? null,
            assigneeIds: taskDetail.assignees?.map((a: any) => a.user.id) ?? [],
            dueDate: taskDetail.dueDate ? dayjs(taskDetail.dueDate) : undefined,
        });
        setEditModalOpen(true);
    };

    const showDeleteConfirm = () => {
        confirm({
            title: 'Excluir esta task?',
            icon: <ExclamationCircleFilled />,
            content: `"${taskDetail?.title}" será excluída permanentemente.`,
            okText: 'Excluir',
            okType: 'danger',
            cancelText: 'Cancelar',
            onOk() {
                deleteTask.mutate(selectedTask.id);
            },
        });
    };

    const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;
        const taskId = active.id as string;
        const newStatus = (over.data?.current as any)?.sortable?.containerId || over.id;
        if (typeof newStatus === 'string' && COLUMNS.some((c) => c.id === newStatus)) {
            const currentTask = tasks?.find((t: any) => t.id === taskId);
            if (currentTask && currentTask.status !== newStatus) {
                moveTask.mutate({ taskId, status: newStatus, position: 0 });
            }
        }
    }, [tasks, moveTask]);

    const getColumnTasks = (status: string) => tasks?.filter((t: any) => t.status === status) || [];

    if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

    const activeTask = tasks?.find((t: any) => t.id === activeId);

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    {sprintId && sprints && (
                        <Tag color="blue" style={{ fontSize: 13, padding: '2px 10px' }}>
                            {sprints.find((s: any) => s.id === sprintId)?.name}
                        </Tag>
                    )}
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); if (sprintId) createForm.setFieldValue('sprintId', sprintId); setCreateModalOpen(true); }}>
                    Nova Task
                </Button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="kanban-board">
                    {COLUMNS.map((col) => {
                        const columnTasks = getColumnTasks(col.id);
                        return (
                            <div key={col.id} className="kanban-column">
                                <div className="kanban-column-header">
                                    <h4 style={{ color: col.color }}>{col.title}</h4>
                                    <span className="kanban-column-count">{columnTasks.length}</span>
                                </div>
                                <SortableContext items={columnTasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy} id={col.id}>
                                    <DroppableColumn id={col.id}>
                                        {columnTasks.map((task: any) => (
                                            <KanbanCard
                                                key={task.id}
                                                task={task}
                                                onClick={() => { setSelectedTask(task); setDetailModalOpen(true); }}
                                            />
                                        ))}
                                    </DroppableColumn>
                                </SortableContext>
                            </div>
                        );
                    })}
                </div>
                <DragOverlay>
                    {activeTask && (
                        <div className="kanban-card" style={{ boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)' }}>
                            <div className="kanban-card-title">{activeTask.title}</div>
                        </div>
                    )}
                </DragOverlay>
            </DndContext>

            {/* Create Task Modal */}
            <Modal
                title="Nova Task"
                open={createModalOpen}
                onCancel={() => setCreateModalOpen(false)}
                onOk={() => createForm.submit()}
                okText="Criar"
                cancelText="Cancelar"
                width={600}
                confirmLoading={createTask.isPending}
            >
                <Form form={createForm} layout="vertical" onFinish={(v) => createTask.mutate(v)}>
                    <TaskFormFields
                        projectUsers={projectUsers ?? []}
                        sprints={sprints ?? []}
                        showSprintField={true}
                    />
                </Form>
            </Modal>

            {/* Edit Task Modal */}
            <Modal
                title="Editar Task"
                open={editModalOpen}
                onCancel={() => setEditModalOpen(false)}
                onOk={() => editForm.submit()}
                okText="Salvar"
                cancelText="Cancelar"
                width={600}
                confirmLoading={updateTask.isPending}
            >
                <Form
                    form={editForm}
                    layout="vertical"
                    onFinish={(v) => updateTask.mutate({ taskId: selectedTask?.id, values: v })}
                >
                    <TaskFormFields projectUsers={projectUsers ?? []} sprints={sprints ?? []} showSprintField={true} />
                    <Form.Item name="status" label="Status">
                        <Select>
                            {COLUMNS.map((c) => (
                                <Select.Option key={c.id} value={c.id}>{c.title}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Task Detail Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 40 }}>
                        <span style={{ fontWeight: 600 }}>{taskDetail?.title || selectedTask?.title}</span>
                        {taskDetail && (
                            <Space size={8}>
                                {canEdit && (
                                    <Button size="small" icon={<EditOutlined />} onClick={openEditModal}>
                                        Editar
                                    </Button>
                                )}
                                {canDelete && (
                                    <Button size="small" danger icon={<DeleteOutlined />} onClick={showDeleteConfirm} loading={deleteTask.isPending}>
                                        Excluir
                                    </Button>
                                )}
                            </Space>
                        )}
                    </div>
                }
                open={detailModalOpen}
                onCancel={() => { setDetailModalOpen(false); setSelectedTask(null); }}
                footer={null}
                width={720}
            >
                {isLoadingDetail ? (
                    <Spin style={{ display: 'block', margin: '40px auto' }} />
                ) : taskDetail ? (
                    <div>
                        {/* Tags de status e prioridade */}
                        <Space style={{ marginBottom: 16 }} wrap>
                            <Tag color={PRIORITY_COLORS[taskDetail.priority]}>{PRIORITY_LABELS[taskDetail.priority]}</Tag>
                            <Tag color="geekblue">
                                {COLUMNS.find((c) => c.id === taskDetail.status)?.title || taskDetail.status}
                            </Tag>
                            {taskDetail.storyPoints != null && <Tag>{taskDetail.storyPoints} pts</Tag>}
                            {taskDetail.dueDate && (
                                <Tag color={new Date(taskDetail.dueDate) < new Date() ? 'red' : 'default'}>
                                    <ClockCircleOutlined /> {dayjs(taskDetail.dueDate).format('DD/MM/YYYY')}
                                </Tag>
                            )}
                        </Space>

                        {/* Responsáveis */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 13 }}>Responsáveis:</strong>
                            {taskDetail.assignees?.length > 0
                                ? taskDetail.assignees.map((a: any) => (
                                    <Tag key={a.user.id} icon={<UserOutlined />}>{a.user.name}</Tag>
                                ))
                                : <span style={{ color: '#9090b0', fontSize: 13 }}>Nenhum</span>
                            }
                        </div>

                        {/* Descrição em Markdown */}
                        {taskDetail.description ? (
                            <div style={{ marginBottom: 20 }}>
                                <strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Descrição:</strong>
                                <div className="md-preview" style={{ background: 'var(--bg-elevated)', padding: '12px 16px', borderRadius: 8, minHeight: 60 }}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {taskDetail.description}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ) : (
                            <p style={{ color: '#9090b0', fontSize: 13, marginBottom: 20 }}>Sem descrição.</p>
                        )}

                        {/* Comentários */}
                        <h4 style={{ marginTop: 20, marginBottom: 12 }}>
                            Comentários ({taskDetail.comments?.length || 0})
                        </h4>
                        <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
                            {taskDetail.comments?.map((c: any) => (
                                <div key={c.id} style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <Space>
                                            <Avatar size={20} icon={<UserOutlined />} style={{ background: 'var(--primary)' }} />
                                            <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>{c.user.name}</strong>
                                        </Space>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dayjs(c.createdAt).format('DD/MM HH:mm')}</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{c.content}</p>
                                </div>
                            ))}
                            {!taskDetail.comments?.length && (
                                <p style={{ color: '#9090b0', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Nenhum comentário ainda.</p>
                            )}
                        </div>
                        <Space.Compact style={{ width: '100%' }}>
                            <Input
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Adicionar comentário..."
                                onPressEnter={() => commentText && addComment.mutate(commentText)}
                            />
                            <Button type="primary" onClick={() => commentText && addComment.mutate(commentText)} loading={addComment.isPending}>
                                Enviar
                            </Button>
                        </Space.Compact>

                        {/* Registros de Tempo */}
                        {taskDetail.timeEntries?.length > 0 && (
                            <>
                                <h4 style={{ marginTop: 24, marginBottom: 8 }}>Registros de Tempo</h4>
                                {taskDetail.timeEntries.map((te: any) => (
                                    <div key={te.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)', color: 'var(--text-main)' }}>
                                        <span>{te.user.name} — {te.description || 'Sem descrição'}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>{te.durationMin}min • {dayjs(te.date).format('DD/MM')}</span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                ) : null}
            </Modal>
        </div>
    );
}
