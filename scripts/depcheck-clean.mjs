import { spawnSync } from "node:child_process";
import path from "node:path";

const IGNORED_INVALID_FILES = new Set(["tsconfig.app.json", "tsconfig.node.json"]);

function runDepcheck() {
  const cmd = "npx depcheck --json --ignores=autoprefixer,postcss";
  return spawnSync(cmd, {
    cwd: process.cwd(),
    shell: true,
    encoding: "utf8",
    env: process.env,
  });
}

function parseOutput(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const maybeJson = trimmed.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
}

function sanitize(report) {
  const invalidFiles = Object.fromEntries(
    Object.entries(report.invalidFiles || {}).filter(
      ([file]) => !IGNORED_INVALID_FILES.has(path.basename(file)),
    ),
  );

  return {
    dependencies: report.dependencies || [],
    devDependencies: report.devDependencies || [],
    missing: report.missing || {},
    invalidFiles,
    invalidDirs: report.invalidDirs || {},
  };
}

function printSummary(report) {
  const counts = {
    dependencies: report.dependencies.length,
    devDependencies: report.devDependencies.length,
    missing: Object.keys(report.missing).length,
    invalidFiles: Object.keys(report.invalidFiles).length,
    invalidDirs: Object.keys(report.invalidDirs).length,
  };

  console.log("depcheck summary:");
  console.log(`- unused dependencies: ${counts.dependencies}`);
  console.log(`- unused devDependencies: ${counts.devDependencies}`);
  console.log(`- missing dependencies: ${counts.missing}`);
  console.log(`- invalid files: ${counts.invalidFiles}`);
  console.log(`- invalid dirs: ${counts.invalidDirs}`);

  if (counts.dependencies || counts.devDependencies || counts.missing || counts.invalidFiles || counts.invalidDirs) {
    const details = {
      dependencies: report.dependencies,
      devDependencies: report.devDependencies,
      missing: report.missing,
      invalidFiles: report.invalidFiles,
      invalidDirs: report.invalidDirs,
    };
    console.log("\ndepcheck details:");
    console.log(JSON.stringify(details, null, 2));
  }
}

function main() {
  const run = runDepcheck();
  if (run.status !== 0) {
    process.stdout.write(run.stdout || "");
    process.stderr.write(run.stderr || "");
    process.exit(run.status ?? 1);
  }

  const parsed = parseOutput(run.stdout);
  if (!parsed) {
    process.stdout.write(run.stdout || "");
    process.stderr.write(run.stderr || "");
    console.error("\nCould not parse depcheck JSON output.");
    process.exit(1);
  }

  const clean = sanitize(parsed);
  printSummary(clean);
}

main();
