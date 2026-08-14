import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";

import { ALLIANCE_EVOLUTION_RULES } from "../src/testing/AllianceEvolutionTestSystem.js";

const argumentValue = name => process.argv.find(argument => argument.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const quick = process.argv.includes("--quick");
const durationSeconds = Math.max(10, Number(argumentValue("duration")) || (quick ? 20 : ALLIANCE_EVOLUTION_RULES.runDurationMs / 1000));
const requiredStreak = Math.max(1, Math.floor(Number(argumentValue("passes")) || (quick ? 1 : ALLIANCE_EVOLUTION_RULES.consecutivePasses)));
const maximumAttempts = argumentValue("max-attempts") == null ? Infinity : Math.max(1, Math.floor(Number(argumentValue("max-attempts")) || 1));
const profile = mkdtempSync(join(tmpdir(), "awt-alliance-evolution-"));
const reportDirectory = resolve(argumentValue("reports") || "reports/alliance-evolution");
const serverPort = Math.max(1024, Math.floor(Number(argumentValue("server-port")) || 41735));
const browser = argumentValue("browser") || (process.platform === "win32" ? "edge" : "chrome");
let consecutivePasses = 0;
let attempt = 0;

const run = (args, report) => new Promise(resolveRun => {
  const child = spawn(process.execPath, ["scripts/stress-12-player.mjs", ...args], {
    cwd: process.cwd(),
    stdio: ["ignore", "inherit", "inherit"]
  });
  child.once("exit", code => resolveRun({ code: Number(code) || 0, report }));
});

try {
  while (consecutivePasses < requiredStreak && attempt < maximumAttempts) {
    attempt += 1;
    const report = join(reportDirectory, `iteration-${String(attempt).padStart(3, "0")}.json`);
    console.log(`\nAlliance evolution iteration ${attempt}: ${durationSeconds}s at 4x; pass streak ${consecutivePasses}/${requiredStreak}.`);
    const args = [
      "--alliance-evolution",
      "--two-v-two",
      "--players=4",
      "--speed=4",
      "--spawn-radius=160",
      "--performance=total",
      `--browser=${browser}`,
      `--duration=${durationSeconds}`,
      `--iteration=${attempt}`,
      `--server-port=${serverPort}`,
      `--profile-dir=${profile}`,
      `--report=${report}`
    ];
    if (quick) args.push("--alliance-evolution-smoke");
    const result = await run(args, report);
    let evaluationPassed = result.code === 0;
    if (existsSync(report)) {
      try {
        const parsed = JSON.parse(readFileSync(report, "utf8"));
        evaluationPassed = quick ? result.code === 0 : result.code === 0 && parsed.alliance?.evaluation?.passed === true;
        console.log(`Iteration ${attempt}: ${evaluationPassed ? "PASS" : "RESTART"}; avg ${parsed.averageRafFps?.toFixed?.(1) || parsed.averageRafFps} FPS, 1% low ${parsed.alliance?.performance?.onePercentLowFps?.toFixed?.(1) || "n/a"} FPS.`);
        if (!evaluationPassed && parsed.alliance?.evaluation?.failed?.length) console.log(parsed.alliance.evaluation.failed.join("\n"));
      } catch (error) {
        console.warn(`Could not read ${report}: ${error.message}`);
        evaluationPassed = false;
      }
    }
    consecutivePasses = evaluationPassed ? consecutivePasses + 1 : 0;
  }
  if (consecutivePasses < requiredStreak) throw new Error(`Evolution test ended after ${attempt} attempts with a ${consecutivePasses}/${requiredStreak} pass streak.`);
  console.log(`Alliance evolution passed ${requiredStreak} consecutive iterations. Persistent browser storage was retained across restarts.`);
} finally {
  for (let retry = 0; retry < 8; retry += 1) {
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
      break;
    } catch (error) {
      if (retry === 7) console.warn(error.message);
      else await new Promise(resolveDelay => setTimeout(resolveDelay, 200));
    }
  }
}
