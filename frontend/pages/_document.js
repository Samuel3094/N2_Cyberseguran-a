import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        {/* GitHub Pages não permite cabeçalhos HTTP próprios: políticas aplicáveis via <meta> */}
        <meta name="referrer" content="no-referrer" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
