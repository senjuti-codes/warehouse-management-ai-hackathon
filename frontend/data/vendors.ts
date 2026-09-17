export type VendorStatus = "Healthy" | "At risk" | "Blocked";
export type VendorRisk = "Low" | "Medium" | "High" | "Critical";

export type VendorRecord = {
  id: string;
  name: string;
  region: string;
  category: string;
  openOrders: number;
  onTimeRate: number;
  leadTime: string;
  status: VendorStatus;
  risk: VendorRisk;
  spend: string;
  nextDelivery: string;
};

export const vendors: VendorRecord[] = [
  {
    id: "V-018",
    name: "Bavaria Components GmbH",
    region: "Germany",
    category: "Brake systems",
    openOrders: 8,
    onTimeRate: 62,
    leadTime: "12 days",
    status: "At risk",
    risk: "High",
    spend: "€284k",
    nextDelivery: "Today, 14:30",
  },
  {
    id: "V-044",
    name: "Central European Castings",
    region: "Czechia",
    category: "Powertrain",
    openOrders: 5,
    onTimeRate: 91,
    leadTime: "8 days",
    status: "Blocked",
    risk: "Critical",
    spend: "€196k",
    nextDelivery: "Tomorrow, 09:00",
  },
  {
    id: "V-031",
    name: "Danube Precision Parts",
    region: "Slovakia",
    category: "Fasteners",
    openOrders: 12,
    onTimeRate: 96,
    leadTime: "5 days",
    status: "Healthy",
    risk: "Low",
    spend: "€152k",
    nextDelivery: "Today, 18:00",
  },
  {
    id: "V-072",
    name: "Nordic Seal Systems",
    region: "Sweden",
    category: "Sealing",
    openOrders: 4,
    onTimeRate: 84,
    leadTime: "9 days",
    status: "At risk",
    risk: "Medium",
    spend: "€118k",
    nextDelivery: "Sep 16, 11:20",
  },
  {
    id: "V-006",
    name: "Rhine Industrial Supply",
    region: "Germany",
    category: "Sheet metal",
    openOrders: 7,
    onTimeRate: 98,
    leadTime: "4 days",
    status: "Healthy",
    risk: "Low",
    spend: "€307k",
    nextDelivery: "Today, 20:30",
  },
];
