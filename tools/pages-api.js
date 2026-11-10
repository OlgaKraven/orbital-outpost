(() => {
  const storageKey = 'outpost-pages-e01';
  let party;
  let fixtures;

  async function load(name) {
    const response = await fetch(name);
    if (!response.ok) throw new Error('Не удалось загрузить исходные данные E01.');
    return response.json();
  }

  function subtract(stock, cost) {
    return { fuel: stock.fuel - cost.fuel, rations: stock.rations - cost.rations };
  }

  function gameState() {
    const { id, scenario, trip } = party;
    const prepared = trip.status === 'prepared';
    const onHand = prepared ? scenario.stock : subtract(scenario.stock, trip.cost);
    const reserved = prepared ? trip.cost : { fuel: 0, rations: 0 };
    const { cost, createdAtUtc, history, ...summary } = trip;
    return { id, scenarioId: scenario.id, credits: 0, activeExpedition: summary, expeditions: [summary],
      inventory: { onHand, reserved, available: subtract(onHand, reserved) } };
  }

  const fault = (status, code, title) => Response.json({ code, title }, { status });

  window.outpostBrowserApi = async (method, path, data, partyId) => {
    const url = new URL(path, location.origin);
    const custom = url.pathname === '/api/demo/games/custom';
    if (method === 'POST' && (url.pathname === '/api/demo/games' || custom)) {
      const scenarioId = custom ? 'custom' : url.searchParams.get('scenario');
      if (!custom && !['briefing', 'launch-transfer'].includes(scenarioId)) {
        return fault(400, 'unknown_scenario', 'Для практики в браузере выберите один из двух вариантов E01.');
      }
      const error = custom ? customGameError(data) : null;
      if (error) return fault(400, error.code, error.title);
      fixtures ??= await Promise.all([load('seed.json'), load('scenarios.json')]);
      const [seed, rules] = fixtures;
      const scenario = custom ? { id: scenarioId, stock: data.stock, prepareMissionId: rules.revision.id } :
        rules.scenarios.find(item => item.id === scenarioId);
      const original = seed.missions.find(item => item.id === scenario.prepareMissionId);
      const mission = custom ? { ...original, ...data.snapshot } : original;
      const revision = custom ? { ...rules.revision, ...data.catalog } :
        { ...rules.revision, cost: scenario.catalogCost ?? rules.revision.cost };
      const createdAtUtc = new Date().toISOString();
      party = { id: crypto.randomUUID(), scenario,
        catalog: seed.missions.map(item => item.id === rules.revision.id
          ? revision
          : { ...item, revision: 1 }),
        trip: { id: crypto.randomUUID(), missionId: mission.id, cost: mission.cost, status: 'prepared',
          rewardCreditsSnapshot: mission.rewardCredits, catalogRevision: 1, replacesExpeditionId: null, createdAtUtc,
          history: [{ sequence: 1, fromStatus: null, toStatus: 'prepared', changedAtUtc: createdAtUtc }] } };
      saveLocal(storageKey, party, 'sessionStorage');
      return Response.json(gameState());
    }

    party ??= readLocal(storageKey, null, 'sessionStorage');
    if (!party || party.id !== partyId) return fault(404, 'game_not_found', 'Откройте новую партию E01.');
    const tripPath = '/api/expeditions/' + party.trip.id;
    if (method === 'GET' && url.pathname === '/api/game') return Response.json(gameState());
    if (method === 'GET' && url.pathname === '/api/missions') return Response.json(party.catalog);
    if (method === 'GET' && url.pathname === tripPath) return Response.json(party.trip);
    if (method === 'POST' && url.pathname === tripPath + '/transitions') {
      if (data?.action !== 'launch') return fault(400, 'invalid_action', 'Команда запуска должна содержать action: launch.');
      if (party.trip.status !== 'prepared') return fault(409, 'invalid_transition', 'Рейс уже запущен.');
      party.trip.status = 'inFlight';
      party.trip.history.push({ sequence: 2, fromStatus: 'prepared', toStatus: 'inFlight', changedAtUtc: new Date().toISOString() });
      saveLocal(storageKey, party, 'sessionStorage');
      return Response.json(party.trip);
    }
    return fault(404, 'unknown_route', 'Эта операция доступна в полной серверной версии.');
  };
})();
