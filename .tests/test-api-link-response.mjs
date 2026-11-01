import assert from 'node:assert/strict';
import test from 'node:test';
import { handleAPI } from '../src/api.js';

function createDatabase(user) {
  const links = [];
  return {
    links,
    prepare(sql) {
      let values = [];
      return {
        bind(...args) {
          values = args;
          return this;
        },
        async run() {
          if (sql.startsWith('INSERT OR REPLACE INTO linked_accounts')) {
            links.push(values);
          }
          return { success: true };
        },
        async first() {
          if (sql.startsWith('SELECT * FROM users')) return user;
          return null;
        }
      };
    }
  };
}

test('manual XP link returns success in the string format read by the Minecraft plugin', async () => {
  const user = { discord_id: '123456789012345678', xp: 2322, daily_streak: 0 };
  const db = createDatabase(user);
  const request = new Request('https://xp.example/api/link', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test-secret',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      discord_id: user.discord_id,
      minecraft_uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      minecraft_name: 'TestPlayer',
      merge_xp: 0
    })
  });

  const response = await handleAPI(request, { API_SECRET: 'test-secret', astralyx_xp: db }, new URL(request.url));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.success, 'true');
  assert.equal(result.xp, user.xp);
  assert.equal(result.picked, 'discord');
  assert.equal(db.links.length, 1);
});
