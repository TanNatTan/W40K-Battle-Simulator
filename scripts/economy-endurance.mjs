import { runAllFactionEconomyEndurance } from "../src/testing/EconomyEnduranceTest.js";

const results = runAllFactionEconomyEndurance({ durationMinutes: 60 });
console.log(JSON.stringify({ durationMinutes: 60, passed: results.every(result => result.pass), results }, null, 2));
if (results.some(result => !result.pass)) process.exitCode = 1;
