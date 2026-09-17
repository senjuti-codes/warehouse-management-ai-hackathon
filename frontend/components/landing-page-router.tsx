"use client";

import { ControlTowerDashboard } from "@/components/control-tower-dashboard";
import { DispatchFlowPage } from "@/components/dispatch-flow-page";
import { InventoryHealthPage } from "@/components/inventory-health-page";
import { VendorsPage } from "@/components/vendors-page";
import { useSettings } from "@/components/settings-provider";

export function LandingPageRouter() {
  const { settings } = useSettings();
  if (settings.landingPage === "Inventory Health")
    return <InventoryHealthPage />;
  if (settings.landingPage === "Dispatch Flow") return <DispatchFlowPage />;
  if (settings.landingPage === "Vendors") return <VendorsPage />;
  return <ControlTowerDashboard />;
}
