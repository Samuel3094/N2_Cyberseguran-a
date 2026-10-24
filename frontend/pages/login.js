import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace('/dashboard');
  }, [ready, user, router]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    // No plano gratuito a API "dorme" após inatividade e leva até ~1 min para acordar
    const timer = setTimeout(() => setSlow(true), 4000);
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Não foi possível conectar à API. Tente novamente em instantes.' : err.message);
    } finally {
      clearTimeout(timer);
      setSlow(false);
      setLoading(false);
      setPassword('');
    }
  };

  return (
    <Box className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 to-teal-700 p-4">
      <Head>
        <title>Login | Assinatura Digital</title>
      </Head>
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <Box className="mb-6 flex flex-col items-center">
            <LockIcon color="primary" fontSize="large" />
            <Typography variant="h5" className="mt-2 font-semibold">
              Assinatura Digital
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Relatórios de despesas com assinatura ECDSA
            </Typography>
          </Box>
          {error && (
            <Alert severity="error" className="mb-4">
              {error}
            </Alert>
          )}
          {slow && (
            <Alert severity="info" className="mb-4">
              Iniciando o servidor (hospedagem gratuita). O primeiro acesso pode levar até 1 minuto...
            </Alert>
          )}
          <form onSubmit={submit} className="flex flex-col gap-4" autoComplete="on">
            <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus inputProps={{ maxLength: 160 }} />
            <TextField
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              inputProps={{ maxLength: 128 }}
            />
            <Button type="submit" variant="contained" size="large" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <Typography variant="caption" color="text.secondary" className="mt-4 block text-center">
            Senhas armazenadas com bcrypt · Sessão JWT · Bloqueio após 5 tentativas
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
