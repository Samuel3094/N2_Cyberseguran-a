import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import StatusChip from './StatusChip';
import { brl, CATEGORIES, dateBR } from '../lib/format';

/** Tabela de despesas reutilizada nas listagens. `actions(expense)` renderiza os botões da linha. */
export default function ExpenseTable({ expenses, actions, showEmployee = true, empty = 'Nenhuma despesa encontrada.' }) {
  if (!expenses.length) return <Typography color="text.secondary">{empty}</Typography>;
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {showEmployee && <TableCell>Funcionário</TableCell>}
            <TableCell>Descrição</TableCell>
            <TableCell>Categoria</TableCell>
            <TableCell align="right">Valor</TableCell>
            <TableCell>Data</TableCell>
            <TableCell>Status</TableCell>
            {actions && <TableCell align="right">Ações</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {expenses.map((e) => (
            <TableRow key={e.id} hover>
              {showEmployee && <TableCell>{e.employee?.name}</TableCell>}
              <TableCell className="max-w-xs truncate">{e.description}</TableCell>
              <TableCell>{CATEGORIES[e.category]}</TableCell>
              <TableCell align="right">{brl(e.amount)}</TableCell>
              <TableCell>{dateBR(e.expenseDate)}</TableCell>
              <TableCell>
                <StatusChip status={e.status} />
              </TableCell>
              {actions && <TableCell align="right" className="whitespace-nowrap">{actions(e)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
