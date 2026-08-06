import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

const roots = ["src", "js", "test", "scripts"];
const files = [];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if ([".js", ".mjs"].includes(extname(entry.name))) files.push(path);
  }
}

for (const root of roots) collect(root);
for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

execFileSync(process.execPath, ["--test"], { stdio: "inherit" });
console.log(`Checked ${files.length} JavaScript files.`);
