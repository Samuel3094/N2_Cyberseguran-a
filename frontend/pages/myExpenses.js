import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Alert, Button, Dialog, DialogActions, DialogContent } from '@mui/material';
import Layout from '../components/Layout';
import ExpenseTable from '../components/ExpenseTable';
import ExpenseDetails from '../components/ExpenseDetails';
import { api } from '../lib/api';

export default function MyExpenses() {
  const router = useRouter();
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/expenses/mine').then((d) => setList(d.expenses)).catch((e) => setError(e.message));
  }, []);

  return (
    <Layout title="Minhas despesas">
      {router.query.sent && (
        <Alert severity="success" className="mb-3">
          Relatório enviado! Os validadores foram notificados por e-mail.
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      <ExpenseTable
        expenses={list}
        showEmployee={false}
        actions={(e) => (
          <Button size="small" onClick={() => setSelected(e)}>
            Detalhes
          </Button>
        )}
      />
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogContent>{selected && <ExpenseDetails expense={selected} />}</DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
