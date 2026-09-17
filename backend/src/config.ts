import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export const appConfig = {
  environment: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 8000),
  workbookPath:
    process.env.WORKBOOK_PATH ??
    resolve(repositoryRoot, 'data', 'Warehouse_AI_Hackathon_Synthetic_Dataset_FINAL.xlsx'),
  rootDir: repositoryRoot,
};
