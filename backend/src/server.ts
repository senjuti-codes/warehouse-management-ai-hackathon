import { appConfig } from './config.ts';
import { createApiServer } from './api.ts';

const start = async () => {
  console.log('Warehouse AI backend starting...');
  console.log('Environment:', appConfig.environment);
  console.log('Workbook path:', appConfig.workbookPath);

  createApiServer(appConfig.port);
  console.log('Pipeline status: ready');
};

start().catch((error) => {
  console.error('Backend failed to start:', error);
  process.exitCode = 1;
});
