import { useState } from 'react';
import { useRouter } from 'next/router';
import { Alert, Button, Card, CardContent, Grid, InputAdornment, MenuItem, TextField, Typography } from '@mui/material';
import UploadIcon from '@mui/icons-material/UploadFile';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { sha256Hex } from '../lib/webcrypto';
import { CATEGORIES } from '../lib/format';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ['application/pdf', 'image/png', 'image/jpeg'];
const today = () => new Date().toISOString().slice(0, 10);

export default function SubmitExpense() {
  const router = useRouter();
  const [form, setForm] = useState({ description: '', category: 'TRANSPORTE', amount: '', expenseDate: today() });
  const [file, setFile] = useState(null);
  const [hash, setHash] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const pickFile = async (e) => {
    const f = e.target.files[0];
    setError('');
    setHash('');
    if (!f) return setFile(null);
    if (!ACCEPT.includes(f.type)) return setError('Formato não permitido. Envie PDF, PNG ou JPG.');
    if (f.size > MAX_BYTES) return setError('O recibo deve ter no máximo 5 MB.');
    setFile(f);
    // Hash calculado no navegador: o usuário pode conferir com o registrado pelo servidor
    setHash(await sha256Hex(await f.arrayBuffer()));
    return undefined;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Anexe o recibo.');
    setSending(true);
    setError('');
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, v));
      data.append('receipt', file);
      const { expense } = await api.post('/expenses', data);
      if (expense.receiptSha256 !== hash) throw new Error('O hash registrado pelo servidor difere do arquivo enviado!');
      router.push('/myExpenses?sent=1');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
    return undefined;
  };

  return (
    <Layout title="Cadastro de relatório de despesa">
      <Card>
        <CardContent>
          {error && (
            <Alert severity="error" className="mb-4">
              {error}
            </Alert>
          )}
          <form onSubmit={submit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Descrição"
                  value={form.description}
                  onChange={set('description')}
                  required
                  fullWidth
                  multiline
                  minRows={2}
                  inputProps={{ minLength: 5, maxLength: 500 }}
                  helperText="Ex.: Táxi aeroporto → cliente ACME (visita técnica)"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField select label="Categoria" value={form.category} onChange={set('category')} fullWidth>
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <MenuItem key={k} value={k}>
                      {v}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Valor"
                  type="number"
                  value={form.amount}
                  onChange={set('amount')}
                  required
                  fullWidth
                  inputProps={{ min: 0.01, max: 50000, step: 0.01 }}
                  InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Data da despesa"
                  type="date"
                  value={form.expenseDate}
                  onChange={set('expenseDate')}
                  required
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ max: today() }}
                  helperText="Até 90 dias atrás"
                />
              </Grid>
              <Grid item xs={12}>
                <Button component="label" variant="outlined" startIcon={<UploadIcon />}>
                  {file ? file.name : 'Anexar recibo (PDF, PNG ou JPG até 5 MB)'}
                  <input hidden type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={pickFile} />
                </Button>
                {hash && (
                  <Typography variant="body2" className="mono mt-2">
                    SHA-256: {hash}
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12}>
                <Alert severity="info">
                  Após o envio, o relatório fica <b>Pendente</b> até ser validado por um Supervisor/Gerente e, em seguida,
                  assinado digitalmente. Despesas acima de R$ 5.000,00 exigem assinatura do Gerente.
                </Alert>
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained" disabled={sending}>
                  {sending ? 'Enviando...' : 'Enviar relatório'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Layout>
  );
}
