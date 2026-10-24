import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Tab, Tabs } from '@mui/material';
import Layout from '../components/Layout';
import ExpenseTable from '../components/ExpenseTable';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function PendingExpenses() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [tab, setTab] = useState('PENDENTE');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/expenses/pending').then((d) => setList(d.expenses)).catch((e) => setError(e.message));
  }, []);

  const filtered = list.filter((e) => e.status === tab);

  return (
    <Layout title="Documentos pendentes" roles={['SUPERVISOR', 'GERENTE']}>
      {error && <Alert severity="error">{error}</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} className="mb-4">
        <Tab value="PENDENTE" label={`A validar (${list.filter((e) => e.status === 'PENDENTE').length})`} />
        <Tab value="VALIDADO" label={`A assinar (${list.filter((e) => e.status === 'VALIDADO').length})`} />
      </Tabs>
      <ExpenseTable
        expenses={filtered}
        empty="Nenhum documento nesta etapa."
        actions={(e) => {
          if (user && e.employee?.id === user.id) return <em className="text-xs text-slate-500">Própria despesa</em>;
          return e.status === 'PENDENTE' ? (
            <Button size="small" variant="outlined" component={Link} href={`/validateExpense?id=${e.id}`}>
              Validar
            </Button>
          ) : (
            <Button size="small" variant="contained" component={Link} href={`/signExpense?id=${e.id}`}>
              Assinar
            </Button>
          );
        }}
      />
    </Layout>
  );
}
