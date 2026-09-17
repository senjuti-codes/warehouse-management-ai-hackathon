import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const configuredWorkbookPath = process.env.WORKBOOK_PATH;

export const appConfig = {
  environment: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 8000),
  workbookPath: configuredWorkbookPath
    ? resolve(repositoryRoot, 'backend', configuredWorkbookPath)
    : resolve(repositoryRoot, 'data', 'Warehouse_AI_Hackathon_Synthetic_Dataset_FINAL.xlsx'),
  rootDir: repositoryRoot,
  llmBaseUrl: process.env.LLMAAS_BASE_URL ?? process.env.LLM_BASE_URL ?? '',
  llmApiKey: process.env.LLMAAS_API_KEY ?? process.env.LLM_API_KEY ?? '',
  llmModel: process.env.LLMAAS_MODEL ?? process.env.LLM_MODEL ?? '',
  idpTokenUrl: process.env.LLMAAS_IDP_TOKEN_URL ?? 'https://idp.cloud.vwgroup.com/auth/realms/kums-mfa/protocol/openid-connect/token',
  idpClientId: process.env.LLMAAS_IDP_CLIENT_ID ?? '',
  idpClientSecret: process.env.LLMAAS_IDP_CLIENT_SECRET ?? '',
  llmTimeoutMs: Number(process.env.LLMAAS_TIMEOUT_MS ?? 30000),
};
