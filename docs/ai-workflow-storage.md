# AI workflow and storage

The runtime uses one shared, observable decision pipeline:

1. assess economy;
2. assess territory;
3. assess military strength and vehicle composition;
4. assess visible enemy pressure;
5. determine unmet needs;
6. create a priority queue;
7. execute through the existing construction, production, territory, and combat systems.

The workflow does not replace faction or subfaction doctrine. Doctrine changes the inputs and available actions; `DecisionWorkflowSystem` provides a consistent pipeline and exposes the current priority to the AI Inspector and runtime telemetry.

Static definitions remain in versioned JSON under `data/`. Local, evolving simulation records use IndexedDB through `SimulationDatabase`. Its stores are:

- `battleSnapshots`
- `factionAnalytics`
- `maps`
- `replays`
- `settings`

Battle snapshots and faction analytics are written now. Maps, replay payloads, and settings have reserved stores so later persistence can move out of `localStorage` without a schema break. No server database is required for local battles.
