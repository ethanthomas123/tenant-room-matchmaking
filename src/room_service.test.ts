import test from "node:test";
import assert from "node:assert/strict";
import { makeRoomPlan } from "./room_service.ts";

test("tenant onboarding gives each account a stable room and channel", () => {
  const plan = makeRoomPlan({ tenantId: "northwind", accountId: "acct-42", displayName: "Mina", region: "eu-west", maxParticipants: 6 });
  assert.equal(plan.room, "room:northwind:acct-42");
  assert.equal(plan.channel, "tenant:northwind:rooms");
  assert.equal(plan.maxParticipants, 6);
});
