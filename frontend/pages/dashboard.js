import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, CardActions, CardContent, Grid, Typography } from '@mui/material';
import Layout from '../components/Layout';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

function Tile({ title, value, text, href, action }) {
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Card className="h-full">
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            {title}
          </Typography>
          {value !== undefined && (
            <Typography variant="h4" className="font-semibold">
              {value}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {text}
          </Typography>
        </CardContent>
        <CardActions>
          <Button component={Link} href={href}>
            {action}
          </Button>
        </CardActions>
      </Card>
    </Grid>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({});

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const s = {};
      const mine = await api.get('/expenses/mine');
      s.mine = mine.expenses.length;
      s.minePending = mine.expenses.filter((e) => e.status === 'PENDENTE' || e.status === 'VALIDADO').length;
      if (user.role !== 'FUNCIONARIO') {
        const pend = await api.get('/expenses/pending');
        s.toValidate = pend.expenses.filter((e) => e.status === 'PENDENTE').length;
        s.toSign = pend.expenses.filter((e) => e.status === 'VALIDADO').length;
      }
      if (user.role === 'GERENTE') {
        s.signed = (await api.get('/expenses/signed')).expenses.length;
        s.employees = (await api.get('/employees')).employees.length;
      }
      setStats(s);
    };
    load().catch(() => {});
  }, [user]);

  return (
    <Layout title="Painel">
      {user && user.role !== 'FUNCIONARIO' && !user.hasSigningKey && (
        <Alert severity="warning" className="mb-4" action={<Button component={Link} href="/keys">Gerar chave</Button>}>
          Você ainda não possui um par de chaves de assinatura.
        </Alert>
      )}
      <Grid container spacing={3}>
        <Tile title="Nova despesa" text="Envie um relatório de despesa com o recibo." href="/submitExpense" action="Cadastrar" />
        <Tile title="Minhas despesas" value={stats.mine} text={`${stats.minePending ?? 0} em andamento`} href="/myExpenses" action="Ver" />
        {user && user.role !== 'FUNCIONARIO' && (
          <>
            <Tile title="A validar" value={stats.toValidate} text="Despesas aguardando conferência" href="/pendingExpenses" action="Validar" />
            <Tile title="A assinar" value={stats.toSign} text="Despesas validadas aguardando assinatura" href="/pendingExpenses" action="Assinar" />
          </>
        )}
        {user && user.role === 'GERENTE' && (
          <>
            <Tile title="Assinados" value={stats.signed} text="Documentos assinados para verificação" href="/signedExpenses" action="Verificar" />
            <Tile title="Funcionários" value={stats.employees} text="Cadastro de colaboradores" href="/employees" action="Gerenciar" />
          </>
        )}
      </Grid>
    </Layout>
  );
}
