# Robot experience scaffold

## Implemented

- `/robot` viewing and marketplace page.
- Existing recorded capybara video used as an explicit demo fallback.
- Three prototype robot records with vendor model/API marked pending.
- Safe-control preview with disabled controls, staff override language and no implied hardware connection.
- Hourly slot cards, first-sale/resale states and account-gated action.
- Domain types for robots, slots, bids, entitlements and resale listings.
- Matching Amplify models, with no payment mutation or public deployment.

## Deliberately blocked

- Robot stream/control adapter: exact ROLA model, firmware and vendor API are unverified.
- Money: currency, reserve, increments, fees, payment rail and collecting entity are unset.
- Auctions: close timing, anti-sniping, deposits and failed-payment policy are unset.
- Resale: cap, fee, transfer cutoff and refund priority are unset.
- Public launch: final brand/domain and animal-operations sign-off are unset.

## Hardware adapter contract to implement next

The on-site gateway should expose authenticated server-side operations only:

- `getStatus(robotId)`
- `startSession(robotId, entitlementId)`
- `heartbeat(sessionId)`
- `sendCommand(sessionId, command)` where command is a small allowlist
- `stop(sessionId, reason)`
- `getStreamToken(robotId, viewerRole)`

Every disconnect must result in a stop. Browser clients never receive vendor credentials or talk directly to the robot.

## Backend security note

The marketplace model is currently a typed frontend/domain scaffold only. Do not add bids, entitlements or resale writes to the existing public API-key authorization mode. Before backend implementation, choose the account provider and apply owner/admin authorization, conditional bid writes, immutable ledgers and server-side auction transitions.
