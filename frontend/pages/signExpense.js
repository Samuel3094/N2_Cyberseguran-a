import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, CircularProgress, FormControlLabel, TextField, Typography,
} from '@mui/material';
import DrawIcon from '@mui/icons-material/Draw';
import Layout from '../components/Layout';
import ExpenseDetails from '../components/ExpenseDetails';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { buildSignedDocument } from '../lib/document';
import { sha256Hex, signText, unlockPrivateKey, verifyText } from '../lib/webcrypto';
import { brl, MANAGER_ONLY_ABOVE } from '../lib/format';

export default function SignExpense() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [expense, setExpense] = useState(null);
  const [key, setKey] = useState(undefined);
  const [receiptOk, setReceiptOk] = useState(null);
  const [docHash, setDocHash] = useState('');
  const [pass, setPass] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!router.isReady || !id) return;
    (async () => {
      try {
        const [{ expense: e }, { key: k }] = await Promise.all([api.get(`/expenses/${encodeURIComponent(id)}`), api.get('/keys/me')]);
        setExpense(e);
        setKey(k);
        const buf = await api.blob(`/expenses/${e.id}/receipt`);
        setReceiptOk((await sha256Hex(buf)) === e.receiptSha256);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [router.isReady, id]);

  // Documento canônico montado NO NAVEGADOR: o signatário vê exatamente o que assina
  const document = useMemo(
    () => (expense && user && expense.validation ? buildSignedDocument(expense, user.id) : ''),
    [expense, user]
  );
  useEffect(() => {
    if (document) sha256Hex(document).then(setDocHash);
  }, [document]);

  const overLimit = expense && expense.amount > MANAGER_ONLY_ABOVE && user?.role !== 'GERENTE';

  const sign = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const privateKey = await unlockPrivateKey(key.encryptedPrivateKey, pass);
      const signature = await signText(privateKey, document);
      // Autoverificação antes de enviar
      if (!(await verifyText(key.publicKey, signature, document))) throw new Error('Falha na autoverificação da assinatura');
      const { expense: signed } = await api.post(`/expenses/${expense.id}/sign`, { signature, keyFingerprint: key.fingerprint });
      setExpense(signed);
    } catch (err) {
      setError(err.message);
    } finally {
      setPass('');
      setBusy(false);
    }
  };

  const renderSignForm = () => {
    if (expense.status === 'ASSINADO') {
      return (
        <Alert severity="success">
          Documento assinado digitalmente por {expense.signature.signer?.name}. Hash do documento:{' '}
          <span className="mono">{expense.signature.documentHash}</span>
        </Alert>
      );
    }
    if (expense.status !== 'VALIDADO') return <Alert severity="warning">O documento precisa estar validado para ser assinado (status atual: {expense.status}).</Alert>;
    if (expense.employee?.id === user?.id) return <Alert severity="error">Você não pode assinar sua própria despesa (segregação de funções).</Alert>;
    if (overLimit) return <Alert severity="error">Despesas acima de {brl(MANAGER_ONLY_ABOVE)} exigem assinatura do Gerente (alçada).</Alert>;
    if (key === null) {
      return (
        <Alert severity="warning" action={<Button component={Link} href="/keys">Gerar chave</Button>}>
          Você precisa gerar seu par de chaves antes de assinar.
        </Alert>
      );
    }
    return (
      <Card>
        <CardContent>
          <form onSubmit={sign} className="flex flex-col gap-3">
            <FormControlLabel
              control={<Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} />}
              label="Declaro que conferi o documento acima e concordo em assiná-lo eletronicamente, nos termos da MP 2.200-2/2001 e da Lei 14.063/2020."
            />
            <TextField
              label="Frase secreta da sua chave"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
              autoComplete="off"
              className="max-w-md"
            />
            <Box>
              <Button type="submit" variant="contained" startIcon={<DrawIcon />} disabled={busy || !agree || !receiptOk || !key}>
                {busy ? 'Assinando...' : 'Assinar digitalmente'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    );
  };

  return (
    <Layout title="Assinatura digital" roles={['SUPERVISOR', 'GERENTE']}>
      {error && (
        <Alert severity="error" className="mb-3">
          {error}
        </Alert>
      )}
      {!expense ? (
        !error && <CircularProgress />
      ) : (
        <Box className="flex flex-col gap-4">
          {receiptOk === false && <Alert severity="error">O recibo foi alterado após o envio. Assinatura bloqueada.</Alert>}
          <ExpenseDetails expense={expense} showReceipt={false} />
          {document && expense.status === 'VALIDADO' && (
            <Card>
              <CardContent>
                <Typography variant="subtitle1">Documento que será assinado</Typography>
                <Typography variant="caption" color="text.secondary">
                  ECDSA P-256 / SHA-256 · SHA-256 do documento: <span className="mono">{docHash}</span>
                </Typography>
                <pre className="mono mt-2 max-h-72 overflow-auto rounded bg-slate-900 p-3 text-xs text-green-300">
                  {JSON.stringify(JSON.parse(document), null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
          {renderSignForm()}
        </Box>
      )}
    </Layout>
  );
}
