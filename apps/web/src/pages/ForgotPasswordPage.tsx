import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Input, Button, message, Result } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import api from '../services/api';

export default function ForgotPasswordPage() {
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const onFinish = async (values: { email: string }) => {
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', values);
            setSent(true);
        } catch {
            message.error('Erro ao enviar solicitação');
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="login-container">
                <div className="login-card fade-in">
                    <Result
                        status="success"
                        title="Email enviado!"
                        subTitle="Se o email estiver cadastrado, você receberá um link de recuperação."
                        extra={
                            <Link to="/login">
                                <Button type="primary">Voltar para Login</Button>
                            </Link>
                        }
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="login-card fade-in">
                <div className="login-logo">
                    <h1>◆ INOVA</h1>
                    <p>Recuperação de Senha</p>
                </div>

                <Form name="forgot" onFinish={onFinish} layout="vertical" size="large" requiredMark={false}>
                    <Form.Item
                        name="email"
                        rules={[
                            { required: true, message: 'Informe seu email' },
                            { type: 'email', message: 'Email inválido' },
                        ]}
                    >
                        <Input prefix={<MailOutlined style={{ color: '#6366f1' }} />} placeholder="Email cadastrado" />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            block
                            style={{ height: 44, fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
                        >
                            ENVIAR LINK
                        </Button>
                    </Form.Item>
                </Form>

                <div style={{ textAlign: 'center' }}>
                    <Link to="/login" style={{ color: '#818cf8', fontSize: 13 }}>← Voltar para Login</Link>
                </div>
            </div>
        </div>
    );
}
