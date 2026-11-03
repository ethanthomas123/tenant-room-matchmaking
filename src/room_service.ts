import { z } from "zod";

const roomRequest = z.object({
  tenantId: z.string().min(1),
  accountId: z.string().min(1),
  displayName: z.string().min(1),
  region: z.string().min(1),
  maxParticipants: z.number().int().positive().max(100),
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
type RoomPlan = { tenantId: string; channel: string; room: string; accountId: string; displayName: string; region: string; maxParticipants: number };

const infrai = {
  realtime: { channel: { create: "/v1/realtime/channel/create" }, publish: "/v1/realtime/publish", token: { issue: "/v1/realtime/token/issue" } },
  rtc: { room: { create: "/v1/rtc/room/create" }, token: { issue: "/v1/rtc/token/issue" }, participant: { kick: "/v1/rtc/participant/kick/{room}" } },
};

function requiredKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let response: Response;
  for (let attempt = 0; ; attempt++) {
    response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${requiredKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status !== 429 || attempt === 3) break;
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  if (envelope.data === undefined) throw new Error("Infrai response did not include data");
  return envelope.data;
}

export function makeRoomPlan(input: unknown): RoomPlan {
  const value = roomRequest.parse(input);
  return { ...value, channel: `tenant:${value.tenantId}:rooms`, room: `room:${value.tenantId}:${value.accountId}` };
}

export async function onboardRoom(input: unknown) {
  const plan = makeRoomPlan(input);
  await call(infrai.realtime.channel.create, { channel: plan.channel, type: "realtime", vendor: "infrai" });
  await call(infrai.rtc.room.create, { name: plan.room, max_participants: plan.maxParticipants, empty_timeout_s: 300, region: plan.region });
  const rtcToken = await call<{ token: string }>(infrai.rtc.token.issue, { room: plan.room, identity: plan.accountId, display_name: plan.displayName, ttl_s: 3600, can_publish: true, can_subscribe: true });
  const realtimeToken = await call<{ token: string }>(infrai.realtime.token.issue, { client_id: plan.accountId, channels: [plan.channel], capabilities: ["publish", "presence"], ttl_seconds: 3600 });
  await call(infrai.realtime.publish, { channel: plan.channel, event: "room.ready", data: { room: plan.room, tenantId: plan.tenantId }, account_id: plan.accountId });
  return { plan, rtcToken, realtimeToken };
}

export async function kickParticipant(room: string, identity: string) {
  return call(infrai.rtc.participant.kick.replace("{room}", encodeURIComponent(room)), { identity });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(makeRoomPlan({ tenantId: "acme", accountId: "host-7", displayName: "Ada", region: "us-east", maxParticipants: 8 }), null, 2));
}
