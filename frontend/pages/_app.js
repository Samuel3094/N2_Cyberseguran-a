import { CssBaseline, StyledEngineProvider, ThemeProvider, createTheme } from '@mui/material';
import { AuthProvider } from '../lib/auth';
import '../styles/globals.css';

const theme = createTheme({
  palette: { primary: { main: '#1e3a8a' }, secondary: { main: '#0f766e' } },
  shape: { borderRadius: 10 },
});

export default function App({ Component, pageProps }) {
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
