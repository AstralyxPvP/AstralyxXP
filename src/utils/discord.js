/**
 * Discord REST API helpers for deferred responses and message management.
 */

const DISCORD_API = 'https://discord.com/api/v10';

/**
 * PATCH the original deferred interaction response.
 */
export async function patchOriginal(appId, token, data) {
  const url = `${DISCORD_API}/webhooks/${appId}/${token}/messages/@original`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    console.error(`patchOriginal failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

/**
 * Send a followup message to the interaction.
 */
export async function sendFollowup(appId, token, data) {
  const url = `${DISCORD_API}/webhooks/${appId}/${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    console.error(`sendFollowup failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

/**
 * Send a message to a channel (requires bot token).
 */
export async function sendChannelMessage(botToken, channelId, data) {
  const url = `${DISCORD_API}/channels/${channelId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    console.error(`sendChannelMessage failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

/**
 * Edit an existing message in a channel.
 */
export async function editMessage(botToken, channelId, messageId, data) {
  const url = `${DISCORD_API}/channels/${channelId}/messages/${messageId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    console.error(`editMessage failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

/**
 * Build a JSON interaction response.
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Ephemeral message response (only visible to the invoking user).
 */
export function ephemeralResponse(content) {
  return jsonResponse({ type: 4, data: { content, flags: 64 } });
}

/**
 * Deferred response (shows "thinking..." then we PATCH later).
 */
export function deferredResponse() {
  return jsonResponse({ type: 5 });
}

/**
 * Deferred update for component interactions (no new "thinking" message).
 */
export function deferredUpdateResponse() {
  return jsonResponse({ type: 6 });
}

/**
 * Update the message a component is attached to.
 */
export function updateMessageResponse(data) {
  return jsonResponse({ type: 7, data });
}
