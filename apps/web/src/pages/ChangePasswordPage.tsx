import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function ChangePasswordPage() {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { user, setUser } = useAuthStore();

    const onFinish = async (values: { currentPassword: string; newPassword: string }) => {
        setLoading(true);
        try {
            await api.put('/auth/change-password', values);
            if (user) {
                setUser({ ...user, firstLogin: false });
            }
            message.success('Senha alterada com sucesso!');
            navigate('/');
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Erro ao alterar senha');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card fade-in">
                <div className="login-logo">
                    <h1>◆ INOVA</h1>
                    <p>{user?.firstLogin ? 'Defina uma nova senha' : 'Alterar Senha'}</p>
                </div>

                <Form name="change-password" onFinish={onFinish} layout="vertical" size="large" requiredMark={false}>
                    <Form.Item
                        name="currentPassword"
                        rules={[{ required: true, message: 'Informe a senha atual' }]}
                    >
                        <Input.Password prefix={<LockOutlined style={{ color: '#6366f1' }} />} placeholder="Senha atual" />
                    </Form.Item>

                    <Form.Item
                        name="newPassword"
                        rules={[
                            { required: true, message: 'Informe a nova senha' },
                            { min: 8, message: 'Mínimo 8 caracteres' },
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined style={{ color: '#6366f1' }} />} placeholder="Nova senha" />
                    </Form.Item>

                    <Form.Item
                        name="confirmPassword"
                        dependencies={['newPassword']}
                        rules={[
                            { required: true, message: 'Confirme a nova senha' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                                    return Promise.reject('As senhas não conferem');
                                },
                            }),
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined style={{ color: '#6366f1' }} />} placeholder="Confirmar nova senha" />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            block
                            style={{ height: 44, fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
                        >
                            ALTERAR SENHA
                        </Button>
                    </Form.Item>
                </Form>
            </div>
        </div>
    );
}
