import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, MenuItem,
  Paper, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/PersonAdd';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { ROLES } from '../lib/format';

const EMPTY = { name: '', email: '', cpf: '', department: '', position: '', role: 'FUNCIONARIO', password: '', active: true };

export default function Employees() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null); // null = diálogo fechado
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(() => api.get('/employees').then((d) => setList(d.employees)).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  const set = (field) => (e) => setForm({ ...form, [field]: field === 'active' ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (form.id) {
        const { name, email, department, position, role, active } = form;
        await api.put(`/employees/${form.id}`, { name, email, department, position, role, active });
        setMessage('Funcionário atualizado.');
      } else {
        await api.post('/employees', form);
        setMessage('Funcionário cadastrado. Um e-mail de boas-vindas foi enviado.');
      }
      setForm(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deactivate = async (emp) => {
    if (!window.confirm(`Desativar ${emp.name}? A chave de assinatura dele será revogada.`)) return;
    try {
      await api.del(`/employees/${emp.id}`);
      setMessage('Funcionário desativado.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Layout title="Funcionários" roles={['GERENTE']}>
      {message && (
        <Alert severity="success" className="mb-3" onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}
      {error && !form && (
        <Alert severity="error" className="mb-3" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Button variant="contained" startIcon={<AddIcon />} className="mb-4" onClick={() => { setError(''); setForm(EMPTY); }}>
        Novo funcionário
      </Button>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>E-mail</TableCell>
              <TableCell>CPF</TableCell>
              <TableCell>Departamento</TableCell>
              <TableCell>Perfil</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((emp) => (
              <TableRow key={emp.id} hover>
                <TableCell>{emp.name}</TableCell>
                <TableCell>{emp.email}</TableCell>
                <TableCell>{emp.cpf}</TableCell>
                <TableCell>{emp.department || '-'}</TableCell>
                <TableCell>{ROLES[emp.role]}</TableCell>
                <TableCell>
                  <Chip size="small" label={emp.active ? 'Ativo' : 'Inativo'} color={emp.active ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right" className="whitespace-nowrap">
                  <Button size="small" onClick={() => { setError(''); setForm({ ...EMPTY, ...emp }); }}>
                    Editar
                  </Button>
                  {emp.active && (
                    <Button size="small" color="error" onClick={() => deactivate(emp)}>
                      Desativar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(form)} onClose={() => setForm(null)} maxWidth="sm" fullWidth>
        {form && (
          <form onSubmit={save}>
            <DialogTitle>{form.id ? 'Editar funcionário' : 'Novo funcionário'}</DialogTitle>
            <DialogContent>
              {error && (
                <Alert severity="error" className="mb-3">
                  {error}
                </Alert>
              )}
              <Grid container spacing={2} className="pt-2">
                <Grid item xs={12}>
                  <TextField label="Nome completo" value={form.name} onChange={set('name')} required fullWidth inputProps={{ maxLength: 120 }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="E-mail" type="email" value={form.email} onChange={set('email')} required fullWidth />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="CPF"
                    value={form.cpf}
                    onChange={set('cpf')}
                    required={!form.id}
                    disabled={Boolean(form.id)}
                    helperText={form.id ? 'CPF não pode ser alterado' : 'Somente números'}
                    fullWidth
                    inputProps={{ maxLength: 14 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Departamento" value={form.department} onChange={set('department')} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Cargo" value={form.position} onChange={set('position')} fullWidth />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField select label="Perfil" value={form.role} onChange={set('role')} fullWidth>
                    {Object.entries(ROLES).map(([k, v]) => (
                      <MenuItem key={k} value={k}>
                        {v}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                {form.id ? (
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel control={<Switch checked={form.active} onChange={set('active')} />} label="Ativo" />
                  </Grid>
                ) : (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Senha inicial"
                      type="password"
                      value={form.password}
                      onChange={set('password')}
                      required
                      fullWidth
                      autoComplete="new-password"
                      helperText="8+ caracteres, maiúscula, minúscula, número e símbolo"
                    />
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setForm(null)}>Cancelar</Button>
              <Button type="submit" variant="contained">
                Salvar
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>
    </Layout>
  );
}
