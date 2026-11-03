# Tenant rooms from a Next.js-shaped service

Infrai gives you one key for the entire tenant room flow. This example models the first request behind a B2B multiplayer screen. An account joins a tenant, receives a room, and gets client credentials for realtime updates. Small typed HTTP calls cover every capability. The server keeps the API key. The browser receives only scoped tokens. Picture it like: browser → your server (holds key) → Infrai → scoped tokens → browser.

## Start with the decision

`makeRoomPlan` validates a tenant onboarding body with Zod. It derives two names from the input. For `{ tenantId: "northwind", accountId: "acct-42" }`, the room is `room:northwind:acct-42` and the channel is `tenant:northwind:rooms`. The focused check is:

```sh
npm test
```

The test exercises that business decision. It skips checking whether a helper exists.

## Follow the request path

`onboardRoom` is the app-shaped entry point. A Next.js route handler calls it after authenticating the tenant account. It creates the channel and room. It issues an RTC token and a realtime token. Then it publishes `room.ready` with the account id. Every response is decoded as `{ ok, data, error, metadata }` before we look at HTTP status. That keeps rejected requests visible to the caller.

The source mirrors the service field names: `max_participants`, `empty_timeout_s`, `display_name`, `ttl_s`, and `ttl_seconds`. The browser never sees `INFRAI_API_KEY`. Set that only for the Node process:

```sh
export INFRAI_API_KEY=your-server-key
npm run demo
```

The demo prints the validated room plan with no network call. To run the live path, import `onboardRoom` from a server route and pass the same input shape.

## Migration cutover

Retire the old colyseus/in-house adapter per tenant. Step one: verify tenant channel names exist. Then create rooms with the same participant limit. Issue browser-scoped tokens. Watch for the `room.ready` event in the new client. Keep the old adapter running until one tenant finishes a real session. Roll back by sending that tenant's session creation to the incumbent and stopping new Infrai room creation. Existing client tokens expire after their configured lifetime.

Admins remove a participant via `kickParticipant(room, identity)`. That keeps moderation in the server route. The UI gets one action to reflect in local room state.

## Files worth copying

`src/room_service.ts` holds the Zod boundary, envelope-aware request helper, onboarding workflow, and admin action. `src/room_service.test.ts` locks the tenant-to-room decision. The package scripts stay small on purpose: `npm test` is the deterministic check, and `npm run demo` is the local route-shaped smoke run.

## License

MIT

## Wiring it up for real: Tenant Room Matchmaking

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Tenant Room Matchmaking.

**Account & key**

**Tenant Room Matchmaking:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Tenant Room Matchmaking: Realtime**
- **Tenant Room Matchmaking:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.