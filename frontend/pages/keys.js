import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { generateSigningKey, fingerprint } from '../lib/webcrypto';
import { dateTimeBR } from '../lib/format';

const PASS_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;

export default function Keys() {
  const { refresh } = useAuth();
  const [key, setKey] = useState(undefined);
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/keys/me').then((d) => setKey(d.key)).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const generate = async (e) => {
    e.preventDefault();
    setError('');
    if (!PASS_POLICY.test(pass)) return setError('A frase secreta deve ter 10+ caracteres, com maiúscula, minúscula e número.');
    if (pass !== confirm) return setError('As frases secretas não conferem.');
    if (key && !window.confirm('Gerar uma nova chave revoga a atual. Assinaturas antigas continuam válidas. Continuar?')) return undefined;
    setBusy(true);
    try {
      const generated = await generateSigningKey(pass);
      const fp = await fingerprint(generated.publicKey);
      const res = await api.post('/keys', generated);
      if (res.fingerprint !== fp) throw new Error('Impressão digital divergente entre cliente e servidor');
      setMsg('Par de chaves gerado. Guarde sua frase secreta: sem ela não é possível assinar e ela não pode ser recuperada.');
      setPass('');
      setConfirm('');
      await load();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Layout title="Minha chave de assinatura" roles={['SUPERVISOR', 'GERENTE']}>
      <Box className="flex flex-col gap-4">
        <Alert severity="info">
          O par de chaves <b>ECDSA P-256</b> é gerado no seu navegador pela Web Crypto API. A chave privada é cifrada
          localmente com <b>AES-256-GCM</b> (chave derivada da sua frase secreta por <b>PBKDF2</b>, 310.000 iterações)
          antes de ser enviada. O servidor nunca conhece a frase secreta nem a chave privada em claro — por isso somente
          você consegue assinar (não repúdio).
        </Alert>
        {msg && <Alert severity="success">{msg}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}

        {key && (
          <Card>
            <CardContent>
              <Typography variant="subtitle1">Chave ativa</Typography>
              <Typography variant="caption" color="text.secondary">
                Criada em {dateTimeBR(key.createdAt)} · impressão digital (SHA-256)
              </Typography>
              <Typography className="mono" variant="body2">
                {key.fingerprint}
              </Typography>
              <Typography variant="caption" color="text.secondary" className="mt-2 block">
                Chave pública (SPKI, base64)
              </Typography>
              <Typography className="mono" variant="body2">
                {key.publicKey}
              </Typography>
            </CardContent>
          </Card>
        )}
        {key === null && <Alert severity="warning">Você ainda não possui chave de assinatura.</Alert>}

        <Card>
          <CardContent>
            <Typography variant="subtitle1" className="mb-3">
              {key ? 'Gerar nova chave (revoga a atual)' : 'Gerar par de chaves'}
            </Typography>
            <form onSubmit={generate} className="flex max-w-md flex-col gap-3">
              <TextField label="Frase secreta" type="password" value={pass} onChange={(e) => setPass(e.target.value)} required autoComplete="new-password" />
              <TextField label="Confirme a frase secreta" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
              <Button type="submit" variant="contained" disabled={busy}>
                {busy ? 'Gerando...' : 'Gerar chaves'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Box>
    </Layout>
  );
}
