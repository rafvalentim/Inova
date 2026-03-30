import { useQuery } from '@tanstack/react-query';
import { Table, Tag, DatePicker, Select, Space, Input } from 'antd';
import { useState } from 'react';
import dayjs from 'dayjs';
import api from '../services/api';

const actionColors: Record<string, string> = {
    CREATE: 'green', UPDATE: 'blue', DELETE: 'red', UPDATE_STATUS: 'orange',
    LOGIN_SUCCESS: 'cyan', LOGIN_FAILED: 'red', LOGOUT: 'default',
    ADD_MEMBER: 'purple', REMOVE_MEMBER: 'magenta', CARRY_OVER: 'gold',
    CHANGE_PASSWORD: 'geekblue',
};

export default function AuditLogPage() {
    const [filters, setFilters] = useState<any>({});

    const { data, isLoading } = useQuery({
        queryKey: ['audit-logs', filters],
        queryFn: () => {
            const params = new URLSearchParams();
            if (filters.action) params.set('action', filters.action);
            if (filters.resource) params.set('resource', filters.resource);
            if (filters.startDate) params.set('startDate', filters.startDate);
            if (filters.endDate) params.set('endDate', filters.endDate);
            params.set('pageSize', '100');
            return api.get(`/audit-logs?${params}`).then((r) => r.data.data);
        },
    });

    const columns = [
        {
            title: 'Data/Hora', key: 'date', width: 150,
            render: (_: any, r: any) => dayjs(r.createdAt).format('DD/MM/YYYY HH:mm:ss'),
        },
        { title: 'Usuário', key: 'user', render: (_: any, r: any) => r.user.name },
        {
            title: 'Ação', key: 'action',
            render: (_: any, r: any) => <Tag color={actionColors[r.action] || 'default'}>{r.action}</Tag>,
        },
        { title: 'Recurso', dataIndex: 'resource', key: 'resource' },
        { title: 'ID Recurso', dataIndex: 'resourceId', key: 'resourceId', ellipsis: true },
        { title: 'IP', dataIndex: 'ipAddress', key: 'ip' },
    ];

    return (
        <div className="fade-in">
            <div className="page-header"><h2>Audit Log</h2></div>

            <Space style={{ marginBottom: 16 }} wrap>
                <Select
                    placeholder="Filtrar por ação"
                    allowClear
                    style={{ width: 180 }}
                    onChange={(v) => setFilters((f: any) => ({ ...f, action: v }))}
                >
                    {['CREATE', 'UPDATE', 'DELETE', 'UPDATE_STATUS', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT'].map((a) => (
                        <Select.Option key={a} value={a}>{a}</Select.Option>
                    ))}
                </Select>
                <Select
                    placeholder="Filtrar por recurso"
                    allowClear
                    style={{ width: 180 }}
                    onChange={(v) => setFilters((f: any) => ({ ...f, resource: v }))}
                >
                    {['auth', 'users', 'roles', 'projects', 'sprints', 'tasks', 'comments'].map((r) => (
                        <Select.Option key={r} value={r}>{r}</Select.Option>
                    ))}
                </Select>
                <DatePicker.RangePicker
                    format="DD/MM/YYYY"
                    onChange={(dates) => {
                        setFilters((f: any) => ({
                            ...f,
                            startDate: dates?.[0]?.toISOString(),
                            endDate: dates?.[1]?.toISOString(),
                        }));
                    }}
                />
            </Space>

            <Table
                columns={columns}
                dataSource={data?.items || []}
                loading={isLoading}
                rowKey="id"
                pagination={{ pageSize: 20 }}
                size="small"
                expandable={{
                    expandedRowRender: (record: any) => (
                        <div style={{ display: 'flex', gap: 24 }}>
                            {record.oldValue && (
                                <div style={{ flex: 1 }}>
                                    <strong>Valor Anterior:</strong>
                                    <pre style={{ fontSize: 11, background: '#252538', padding: 8, borderRadius: 4, overflow: 'auto', maxHeight: 200 }}>
                                        {JSON.stringify(record.oldValue, null, 2)}
                                    </pre>
                                </div>
                            )}
                            {record.newValue && (
                                <div style={{ flex: 1 }}>
                                    <strong>Novo Valor:</strong>
                                    <pre style={{ fontSize: 11, background: '#252538', padding: 8, borderRadius: 4, overflow: 'auto', maxHeight: 200 }}>
                                        {JSON.stringify(record.newValue, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ),
                }}
            />
        </div>
    );
}
