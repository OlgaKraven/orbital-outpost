import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { checkApi } from '../student/check-api.mjs';

const appDirectory = resolve(process.argv[2] ?? 'run');
const legacyDirectory = process.argv[3] ? resolve(process.argv[3]) : null;
const scratch = await mkdtemp(join(tmpdir(), 'outpost-check-'));
const dbPath = join(scratch, 'check.db');
const baseUrl = 'http://127.0.0.1:' + (process.env.OUTPOST_CHECK_PORT ?? '5194');
let processHandle;
let log = '';
let checks = 0;

async function start(directory = appDirectory) {
  log = '';
  processHandle = spawn('dotnet', ['OrbitalOutpost.dll', '--urls', baseUrl, '--GameDatabase', dbPath], {
    cwd: directory,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  processHandle.stdout.on('data', data => { log += data; });
  processHandle.stderr.on('data', data => { log += data; });
  processHandle.on('error', error => { log += error.message; });
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(baseUrl + '/');
      if (response.ok && (await response.text()).includes('Орбитальный форпост')) return;
    } catch { /* Wait for Kestrel to open the local port. */ }
    if (processHandle.exitCode !== null) break;
    await delay(100);
  }
  throw new Error('Приложение не запустилось.\n' + log);
}

async function stop() {
  if (!processHandle?.pid || processHandle.exitCode !== null) return;
  const closed = new Promise(resolveClose => processHandle.once('close', resolveClose));
  processHandle.kill();
  await closed;
}

