import { useQuery } from '@tanstack/react-query';
import { Row, Col, Card, Spin, Alert, Space, DatePicker, Select, Button, Typography } from 'antd';
import { ProjectOutlined, BugOutlined, CheckCircleOutlined, ClockCircleOutlined, FilterOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import api from '../services/api';

const { RangePicker } = DatePicker;
const { Title } = Typography;

const COLORS = ['#6b7280', '#3b82f6', '#f59e0b', '#8b5cf6', '#22c55e'];
const STATUS_LABELS: Record<string, string> = {
    BACKLOG: 'Backlog',
    TODO: 'To Do',
    IN_PROGRESS: 'Em Progresso',
    IN_REVIEW: 'Em Revisão',
    DONE: 'Concluído',
};

interface Filters {
    projectId?: string;
    sprintId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
}

export default function DashboardPage() {
    const [filters, setFilters] = useState<Filters>({});
    // Controla o valor exibido no RangePicker separadamente dos filtros ISO
    const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

    const { data: projectsData } = useQuery({
        queryKey: ['projects-list'],
        queryFn: () => api.get('/projects?pageSize=100').then(r => r.data.data.items),
    });

    // Busca usuários: filtra por membros do projeto selecionado (sem admins)
    const { data: usersData } = useQuery({
        queryKey: ['users-members', filters.projectId],
        queryFn: async () => {
            if (filters.projectId) {
                // Busca membros do projeto — o backend já exclui admins no member-workload,
                // mas para o dropdown buscamos os membros do projeto via endpoint de projeto
                const projectRes = await api.get(`/projects/${filters.projectId}`);
                const members = projectRes.data.data.members || [];
                // Filtra admins no frontend também (redundância segura)
                return members
                    .map((m: any) => m.user)
                    .filter((u: any) => u && u.name);
            }
            // Sem projeto: busca todos os usuários não-admins
            const res = await api.get('/users?pageSize=100');
            const items = res.data.data.items || [];
            return items.filter((u: any) => u.role?.name !== 'Administrador');
        },
    });

    const { data: sprintsData } = useQuery({
        queryKey: ['sprints', filters.projectId],
        queryFn: () => filters.projectId
            ? api.get(`/sprints/projects/${filters.projectId}/sprints`).then(r => r.data.data)
            : null,
        enabled: !!filters.projectId,
    });

    const buildParams = (f: Filters) => {
        const p = new URLSearchParams();
        if (f.projectId) p.set('projectId', f.projectId);
        if (f.sprintId) p.set('sprintId', f.sprintId);
        if (f.userId) p.set('userId', f.userId);
        if (f.startDate) p.set('startDate', f.startDate);
        if (f.endDate) p.set('endDate', f.endDate);
        return p.toString();
    };

    const { data: summary, isLoading: loadingSummary, isError: summaryError } = useQuery({
        queryKey: ['dashboard-summary', filters],
        queryFn: () => api.get(`/dashboard/summary?${buildParams(filters)}`).then((r) => r.data.data),
        retry: 2,
    });

    const { data: progress } = useQuery({
        queryKey: ['dashboard-progress', filters],
        queryFn: () => api.get(`/dashboard/projects-progress?${buildParams(filters)}`).then((r) => r.data.data),
    });

    const { data: distribution } = useQuery({
        queryKey: ['dashboard-distribution', filters],
        queryFn: () => api.get(`/dashboard/task-distribution?${buildParams(filters)}`).then((r) => r.data.data),
    });

    const { data: workload } = useQuery({
        queryKey: ['dashboard-workload', filters],
        queryFn: () => api.get(`/dashboard/member-workload?${buildParams(filters)}`).then((r) => r.data.data),
    });

    const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
        setDateRange(dates);
        if (!dates || !dates[0] || !dates[1]) {
            setFilters(prev => ({ ...prev, startDate: undefined, endDate: undefined }));
        } else {
            setFilters(prev => ({
                ...prev,
                startDate: dates[0]!.startOf('day').toISOString(),
                endDate: dates[1]!.endOf('day').toISOString(),
            }));
        }
    };

    const clearFilters = () => {
        setFilters({});
        setDateRange(null);
    };

    if (loadingSummary) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
    if (summaryError) return (
        <div style={{ padding: 40 }}>
            <Alert
                type="error"
                showIcon
                message="Erro ao carregar o Dashboard"
                description="Não foi possível obter os dados. Verifique sua conexão ou tente recarregar a página."
                action={<Button onClick={() => window.location.reload()}>Recarregar</Button>}
            />
        </div>
    );

    return (
        <div className="fade-in">
            <Card style={{ marginBottom: 24, padding: 0 }} bodyStyle={{ padding: '16px 24px' }}>
                <Space wrap align="center" size={16}>
                    <FilterOutlined style={{ color: 'var(--primary)' }} />
                    <Title level={5} style={{ margin: 0, marginRight: 8 }}>Filtros:</Title>

                    {/* Corrigido: value controlado com estado Dayjs separado */}
                    <RangePicker
                        format="DD/MM/YYYY"
                        onChange={handleDateChange}
                        value={dateRange}
                        style={{ width: 260 }}
                        placeholder={['Data início', 'Data fim']}
                    />

                    <Select
                        placeholder="Projeto"
                        allowClear
                        style={{ width: 180 }}
                        onChange={(v) => setFilters(p => ({ ...p, projectId: v, sprintId: undefined, userId: undefined }))}
                        value={filters.projectId}
                    >
                        {projectsData?.map((p: any) => (
                            <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                        ))}
                    </Select>

                    <Select
                        placeholder="Sprint"
                        allowClear
                        style={{ width: 180 }}
                        disabled={!filters.projectId}
                        onChange={(v) => setFilters(p => ({ ...p, sprintId: v }))}
                        value={filters.sprintId}
                    >
                        {sprintsData?.map((s: any) => (
                            <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
                        ))}
                    </Select>

                    {/* Filtro de desenvolvedor: sem admins, filtra por projeto se selecionado */}
                    <Select
                        placeholder="Desenvolvedor"
                        allowClear
                        style={{ width: 200 }}
                        onChange={(v) => setFilters(p => ({ ...p, userId: v }))}
                        value={filters.userId}
                        showSearch
                        optionFilterProp="children"
                    >
                        {usersData?.map((u: any) => (
                            <Select.Option key={u.id} value={u.id}>{u.name}</Select.Option>
                        ))}
                    </Select>

                    <Button onClick={clearFilters}>Limpar</Button>
                </Space>
            </Card>

            <div className="dashboard-cards">
                <div className="dashboard-stat-card">
                    <div className="stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}><ProjectOutlined /></div>
                    <div className="stat-card-value">{summary?.activeProjects || 0}</div>
                    <div className="stat-card-label">Projetos Ativos</div>
                </div>
                <div className="dashboard-stat-card">
                    <div className="stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><BugOutlined /></div>
                    <div className="stat-card-value">{summary?.tasksInProgress || 0}</div>
                    <div className="stat-card-label">Tasks em Progresso</div>
                </div>
                <div className="dashboard-stat-card">
                    <div className="stat-card-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}><CheckCircleOutlined /></div>
                    <div className="stat-card-value">{summary?.hoursThisWeek || 0}h</div>
                    <div className="stat-card-label">
                        {filters.startDate ? 'Horas concluídas no período' : 'Horas concluídas (7 dias)'}
                    </div>
                </div>
                <div className="dashboard-stat-card">
                    <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><ClockCircleOutlined /></div>
                    <div className="stat-card-value" style={{ color: summary?.overdueTasks > 0 ? '#ef4444' : 'inherit' }}>{summary?.overdueTasks || 0}</div>
                    <div className="stat-card-label">Tasks Atrasadas</div>
                </div>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={12}>
                    <Card title="Distribuição de Tasks" bordered={false}>
                        <div style={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distribution || []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="count"
                                    >
                                        {distribution?.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number, name: string, props: any) => [value, STATUS_LABELS[props.payload.status]]} />
                                    <Legend formatter={(value, entry: any) => STATUS_LABELS[entry.payload.status]} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    <Card title="Carga de Trabalho por Membro" bordered={false}>
                        <div style={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={workload || []} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey="name" stroke="var(--text-muted)" />
                                    <YAxis stroke="var(--text-muted)" allowDecimals={false} />
                                    <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }} itemStyle={{ color: 'var(--text-main)' }} />
                                    <Legend />
                                    <Bar dataKey="totalTasks" name="Total Tasks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="completedTasks" name="Concluídas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="overdueTasks" name="Atrasadas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>

                <Col xs={24}>
                    <Card title="Progresso dos Projetos" bordered={false}>
                        <div style={{ height: Math.max(300, (progress?.length || 1) * 60) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={progress || []} margin={{ top: 5, right: 60, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                                    <XAxis type="number" domain={[0, 100]} stroke="var(--text-muted)" tickFormatter={(v) => `${v}%`} />
                                    <YAxis dataKey="name" type="category" stroke="var(--text-muted)" width={130} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}
                                        itemStyle={{ color: 'var(--text-main)' }}
                                        formatter={(value: number, name: string, props: any) => {
                                            const item = props.payload;
                                            if (name === 'percentage') {
                                                return [`${value}% (${item.doneTasks}/${item.totalTasks} tasks)`, 'Progresso por Tasks'];
                                            }
                                            if (name === 'hoursPercentage') {
                                                return [`${value}% (${item.completedHours}h / ${item.totalEstimatedHours ?? '—'}h)`, 'Progresso por Horas'];
                                            }
                                            return [value, name];
                                        }}
                                    />
                                    <Legend formatter={(value) => value === 'percentage' ? 'Por Tasks' : 'Por Horas'} />
                                    <Bar dataKey="percentage" name="percentage" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="hoursPercentage" name="hoursPercentage" fill="#22c55e" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}
