import { spawn } from "node:child_process";

const quick = process.argv.includes("--quick");
const duration = process.argv.find(argument => argument.startsWith("--duration=")) || `--duration=${quick ? 20 : 600}`;
const forwarded = process.argv.slice(2).filter(argument => argument !== "--quick" && !argument.startsWith("--duration="));
const child = spawn(process.execPath, [
  "scripts/stress-12-player.mjs",
  "--two-v-two",
  "--players=4",
  "--speed=1",
  "--spawn-radius=160",
  "--performance=total",
  "--load-units=400",
  "--load-buildings=48",
  "--profile",
  duration,
  ...forwarded
], { stdio: "inherit" });

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