async function api(path, status, { game, method = 'GET', payload } = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (game) headers.set('X-Game-Id', game);
  if (payload !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(baseUrl + '/api' + path, {
    method, headers, body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  const body = await response.json();
  if (status !== undefined) assert.equal(response.status, status, method + ' ' + path + ' ' + JSON.stringify(body));
  checks++;
  return { body, status: response.status, location: response.headers.get('Location') };
}

async function newGame() {
  const result = await api('/demo/games', 200, { method: 'POST' });
  assert.deepEqual(result.body.inventory.available, { fuel: 10, rations: 5 });
  assert.equal(result.body.credits, 0);
  return result.body.id;
}

const state = async game => (await api('/game', 200, { game })).body;
const prepare = (game, missionId, expected = 201) => api('/expeditions', expected, { game, method: 'POST', payload: { missionId } });
const transition = (game, id, action, expected = 200) =>
  api('/expeditions/' + id + '/transitions', expected, { game, method: 'POST', payload: { action } });
const detail = async (game, id) => (await api('/expeditions/' + id, 200, { game })).body;

async function finish(game, mission) {
  const { body } = await prepare(game, mission);
  await transition(game, body.id, 'launch');
  await transition(game, body.id, 'complete');
  return body.id;
}

try {
  if (legacyDirectory) {
    await start(legacyDirectory);
    const legacyGame = await newGame();
    const original = (await prepare(legacyGame, 'M01')).body;
    await api('/demo/catalog-revision', 200, { game: legacyGame, method: 'POST' });
    await stop();
    await start();
    const migrated = await detail(legacyGame, original.id);
    const current = (await api('/missions', 200, { game: legacyGame })).body.find(mission => mission.id === 'M01');
    assert.equal(migrated.catalogRevision, 1);
    assert.equal(migrated.rewardCreditsSnapshot, 100);
    assert.equal(migrated.replacesExpeditionId, null);
    assert.equal(current.revision, 2);
    assert.equal(current.rewardCredits, 160);
    assert.deepEqual((await state(legacyGame)).inventory.reserved, { fuel: 6, rations: 2 });
    await stop();
  }
  await start();
  for (const [path, anchor] of [['/reference.html', 'lab-7'], ['/brief.html', 'source-b1']]) {
    const document = await fetch(baseUrl + path, { redirect: 'manual' });
    assert.equal(document.status, 200, path);
    assert.ok((await document.text()).includes(`id="${anchor}"`), path + '#' + anchor);
    checks++;
  }
  const inputs = await fetch(baseUrl + '/study/fixtures');
  assert.equal(inputs.status, 200);
  assert.deepEqual(await inputs.json(), {
    seed: JSON.parse(await readFile(join(appDirectory, 'data/seed.json'), 'utf8')),
    scenarios: JSON.parse(await readFile(join(appDirectory, 'data/scenarios.json'), 'utf8'))
  });
  checks++;
  const transfer = (await api('/demo/games?scenario=launch-transfer', 200, { method: 'POST' })).body;
  const republished = (await api('/demo/catalog-revision', 200, { game: transfer.id, method: 'POST' })).body;
  assert.equal(republished.revision, 2);
  assert.deepEqual(republished.cost, { fuel: 8, rations: 4 });
  const transferCatalog = (await api('/missions', 200, { game: transfer.id })).body;
  assert.deepEqual(transferCatalog.find(mission => mission.id === 'M01'), republished);
  assert.deepEqual((await detail(transfer.id, transfer.activeExpedition.id)).cost, { fuel: 6, rations: 2 });
  const customInputs = {
    stock: { fuel: 14, rations: 8 },
    snapshot: { cost: { fuel: 5, rations: 3 }, rewardCredits: 120 },
    catalog: { cost: { fuel: 11, rations: 7 }, rewardCredits: 175 }
  };
  const createCustom = (payload, status = 200) => api('/demo/games/custom', status, { method: 'POST', payload });
  assert.equal((await createCustom({ ...customInputs, stock: { fuel: 14, rations: 2 } }, 400)).body.code,
    'snapshot_exceeds_stock');
  assert.equal((await createCustom({ ...customInputs, snapshot: { cost: { fuel: 5 }, rewardCredits: 120 } }, 400)).body.code,
    'invalid_custom_values');
  await createCustom({ ...customInputs, stock: { fuel: '14', rations: 8 } }, 400);
  const { body: custom } = await createCustom(customInputs);
  const customTrip = custom.activeExpedition.id;
  assert.equal(custom.scenarioId, 'custom');
  assert.deepEqual(custom.inventory, { onHand: customInputs.stock, reserved: customInputs.snapshot.cost,
    available: { fuel: 9, rations: 5 } });
  const customCatalog = (await api('/missions', 200, { game: custom.id })).body.find(mission => mission.id === 'M01');
  assert.equal(customCatalog.revision, 2);
  assert.deepEqual(customCatalog.cost, customInputs.catalog.cost);
  assert.equal(customCatalog.rewardCredits, 175);
  const customSnapshot = await detail(custom.id, customTrip);
  assert.deepEqual(customSnapshot.cost, customInputs.snapshot.cost);
  assert.equal(customSnapshot.rewardCreditsSnapshot, 120);
  await transition(custom.id, customTrip, 'launch');
  const customLaunched = await state(custom.id);
  assert.deepEqual(customLaunched.inventory.onHand, { fuel: 9, rations: 5 });
  await transition(custom.id, customTrip, 'launch', 409);
  assert.deepEqual(await state(custom.id), customLaunched);
  await transition(custom.id, customTrip, 'complete');
  const customCompleted = await state(custom.id);
  assert.equal(customCompleted.credits, 120);
  const main = await newGame();
  const catalog = (await api('/missions', 200, { game: main })).body;
  assert.deepEqual(catalog.map(mission => mission.id), ['M01', 'M02', 'M03']);
  assert.deepEqual(catalog[0].cost, { fuel: 6, rations: 2 });
  assert.equal(catalog[0].rewardCredits, 100);
  await api('/game', 400);
  await api('/game', 404, { game: '00000000-0000-0000-0000-000000000000' });
  await prepare(main, 'M99', 404);
  await prepare(main, '', 400);

  const { body: first, location } = await prepare(main, 'M01');
  assert.equal(location, '/api/expeditions/' + first.id);
  assert.equal(first.history[0].fromStatus, null);
  assert.equal(first.status, 'prepared');
  const prepared = await state(main);
  assert.deepEqual(prepared.inventory, {
    onHand: { fuel: 10, rations: 5 }, reserved: { fuel: 6, rations: 2 }, available: { fuel: 4, rations: 3 }
  });
  await prepare(main, 'M03', 409);
  await transition(main, first.id, 'complete', 409);
  assert.deepEqual(await state(main), prepared);
  await transition(main, first.id, 'launch');
  const launched = await state(main);
  assert.deepEqual(launched.inventory.onHand, { fuel: 4, rations: 3 });
  assert.deepEqual(launched.inventory.reserved, { fuel: 0, rations: 0 });
  await transition(main, first.id, 'launch', 409);
  await transition(main, first.id, 'cancel', 409);
  await transition(main, first.id, 'complete');
  await transition(main, first.id, 'complete', 409);
  const done = await detail(main, first.id);
  assert.deepEqual(done.history.map(event => event.toStatus), ['prepared', 'inFlight', 'completed']);
  assert.deepEqual(done.history.map(event => event.sequence), [1, 2, 3]);
  assert.ok(done.history.every(event => Number.isFinite(Date.parse(event.changedAtUtc))));
  assert.equal((await state(main)).credits, 100);
  assert.equal((await prepare(main, 'M01', 409)).body.code, 'mission_completed');
  assert.equal((await prepare(main, 'M02', 409)).body.code, 'insufficient_supplies');
  await finish(main, 'M03');
  const combined = await state(main);
  assert.equal(combined.credits, 190);
  assert.deepEqual(combined.inventory.onHand, { fuel: 0, rations: 0 });

  const single = await newGame();
  await finish(single, 'M02');
  const singleState = await state(single);
  assert.equal(singleState.credits, 150);
  assert.deepEqual(singleState.inventory.onHand, { fuel: 2, rations: 4 });
  await api('/expeditions/' + first.id, 404, { game: single });

  const revision = await newGame();
  const { body: cancelled } = await prepare(revision, 'M01');
  await transition(revision, cancelled.id, 'cancel');
  assert.deepEqual((await state(revision)).inventory.available, { fuel: 10, rations: 5 });
  const { body: snapshot } = await prepare(revision, 'M01');
  const updated = (await api('/demo/catalog-revision', 200, { game: revision, method: 'POST' })).body;
  assert.deepEqual(updated.cost, { fuel: 7, rations: 3 });
  assert.equal(updated.rewardCredits, 160);
  await transition(revision, snapshot.id, 'launch');
  const result = (await transition(revision, snapshot.id, 'complete')).body;
  assert.equal(result.rewardCreditsSnapshot, 100);
  assert.deepEqual(result.cost, { fuel: 6, rations: 2 });
  assert.deepEqual((await state(revision)).inventory.onHand, { fuel: 4, rations: 3 });

  const concurrent = await newGame();
  const attempts = await Promise.all(['M01', 'M03'].map(missionId =>
    api('/expeditions', undefined, { game: concurrent, method: 'POST', payload: { missionId } })));
  assert.deepEqual(attempts.map(result => result.status).sort(), [201, 409]);
  assert.equal((await state(concurrent)).expeditions.length, 1);

  const caseChecks = await checkApi(baseUrl);
  await stop();
  await start();
  assert.deepEqual(await state(main), combined);
  assert.deepEqual(await state(custom.id), customCompleted);
  assert.deepEqual(await detail(main, first.id), done);
  process.stdout.write('Пройдено ' + (checks + caseChecks) + ' HTTP-проверок. Подтверждены обе ветви донесения, дефицит, граница, конкуренция и перезапуск.\n');
} catch (error) {
  process.stderr.write(log);
  throw error;
} finally {
  await stop();
  await rm(scratch, { recursive: true, force: true });
}
