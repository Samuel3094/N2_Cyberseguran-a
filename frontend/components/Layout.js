import { useEffect, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  AppBar, Box, Button, CircularProgress, Container, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Typography, Alert,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptIcon from '@mui/icons-material/ReceiptLong';
import ListIcon from '@mui/icons-material/ListAlt';
import PendingIcon from '@mui/icons-material/PendingActions';
import KeyIcon from '@mui/icons-material/VpnKey';
import VerifiedIcon from '@mui/icons-material/Verified';
import { useAuth } from '../lib/auth';
import { ROLES } from '../lib/format';

const MENU = [
  { href: '/dashboard', label: 'Painel', icon: <DashboardIcon />, roles: null },
  { href: '/submitExpense', label: 'Nova despesa', icon: <ReceiptIcon />, roles: null },
  { href: '/myExpenses', label: 'Minhas despesas', icon: <ListIcon />, roles: null },
  { href: '/pendingExpenses', label: 'Pendentes', icon: <PendingIcon />, roles: ['SUPERVISOR', 'GERENTE'] },
  { href: '/keys', label: 'Minha chave', icon: <KeyIcon />, roles: ['SUPERVISOR', 'GERENTE'] },
  { href: '/signedExpenses', label: 'Assinados', icon: <VerifiedIcon />, roles: ['GERENTE'] },
  { href: '/employees', label: 'Funcionários', icon: <PeopleIcon />, roles: ['GERENTE'] },
];

/**
 * Layout das páginas autenticadas. `roles` restringe o acesso por perfil
 * (o backend também valida — a interface apenas evita telas inúteis).
 */
export default function Layout({ title, roles, children }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <Box className="flex h-screen items-center justify-center">
        <CircularProgress />
      </Box>
    );
  }

  const allowed = !roles || roles.includes(user.role);
  const items = MENU.filter((m) => !m.roles || m.roles.includes(user.role));

  const nav = (
    <List className="w-64">
      {items.map((m) => (
        <ListItemButton
          key={m.href}
          component={Link}
          href={m.href}
          selected={router.pathname === m.href}
          onClick={() => setOpen(false)}
        >
          <ListItemIcon>{m.icon}</ListItemIcon>
          <ListItemText primary={m.label} />
        </ListItemButton>
      ))}
    </List>
  );

  return (
    <>
      <Head>
        <title>{`${title} | Assinatura Digital`}</title>
      </Head>
      <AppBar position="sticky">
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setOpen(true)} className="md:hidden" aria-label="menu">
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" className="flex-1">
            Assinatura Digital
          </Typography>
          <Typography variant="body2" className="mr-3 hidden sm:block">
            {user.name} · {ROLES[user.role]}
          </Typography>
          <Button color="inherit" onClick={logout}>
            Sair
          </Button>
        </Toolbar>
      </AppBar>
      <Drawer open={open} onClose={() => setOpen(false)}>
        {nav}
      </Drawer>
      <Box className="flex">
        <Box component="nav" className="hidden min-h-[calc(100vh-64px)] border-r border-slate-200 bg-white md:block">
          {nav}
        </Box>
        <Container maxWidth="lg" className="py-6">
          <Typography variant="h5" className="mb-4 font-semibold">
            {title}
          </Typography>
          {allowed ? children : <Alert severity="error">Seu perfil não tem acesso a esta página.</Alert>}
        </Container>
      </Box>
    </>
  );
}
