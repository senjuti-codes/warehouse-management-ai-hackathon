export type DataSourceStatus = "Healthy" | "Warning";

export type DataSourceRecord = {
  name: string;
  type: string;
  records: string;
  lastSync: string;
  status: DataSourceStatus;
  coverage: string;
};

