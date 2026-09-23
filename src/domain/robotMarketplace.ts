export type RobotStatus = 'ready' | 'charging' | 'offline' | 'api_pending';
export type SlotStatus = 'scheduled' | 'auction_open' | 'auction_closed' | 'cancelled' | 'completed';
export type EntitlementStatus = 'active' | 'listed' | 'transferred' | 'cancelled' | 'used';

export interface Robot {
  id: string;
  name: string;
  model: string;
  status: RobotStatus;
  batteryPercent?: number;
  streamId?: string;
  apiMode: 'stub' | 'vendor';
}

export interface ExperienceSlot {
  id: string;
  robotId: string;
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
  currency: 'TBD';
  reserveAmount?: number;
  currentBid?: number;
  minimumIncrement?: number;
  bidCount: number;
  auctionClosesAt?: string;
}

export interface SlotBid {
  id: string;
  slotId: string;
  bidderId: string;
  amount: number;
  currency: 'TBD';
  placedAt: string;
  status: 'active' | 'outbid' | 'winning' | 'withdrawn' | 'payment_failed';
}

export interface SlotEntitlement {
  id: string;
  slotId: string;
  ownerId: string;
  status: EntitlementStatus;
  acquiredBy: 'primary_auction' | 'fixed_booking' | 'resale' | 'admin';
  acquiredAmount?: number;
  currency: 'TBD';
  transferCount: number;
}

export interface ResaleListing {
  id: string;
  entitlementId: string;
  sellerId: string;
  askingAmount?: number;
  currency: 'TBD';
  status: 'draft' | 'listed' | 'reserved' | 'sold' | 'cancelled' | 'expired';
  expiresAt: string;
}

export const prototypeRobots: Robot[] = [
  { id: 'prototype-1', name: 'Prototype 1', model: 'ROLA model pending confirmation', status: 'api_pending', apiMode: 'stub' },
  { id: 'prototype-2', name: 'Prototype 2', model: 'ROLA model pending confirmation', status: 'api_pending', apiMode: 'stub' },
  { id: 'prototype-3', name: 'Prototype 3', model: 'ROLA model pending confirmation', status: 'api_pending', apiMode: 'stub' },
];

export const demoSlots: ExperienceSlot[] = [
  {
    id: 'slot-demo-1',
    robotId: 'prototype-1',
    startsAt: '2026-09-26T10:00:00+07:00',
    endsAt: '2026-09-26T11:00:00+07:00',
    status: 'auction_open',
    currency: 'TBD',
    bidCount: 0,
    auctionClosesAt: '2026-09-25T10:00:00+07:00',
  },
  {
    id: 'slot-demo-2',
    robotId: 'prototype-2',
    startsAt: '2026-09-26T12:00:00+07:00',
    endsAt: '2026-09-26T13:00:00+07:00',
    status: 'scheduled',
    currency: 'TBD',
    bidCount: 0,
  },
  {
    id: 'slot-demo-3',
    robotId: 'prototype-3',
    startsAt: '2026-09-27T15:00:00+07:00',
    endsAt: '2026-09-27T16:00:00+07:00',
    status: 'scheduled',
    currency: 'TBD',
    bidCount: 0,
  },
];
