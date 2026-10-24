/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  // O reset do Tailwind é desligado para não conflitar com o CssBaseline do Material-UI.
  // Os estilos do MUI são injetados antes (StyledEngineProvider injectFirst), então as classes Tailwind prevalecem.
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};
