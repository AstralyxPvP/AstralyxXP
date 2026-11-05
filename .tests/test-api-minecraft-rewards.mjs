import assert from 'node:assert/strict';
import test from 'node:test';
import { handleAPI } from '../src/api.js';

function createDatabase() {
  const users = new Map();
  const links = new Map();
  const events = new Map();
  const stats = new Map();

  function statement(sql, values = []) {
    return {
      bind(...args) {
        values = args;
        return this;
      },
      async first() {
        if (sql.startsWith('SELECT * FROM linked_accounts')) {
          return links.get(values[0]) ?? null;
        }
        if (sql.startsWith('SELECT * FROM users')) {
          return users.get(values[0]) ?? null;
        }
        if (sql.startsWith('SELECT kills_after FROM minecraft_reward_events')) {
          return events.get(`${values[0]}:${values[1]}`) ?? null;
        }
        if (sql.startsWith('SELECT kills FROM minecraft_stats')) {
          return stats.get(values[0]) ?? null;
        }
        return null;
      },
      async run() {
        if (sql.startsWith('INSERT OR IGNORE INTO users')) {
          if (!users.has(values[0])) {
            users.set(values[0], { discord_id: values[0], xp: 0, daily_streak: 0 });
          }
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith('INSERT OR IGNORE INTO minecraft_reward_events')) {
          const isConditional = sql.includes('SELECT ?, ?, ?,');
          const [uuid, eventId, discordId, reasonOrXp, amountOrDate] = values;
          const key = `${uuid}:${eventId}`;
          if (isConditional) {
            const [conditionalUuid, conditionalEventId, threshold] = values.slice(-3);
            const killEvent = events.get(`${conditionalUuid}:${conditionalEventId}`);
            if (!killEvent || killEvent.kills_after !== threshold || events.has(key)) {
              return { meta: { changes: 0 } };
            }
            const reward = {
              minecraft_uuid: uuid,
              event_id: eventId,
              discord_id: discordId,
              reason: 'kill_milestone',
              amount: reasonOrXp,
              kills_after: null,
            };
            events.set(key, reward);
            users.get(discordId).xp += reward.amount;
            return { meta: { changes: 1 } };
          }
          if (events.has(key)) {
            return { meta: { changes: 0 } };
          }
          const isKill = sql.includes("VALUES (?, ?, ?, 'kill', ?, ?)");
          const reason = isKill ? 'kill' : reasonOrXp;
          const amount = isKill ? reasonOrXp : amountOrDate;
          const reward = {
            minecraft_uuid: uuid,
            event_id: eventId,
            discord_id: discordId,
            reason,
            amount,
            kills_after: null,
          };
          if (!users.has(discordId)) {
            throw new Error('test user should exist before rewards');
          }
          users.get(discordId).xp += amount;
          if (reason === 'kill') {
            const kills = (stats.get(uuid)?.kills ?? 0) + 1;
            stats.set(uuid, { discord_id: discordId, kills });
            reward.kills_after = kills;
          }
          events.set(key, reward);
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith('INSERT OR REPLACE INTO linked_accounts')) {
          links.set(values[1], {
            discord_id: values[0],
            minecraft_uuid: values[1],
            minecraft_name: values[2],
          });
        }
        return { meta: { changes: 1 } };
      },
    };
  }

  return {
    users,
    links,
    events,
    stats,
    prepare(sql) {
      return statement(sql);
    },
    async batch(statements) {
      const results = [];
      for (const item of statements) {
        results.push(await item.run());
      }
      return results;
    },
  };
}

const uuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const victimUuid = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const discordId = '123456789012345678';

function makeRequest(path, body, secret = 'test-secret') {
  return new Request(`https://xp.example${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function setupDb() {
  const db = createDatabase();
  db.users.set(discordId, { discord_id: discordId, xp: 0, daily_streak: 0 });
  db.links.set(uuid, {
    discord_id: discordId,
    minecraft_uuid: uuid,
    minecraft_name: 'TestPlayer',
  });
  return db;
}

test('minigame reward is account XP and safe to retry', async () => {
  const db = await setupDb();
  const body = {
    minecraft_uuid: uuid,
    event_id: 'minigame:unique-game-1',
    amount: 25,
    reason: 'minigame',
  };
  const env = { API_SECRET: 'test-secret', astralyx_xp: db };

  const first = await handleAPI(makeRequest('/api/minecraft/reward', body), env,
    new URL('https://xp.example/api/minecraft/reward'));
  const firstResult = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstResult.xp, 25);
  assert.equal(firstResult.duplicate, false);

  const retry = await handleAPI(makeRequest('/api/minecraft/reward', body), env,
    new URL('https://xp.example/api/minecraft/reward'));
  const retryResult = await retry.json();
  assert.equal(retry.status, 200);
  assert.equal(retryResult.xp, 25);
  assert.equal(retryResult.duplicate, true);
});

test('kill rewards increment persistent kills and award a milestone only once', async () => {
  const db = await setupDb();
  const env = { API_SECRET: 'test-secret', astralyx_xp: db };
  let finalResult;

  for (let kill = 1; kill <= 25; kill++) {
    const body = {
      minecraft_uuid: uuid,
      victim_uuid: victimUuid,
      event_id: `kill:${kill}`,
      kill_xp: 5,
      milestones: [{ kills: 25, xp: 50 }, { kills: 100, xp: 75 }],
    };
    const response = await handleAPI(makeRequest('/api/minecraft/kill', body), env,
      new URL('https://xp.example/api/minecraft/kill'));
    assert.equal(response.status, 200);
    finalResult = await response.json();
  }

  assert.equal(finalResult.kills, 25);
  assert.equal(finalResult.xp, 175);
  assert.deepEqual(finalResult.achievements, [{ kills: 25, xp: 50 }]);

  const retry = await handleAPI(makeRequest('/api/minecraft/kill', {
    minecraft_uuid: uuid,
    victim_uuid: victimUuid,
    event_id: 'kill:25',
    kill_xp: 5,
    milestones: [{ kills: 25, xp: 50 }, { kills: 100, xp: 75 }],
  }), env, new URL('https://xp.example/api/minecraft/kill'));
  const retryResult = await retry.json();
  assert.equal(retryResult.duplicate, true);
  assert.equal(retryResult.xp, 175);
  assert.deepEqual(retryResult.achievements, []);
});

test('Minecraft stats endpoint returns cached kill count for PlaceholderAPI', async () => {
  const db = await setupDb();
  db.stats.set(uuid, { discord_id: discordId, kills: 12 });
  const env = { API_SECRET: 'test-secret', astralyx_xp: db };
  const request = new Request(`https://xp.example/api/minecraft/stats/${uuid}`, {
    headers: { Authorization: 'Bearer test-secret' },
  });
  const response = await handleAPI(request, env,
    new URL(`https://xp.example/api/minecraft/stats/${uuid}`));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { minecraft_uuid: uuid, kills: 12 });
});
