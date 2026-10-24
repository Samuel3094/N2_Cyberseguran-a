import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, CircularProgress, FormControlLabel, Grid, List, ListItem,
  ListItemIcon, ListItemText, Typography,
} from '@mui/material';
import OkIcon from '@mui/icons-material/CheckCircle';
import FailIcon from '@mui/icons-material/Cancel';
import Layout from '../components/Layout';
import ExpenseDetails from '../components/ExpenseDetails';
import { api } from '../lib/api';
import { buildSignedDocument } from '../lib/document';
import { fingerprint, sha256Hex, verifyText } from '../lib/webcrypto';
import { dateTimeBR } from '../lib/format';

function CheckList({ title, checks }) {
  if (!checks) return <CircularProgress size={24} />;
  const valid = checks.every((c) => c.ok);
  return (
    <Card className="h-full">
      <CardContent>
        <Typography variant="subtitle1">{title}</Typography>
        <Alert severity={valid ? 'success' : 'error'} className="my-2">
          {valid ? 'ASSINATURA VÁLIDA' : 'ASSINATURA INVÁLIDA OU DOCUMENTO ADULTERADO'}
        </Alert>
        <List dense>
          {checks.map((c) => (
            <ListItem key={c.id}>
              <ListItemIcon>{c.ok ? <OkIcon color="success" /> : <FailIcon color="error" />}</ListItemIcon>
              <ListItemText primary={c.label} />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}

export default function VerifySignature() {
  const router = useRouter();
  const { id } = router.query;
  const [expense, setExpense] = useState(null);
  const [clientChecks, setClientChecks] = useState(null);
  const [serverChecks, setServerChecks] = useState(null);
  const [tamper, setTamper] = useState(false);
  const [error, setError] = useState('');

  // Verificação independente no navegador com a Web Crypto API
  const verifyLocally = useCallback(async (e, simulateTamper) => {
    setClientChecks(null);
    const sig = e.signature;
    const data = simulateTamper ? { ...e, amount: Number(e.amount) + 0.01 } : e; // simula adulteração de R$ 0,01
    const receipt = await api.blob(`/expenses/${e.id}/receipt`);
    const rebuilt = buildSignedDocument(data, sig.signer.id);
    const { publicKey: serverKey } = await api.get('/keys/server');
    const ts = JSON.parse(sig.serverTimestamp.payload);

    setClientChecks([
      { id: 'receipt', label: 'Recibo íntegro (SHA-256 recalculado no navegador)', ok: (await sha256Hex(receipt)) === e.receiptSha256 },
      { id: 'document', label: 'Dados íntegros (hash do documento reconstruído)', ok: (await sha256Hex(rebuilt)) === sig.documentHash },
      { id: 'signature', label: 'Assinatura ECDSA P-256 válida (Web Crypto API)', ok: await verifyText(sig.publicKey, sig.value, rebuilt) },
      { id: 'fingerprint', label: 'Impressão digital da chave pública confere', ok: (await fingerprint(sig.publicKey)) === sig.keyFingerprint },
      {
        id: 'timestamp',
        label: 'Carimbo de tempo do servidor válido',
        ok: (await verifyText(serverKey, sig.serverTimestamp.signature, sig.serverTimestamp.payload)) && ts.documentoSha256 === sig.documentHash,
      },
    ]);
  }, []);

  useEffect(() => {
    if (!router.isReady || !id) return;
    (async () => {
      try {
        const { expense: e } = await api.get(`/expenses/${encodeURIComponent(id)}`);
        if (e.status !== 'ASSINADO') throw new Error('Este documento ainda não foi assinado');
        setExpense(e);
        const [report] = await Promise.all([api.get(`/expenses/${e.id}/verify`), verifyLocally(e, false)]);
        setServerChecks(report.checks);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [router.isReady, id, verifyLocally]);

  const toggleTamper = (ev) => {
    setTamper(ev.target.checked);
    verifyLocally(expense, ev.target.checked).catch((err) => setError(err.message));
  };

  return (
    <Layout title="Verificar assinatura digital" roles={['GERENTE']}>
      {error && (
        <Alert severity="error" className="mb-3">
          {error}
        </Alert>
      )}
      {!expense ? (
        !error && <CircularProgress />
      ) : (
        <Box className="flex flex-col gap-4">
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <CheckList title="Verificação no navegador (Web Crypto API)" checks={clientChecks} />
            </Grid>
            <Grid item xs={12} md={6}>
              <CheckList title="Verificação no servidor (Node.js Crypto)" checks={serverChecks} />
            </Grid>
          </Grid>
          <Card>
            <CardContent>
              <FormControlLabel
                control={<Checkbox checked={tamper} onChange={toggleTamper} />}
                label="Demonstração: simular adulteração do valor em R$ 0,01 (apenas na verificação do navegador)"
              />
              <Typography variant="subtitle1" className="mt-2">
                Dados da assinatura
              </Typography>
              <Typography variant="body2">
                Signatário: <b>{expense.signature.signer?.name}</b> · Algoritmo: {expense.signature.algorithm} · Carimbo de tempo:{' '}
                {dateTimeBR(expense.signature.signedAt)}
              </Typography>
              <Typography variant="caption" color="text.secondary" className="mt-2 block">
                Impressão digital da chave
              </Typography>
              <Typography variant="body2" className="mono">
                {expense.signature.keyFingerprint}
              </Typography>
              <Typography variant="caption" color="text.secondary" className="mt-2 block">
                Assinatura (base64)
              </Typography>
              <Typography variant="body2" className="mono">
                {expense.signature.value}
              </Typography>
              <Button
                className="mt-3"
                variant="outlined"
                onClick={() => {
                  const blob = new Blob([JSON.stringify({ documento: JSON.parse(expense.signature.document), assinatura: expense.signature }, null, 2)], { type: 'application/json' });
                  const a = Object.assign(window.document.createElement('a'), { href: URL.createObjectURL(blob), download: `assinatura-${expense.id}.json` });
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                }}
              >
                Baixar comprovante (.json)
              </Button>
            </CardContent>
          </Card>
          <ExpenseDetails expense={expense} />
        </Box>
      )}
    </Layout>
  );
}
