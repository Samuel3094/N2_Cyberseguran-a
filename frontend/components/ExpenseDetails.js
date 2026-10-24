import { useEffect, useState } from 'react';
import { Box, Card, CardContent, CircularProgress, Divider, Grid, Typography } from '@mui/material';
import StatusChip from './StatusChip';
import { api } from '../lib/api';
import { brl, CATEGORIES, dateBR, dateTimeBR } from '../lib/format';

function Field({ label, children }) {
  return (
    <Grid item xs={12} sm={6}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1">{children}</Typography>
    </Grid>
  );
}

/** Pré-visualização do recibo (baixado com o token, pois a rota é protegida). */
export function ReceiptPreview({ expense }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let objectUrl;
    api
      .blob(`/expenses/${expense.id}/receipt`)
      .then((buf) => {
        objectUrl = URL.createObjectURL(new Blob([buf], { type: expense.receiptMime }));
        setUrl(objectUrl);
      })
      .catch(() => setUrl(''));
    return () => objectUrl && URL.revokeObjectURL(objectUrl);
  }, [expense.id, expense.receiptMime]);

  if (url === null) return <CircularProgress size={24} />;
  if (!url) return <Typography color="error">Não foi possível carregar o recibo.</Typography>;
  return expense.receiptMime === 'application/pdf' ? (
    <object data={url} type="application/pdf" className="h-96 w-full rounded border">
      <a href={url} download={expense.receiptName}>
        Baixar recibo
      </a>
    </object>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Recibo" className="max-h-96 rounded border" />
  );
}

export default function ExpenseDetails({ expense, showReceipt = true }) {
  return (
    <Card>
      <CardContent>
        <Box className="mb-3 flex items-center justify-between">
          <Typography variant="h6">{expense.description}</Typography>
          <StatusChip status={expense.status} />
        </Box>
        <Grid container spacing={2}>
          <Field label="Funcionário">{expense.employee?.name}</Field>
          <Field label="Departamento">{expense.employee?.department || '-'}</Field>
          <Field label="Categoria">{CATEGORIES[expense.category]}</Field>
          <Field label="Valor">{brl(expense.amount)}</Field>
          <Field label="Data da despesa">{dateBR(expense.expenseDate)}</Field>
          <Field label="Enviado em">{dateTimeBR(expense.createdAt)}</Field>
          {expense.validation && (
            <Field label="Validado por">
              {expense.validation.by?.name} em {dateTimeBR(expense.validation.at)}
            </Field>
          )}
          {expense.rejection && (
            <Field label="Rejeitado">
              {expense.rejection.by?.name}: {expense.rejection.reason}
            </Field>
          )}
          {expense.signature && (
            <Field label="Assinado por">
              {expense.signature.signer?.name} em {dateTimeBR(expense.signature.signedAt)}
            </Field>
          )}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              SHA-256 do recibo ({expense.receiptName})
            </Typography>
            <Typography variant="body2" className="mono">
              {expense.receiptSha256}
            </Typography>
          </Grid>
        </Grid>
        {showReceipt && (
          <>
            <Divider className="my-4" />
            <ReceiptPreview expense={expense} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
