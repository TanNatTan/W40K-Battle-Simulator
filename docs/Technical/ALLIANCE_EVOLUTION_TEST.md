# 2v2 Alliance Evolution Test

This is a repeatable browser playtest for Imperial Fists and Blood Angels against the Ironjaw Mob and Bad Moon Mob. Every normal iteration runs for 10 real minutes on a 1920×1080 map at 4× simulation speed with 160 px spawn zones. A failed faction, logistics, or frame-pacing requirement restarts the battle with a new deterministic seed while retaining the same browser profile for learning memory. Release acceptance requires three consecutive passing iterations.

Run `npm run test:alliance-evolution`. Use `npm run test:alliance-evolution:quick` only to validate browser setup and telemetry; the quick mode does not replace the ten-minute acceptance run.

## Shared requirements

- The selected battle objective remains active.
- Economy, builders, unit production, building production, vehicles, forward logistics, and map presence remain operational.
- Average FPS is at least 50, 1% low FPS is at least 30, no rolling five-second window falls below 30 FPS, p95 frame time is at most 33.3 ms, no frame exceeds 250 ms, and FPS does not progressively decline.

## Imperial Fists

- At least 100 infantry in 10 viable squads, with at least 20% heavy/ranged specialists.
- At least two defended forward positions and four vehicles or Dreadnoughts.
- Evidence of counterattacking, offensive contribution, and support for the Blood Angels.

## Blood Angels

- At least 100 infantry in 10 viable squads, with at least 25% assault/mobile-melee specialists.
- Jump-pack engagement and regroup behavior, at least three fast vehicles/transports, objective presence, and support for the Imperial Fists.

## Ironjaw Mob

- At least 120 combat infantry in 12 viable mobs, with at least 55% melee strength.
- Slugga, Nob, and Tankbusta presence; four walkers/transports; two Waaagh banner anchors; multiple mob concentrations; and vehicle support.

## Bad Moon Mob

- At least 120 combat infantry in 12 viable mobs, with at least 45% ranged strength.
- Shoota, Tankbusta, Nob, and Big Mek presence; four machinery assets; sustained scrap/ammunition; two Waaagh banner anchors; and surviving Mek infrastructure.

JSON reports are written to `reports/alliance-evolution/` so a failed run can be compared with the following iteration.
