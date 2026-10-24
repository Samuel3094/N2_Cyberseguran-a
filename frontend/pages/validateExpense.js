import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Alert, Box, Button, Card, CardContent, CircularProgress, TextField, Typography } from '@mui/material';
import Layout from '../components/Layout';
import ExpenseDetails from '../components/ExpenseDetails';
import { api } from '../lib/api';
import { sha256Hex } from '../lib/webcrypto';

export default function ValidateExpense() {
  const router = useRouter();
  const { id } = router.query;
  const [expense, setExpense] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!router.isReady || !id) return;
    (async () => {
      try {
        const { expense: e } = await api.get(`/expenses/${encodeURIComponent(id)}`);
        setExpense(e);
        // Confere se o arquivo armazenado não foi alterado desde o envio
        const buf = await api.blob(`/expenses/${e.id}/receipt`);
        setIntegrity((await sha256Hex(buf)) === e.receiptSha256);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [router.isReady, id]);

  const decide = async (decision) => {
    setBusy(true);
    setError('');
    try {
      const { expense: e } = await api.post(`/expenses/${expense.id}/validate`, { decision, notes });
      setExpense(e);
      if (decision === 'APROVAR') router.push(`/signExpense?id=${e.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Validar documento" roles={['SUPERVISOR', 'GERENTE']}>
      {error && (
        <Alert severity="error" className="mb-3">
          {error}
        </Alert>
      )}
      {!expense ? (
        !error && <CircularProgress />
      ) : (
        <Box className="flex flex-col gap-4">
          {integrity !== null && (
            <Alert severity={integrity ? 'success' : 'error'}>
              {integrity
                ? 'Integridade do recibo confirmada: o SHA-256 calculado no navegador confere com o registrado no envio.'
                : 'ALERTA: o recibo foi alterado após o envio (hash divergente). Rejeite o documento.'}
            </Alert>
          )}
          <ExpenseDetails expense={expense} />
          {expense.status === 'PENDENTE' ? (
            <Card>
              <CardContent className="flex flex-col gap-3">
                <Typography variant="subtitle1">Parecer</Typography>
                <Typography variant="body2" color="text.secondary">
                  Confira valor, data, categoria e se o recibo corresponde à descrição. Para rejeitar, informe o motivo.
                </Typography>
                <TextField
                  label="Observações / motivo da rejeição"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  multiline
                  minRows={2}
                  inputProps={{ maxLength: 500 }}
                />
                <Box className="flex gap-2">
                  <Button variant="contained" color="success" disabled={busy || integrity === false} onClick={() => decide('APROVAR')}>
                    Aprovar e seguir para assinatura
                  </Button>
                  <Button variant="outlined" color="error" disabled={busy} onClick={() => decide('REJEITAR')}>
                    Rejeitar
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Alert severity="info">Este documento já foi processado (status: {expense.status}).</Alert>
          )}
        </Box>
      )}
    </Layout>
  );
}
