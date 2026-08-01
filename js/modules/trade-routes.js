(() => {
  const modules = window.AWTModules ||= {};
  const establishmentCost = Object.freeze({ influence: 40, materials: 25 });

  modules.tradeRoutes = Object.freeze({
    establishmentCost,
    canEstablish({ partner, economy, headquarters, warehouse }) {
      if (!partner || partner.established) return { allowed: false, reason: "already-established" };
      if (!headquarters || !warehouse) return { allowed: false, reason: "infrastructure" };
      const funded = Object.entries(partner.establishmentCost || establishmentCost)
        .every(([resource, amount]) => (economy.inventory[resource] || 0) >= amount);
      return funded ? { allowed: true } : { allowed: false, reason: "resources" };
    },
    activate(partner, simulationTime, playerIndex) {
      partner.established = true;
      partner.establishedAt = simulationTime;
      partner.nextDispatch = simulationTime + 28 + playerIndex * 4;
      return partner;
    }
  });
})();

