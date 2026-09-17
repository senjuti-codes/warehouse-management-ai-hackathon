import { LandingPageRouter } from "@/components/landing-page-router";
import { InventoryHealthPage } from "@/components/inventory-health-page";
import { VendorsPage } from "@/components/vendors-page";
import { DataSourcesPage } from "@/components/data-sources-page";
import { SettingsPage } from "@/components/settings-page";

export default async function Home({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ view?: string }>;
}>) {
  const { view } = await searchParams;

  if (view === "inventory-health") {
    return <InventoryHealthPage />;
  }

  if (view === "vendors") {
    return <VendorsPage />;
  }

  if (view === "data-sources") {
    return <DataSourcesPage />;
  }

  if (view === "settings") {
    return <SettingsPage />;
  }

  return <LandingPageRouter />;
}
