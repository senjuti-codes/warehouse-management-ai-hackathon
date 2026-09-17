import { appConfig } from '../config.ts';
import { readWorkbook } from '../workbook/excelReader.ts';

const main = async () => {
  const profile = await readWorkbook(appConfig.workbookPath);

  console.log('Workbook path:', appConfig.workbookPath);
  console.log('Sheets:', profile.sheetNames.join(', '));

  for (const sheet of profile.sheets) {
    console.log(`\n### ${sheet.name}`);
    console.log('Headers:', sheet.headers.join(' | '));
    console.log('Row count:', sheet.rows.length);
    console.log('Sample rows:');
    for (const row of sheet.rows.slice(0, 2)) {
      console.log(JSON.stringify(row, null, 2));
    }
  }
};

main().catch((error) => {
  console.error('Workbook inspection failed:', error);
  process.exitCode = 1;
});
