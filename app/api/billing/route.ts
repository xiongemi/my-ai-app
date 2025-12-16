import { getTotalCost, getUsageHistory, getCostByModel } from "@/lib/billing";
import { NextResponse } from "next/server";

export function GET() {
  const totalCost = getTotalCost();
  const usageHistory = getUsageHistory();
  const costByModel = getCostByModel();

  return NextResponse.json({
    totalCost,
    usageHistory,
    costByModel,
  });
}
