import { test } from "node:test";
import assert from "node:assert";
import { detectResetIntent } from "../lib/resetIntent.js";
import { createSession, getSession, appendTurn } from "../lib/sessionStore.js";
import { handleDeterministicTurn } from "../lib/turnRouter.js";

test("detects reset-chat requests", () => {
  for (const t of ["reset chat", "Reset the chat", "please reset this conversation", "new chat", "start a new chat", "clear chat", "start over", "reset", "Reset Chat!"]) {
    assert.ok(detectResetIntent(t), t);
  }
});

test("does not treat other messages as a reset", () => {
  for (const t of ["reset my password", "I want to start over with my life", "my chat with my boss went badly", "how do I reset my sleep schedule", "restart my medication"]) {
    assert.ok(!detectResetIntent(t), t);
  }
});

test("reset wipes the session and flags the client", async () => {
  const id = createSession({});
  appendTurn(id, "user", "hello");
  appendTurn(id, "model", "hi");
  const session = getSession(id);
  session.booking = { flow: "book" };
  const r = await handleDeterministicTurn(session, "reset chat", { sessionId: id });
  assert.ok(r.handled && r.reset);
  const after = getSession(id);
  assert.deepStrictEqual(after.history, []);
  assert.strictEqual(after.booking, undefined);
});
