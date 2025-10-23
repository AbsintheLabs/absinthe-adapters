// Enrichment pipeline type definitions
import { Activity } from './core.ts';
import { PositionReason as PositionReason } from './adapter.ts';
import { MeasurementType } from './manifest.ts';
import { Asset } from './asset.ts';

export interface AssetRegistration {
  asset: string;
}

export interface RawPosition {
  // Adapter primitives (universal)
  user: string;
  // asset: string;
  asset: Asset;
  activity: Activity;
  meta: Record<string, any> | null;

  // Window timing (universal)
  startTs: number;
  endTs: number;
  startHeight: number;
  endHeight: number | null;
  startValue: string;
  endValue: string;
  startTxRef: string;
  endTxRef: string | null;

  // window explainability
  trigger: PositionReason;

  // Pricing handler ID (for looking up price config)
  measurementType: 'token_based';
  pricingHandlerId: string | null;
  trackableInstanceId: string;

  // Chain-specific contexts (opaque blobs)
  // Only present for event-triggered windows, not periodic flushes
  startContext: Record<string, any> | null; // From Redis JSON
  endContext: Record<string, any> | null; // From current unified event
}

export interface RawAction {
  key: string;
  user: string;
  measurementType: MeasurementType;
  asset?: Asset;
  activity: Activity;
  meta: Record<string, any> | null;

  ts: number;
  height: number;
  value: string;
  txRef: string;

  // Pricing handler ID (for looking up price config)
  pricingHandlerId?: string;
  trackableInstanceId: string;

  ctx?: Record<string, any>; // From Redis JSON
}
