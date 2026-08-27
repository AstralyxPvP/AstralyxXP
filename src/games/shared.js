/**
 * Shared helpers for XP minigames.
 */

export function randomInt(maxExclusive) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % maxExclusive;
}

export function pick(arr) {
  return arr[randomInt(arr.length)];
}

export function randomBool() {
  return randomInt(2) === 0;
}

export function disabledButton(label, customId) {
  return [{
    type: 1,
    components: [{
      type: 2,
      style: 1,
      label,
      custom_id: customId,
      disabled: true,
    }],
  }];
}

/**
 * Schedule automatic settlement for a game shortly after its expiry, even
 * if no one ever clicks again. Guarantees games always resolve themselves.
 */
export function scheduleExpiry(env, ctx, sessionId, expiresAt, finalize) {
  const ms = Math.max(0, expiresAt - Date.now()) + 2000;
  ctx.waitUntil((async () => {
    await new Promise((r) => setTimeout(r, ms));
    const session = await env.astralyx_xp
      .prepare('SELECT * FROM minigame_sessions WHERE id = ?')
      .bind(sessionId)
      .first();
    if (!session) return;
    const state = JSON.parse(session.state);
    if (!state.ended && Date.now() >= session.expires_at) {
      state.ended = true;
      await finalize(session, state, env);
    }
  })());
}