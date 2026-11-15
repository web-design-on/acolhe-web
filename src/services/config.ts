/** Configuração da camada de dados, lida das variáveis de ambiente (.env). */
export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_URL ?? "/api",
  /** Enquanto for true, os serviços usam src/mocks em vez da API. */
  useMocks: import.meta.env.VITE_USE_MOCKS !== "false",
  /** Botões de "entrar com conta de demonstração" no login. Com banco, dependem das contas do seed (npm run db:seed). */
  demoLogin: import.meta.env.VITE_DEMO_LOGIN !== "false",
  /** Atraso simulado das respostas mockadas, em ms. */
  mockDelay: 350,
};
