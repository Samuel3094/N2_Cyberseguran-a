import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button } from '@mui/material';
import Layout from '../components/Layout';
import ExpenseTable from '../components/ExpenseTable';
import { api } from '../lib/api';

export default function SignedExpenses() {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/expenses/signed').then((d) => setList(d.expenses)).catch((e) => setError(e.message));
  }, []);

  return (
    <Layout title="Documentos assinados" roles={['GERENTE']}>
      {error && <Alert severity="error">{error}</Alert>}
      <ExpenseTable
        expenses={list}
        empty="Nenhum documento assinado ainda."
        actions={(e) => (
          <Button size="small" variant="contained" component={Link} href={`/verifySignature?id=${e.id}`}>
            Verificar assinatura
          </Button>
        )}
      />
    </Layout>
  );
}
