import { Chip } from '@mui/material';

const MAP = {
  PENDENTE: { label: 'Pendente', color: 'warning' },
  VALIDADO: { label: 'Validado', color: 'info' },
  REJEITADO: { label: 'Rejeitado', color: 'error' },
  ASSINADO: { label: 'Assinado', color: 'success' },
};

export default function StatusChip({ status }) {
  const s = MAP[status] || { label: status, color: 'default' };
  return <Chip size="small" label={s.label} color={s.color} />;
}
