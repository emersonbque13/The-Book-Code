import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente baseadas no modo (development/production)
  // O terceiro argumento '' garante que carregue todas as variáveis, não apenas as com prefixo VITE_
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // Define process.env.API_KEY explicitamente para o navegador
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});