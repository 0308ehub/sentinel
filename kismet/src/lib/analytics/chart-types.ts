export interface ChartPoint {
  day: string;
  customers: number;
  revenue: number;
  orders: number;
}

export interface BarPoint {
  label: string;
  revenue: number;
  orders: number;
}

export interface FunnelStep {
  step: string;
  users: number;
  conversion: number;
}

export interface WarehouseCharts {
  source: string;
  startDay: string;
  endDay: string;
  customers: number;
  transactions: number;
  revenue: number;
  products: number;
  growthLabel: string;
  momAvailable: boolean;
  customersNow: number;
  customersPrev: number;
  revenueNow: number;
  revenuePrev: number;
  trend: ChartPoint[];
  bars: BarPoint[];
  funnel: FunnelStep[];
}
