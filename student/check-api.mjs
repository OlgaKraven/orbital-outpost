import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function checkApi(base, branch = 'B') {
  const root = base.replace(/\/$/, '') + '/api';
  let checks = 0;

  async function send(method, path, status, gameId, payload) {
    const headers = { Accept: 'application/json' };
    if (gameId) headers['X-Game-Id'] = gameId;
    if (payload !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(root + path, {
      method, headers, body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(12000)
    });
    const raw = await response.text();
    if (status !== undefined) assert.equal(response.status, status, method + ' ' + path + ' ' + raw);
    const body = JSON.parse(raw);
    checks++;
    return { body, status: response.status, location: response.headers.get('Location') };
  }

  const newParty = async scenario =>
    (await send('POST', '/demo/games' + (scenario ? '?scenario=' + scenario : ''), 200)).body;
  const state = async id => (await send('GET', '/game', 200, id)).body;
  const detail = async (id, expedition) => (await send('GET', '/expeditions/' + expedition, 200, id)).body;
  const transitions = (id, expedition, action, status = 200) =>
    send('POST', '/expeditions/' + expedition + '/transitions', status, id, { action });
  const replace = (id, expedition, revision, status) =>
    send('POST', '/expeditions/' + expedition + '/replacements', status, id, { expectedCatalogRevision: revision });
  const prepare = (id, missionId) => send('POST', '/expeditions', 201, id, { missionId });
  const stock = (fuel, rations) => ({ fuel, rations });

  const party = await newParty('briefing');
  const original = party.activeExpedition.id;
  const missions = (await send('GET', '/missions', 200, party.id)).body;
  const catalog = missions.find(mission => mission.id === 'M01');
  assert.equal(catalog.revision, 2);
  assert.deepEqual(catalog.cost, stock(7, 3));
  assert.equal(catalog.rewardCredits, 160);
  const snapshot = await detail(party.id, original);
  assert.equal(snapshot.catalogRevision, 1);
  assert.deepEqual(snapshot.cost, stock(6, 2));
  assert.equal(snapshot.rewardCreditsSnapshot, 100);
  await transitions(party.id, original, 'launch');
  await transitions(party.id, original, 'complete');
  await transitions(party.id, original, 'complete', 409);
  assert.equal((await detail(party.id, original)).history.length, 3);
  assert.equal((await state(party.id)).credits, 100);
  const third = (await prepare(party.id, 'M03')).body;
  await transitions(party.id, third.id, 'launch');
  await transitions(party.id, third.id, 'complete');
  const combined = await state(party.id);
  assert.equal(combined.credits, 190);
  assert.deepEqual(combined.inventory.onHand, stock(0, 0));

  const free = await newParty();
  const pending = (await prepare(free.id, 'M01')).body;
  await transitions(free.id, pending.id, 'cancel');
  assert.deepEqual((await state(free.id)).inventory.available, stock(10, 5));

  const transfer = await newParty('launch-transfer');
  const transferTrip = transfer.activeExpedition.id;
  const transferCatalog = (await send('GET', '/missions', 200, transfer.id)).body.find(mission => mission.id === 'M01');
  assert.deepEqual(transferCatalog.cost, stock(8, 4));
  await transitions(transfer.id, transferTrip, 'launch');
  await transitions(transfer.id, transferTrip, 'launch', 409);
  assert.deepEqual((await state(transfer.id)).inventory.onHand, stock(4, 3));
  assert.deepEqual((await detail(transfer.id, transferTrip)).history.map(item => item.toStatus), ['prepared', 'inFlight']);

  if (branch === 'A') return checks;

  const revised = await newParty('briefing');
  const old = revised.activeExpedition.id;
  await replace(revised.id, old, '2', 400);
  const stale = await replace(revised.id, old, 1, 409);
  assert.equal(stale.body.code, 'catalog_revision_mismatch');
  assert.equal((await detail(revised.id, old)).history.length, 1);
  const result = await replace(revised.id, old, 2, 201);
  const next = result.body;
  assert.equal(result.location, '/api/expeditions/' + next.id);
  assert.notEqual(next.id, old);
  assert.equal(next.replacesExpeditionId, old);
  assert.equal(next.catalogRevision, 2);
  assert.equal(next.rewardCreditsSnapshot, 160);
  assert.deepEqual(next.cost, stock(7, 3));
  const closed = await detail(revised.id, old);
  assert.equal(closed.status, 'cancelled');
  assert.deepEqual(closed.history.map(item => item.toStatus), ['prepared', 'cancelled']);
  const replaced = await state(revised.id);
  assert.equal(replaced.activeExpedition.id, next.id);
  assert.deepEqual(replaced.inventory.onHand, stock(10, 5));
  assert.deepEqual(replaced.inventory.reserved, stock(7, 3));
  await replace(revised.id, old, 2, 409);
  await transitions(revised.id, next.id, 'launch');
  await replace(revised.id, next.id, 2, 409);
  await transitions(revised.id, next.id, 'complete');
  const finished = await state(revised.id);
  assert.equal(finished.credits, 160);
  assert.deepEqual(finished.inventory.onHand, stock(3, 2));

  const boundary = await newParty('boundary');
  const boundaryOriginal = boundary.activeExpedition.id;
  await replace(boundary.id, boundaryOriginal, 2, 201);
  const limit = await state(boundary.id);
  assert.deepEqual(limit.inventory.onHand, stock(7, 3));
  assert.deepEqual(limit.inventory.available, stock(0, 0));

  for (const scenario of ['shortage', 'rations']) {
    const game = await newParty(scenario);
    const id = game.activeExpedition.id;
    const before = await state(game.id);
    const beforeDetail = await detail(game.id, id);
    const rejected = await replace(game.id, id, 2, 409);
    assert.equal(rejected.body.code, 'insufficient_supplies');
    assert.deepEqual(await state(game.id), before);
    assert.deepEqual(await detail(game.id, id), beforeDetail);
  }

  const concurrent = await newParty('briefing');
  const attempts = await Promise.all([1, 2].map(() => replace(concurrent.id, concurrent.activeExpedition.id, 2)));
  assert.deepEqual(attempts.map(item => item.status).sort(), [201, 409]);
  assert.equal((await state(concurrent.id)).expeditions.length, 2);
  return checks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base = 'http://127.0.0.1:5201', branch = 'B'] = process.argv.slice(2);
  if (branch !== 'A' && branch !== 'B') throw new Error('Ветка проверки должна быть A или B.');
  console.log('HTTP-проверки ветви ' + branch + ' пройдены. Запросов: ' + await checkApi(base, branch) + '.');
}
