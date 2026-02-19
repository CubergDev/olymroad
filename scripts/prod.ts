import { existsSync } from "node:fs";

type Mode = "up" | "down" | "status" | "logs";

const ROOT = process.cwd();
const ENV_FILE = ".env";
const ENV_EXAMPLE_FILE = ".env.example";
const COMPOSE_PROJECT = "olymroad-prod";
const composeBaseArgs = ["compose", "--env-file", ENV_FILE, "-p", COMPOSE_PROJECT];

const run = async (command: string[], allowFailure = false) => {
  const [cmd, ...args] = command;
  console.log(`> ${cmd} ${args.join(" ")}`);

  const proc = Bun.spawn({
    cmd: [cmd, ...args],
    cwd: ROOT,
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0 && !allowFailure) {
    throw new Error(`Command failed with code ${exitCode}: ${cmd} ${args.join(" ")}`);
  }
};

const ensureEnvExists = () => {
  if (!existsSync(`${ROOT}/${ENV_FILE}`)) {
    throw new Error(`Missing ${ENV_FILE}. Create it from ${ENV_EXAMPLE_FILE} first.`);
  }
};

const up = async () => {
  await run(["docker", ...composeBaseArgs, "up", "-d", "--wait", "postgres", "minio"]);
  await run(["docker", ...composeBaseArgs, "run", "--rm", "minio-init"]);
  await run(["docker", ...composeBaseArgs, "run", "--rm", "migrate"]);
  await run(["bun", "run", "--filter", "@olymroad/api", "build"]);
  await run(["bun", "--env-file=.env", "run", "--filter", "@olymroad/web", "build"]);
  await run([
    "bunx",
    "pm2",
    "startOrReload",
    "ecosystem.config.cjs",
    "--env",
    "production",
    "--update-env",
  ]);
  await run(["bunx", "pm2", "save"], true);
};

const down = async () => {
  await run(["bunx", "pm2", "delete", "ecosystem.config.cjs"], true);
  await run(["docker", ...composeBaseArgs, "down"]);
};

const status = async () => {
  await run(["bunx", "pm2", "status"], true);
  await run(["docker", ...composeBaseArgs, "ps"], true);
};

const logs = async () => {
  await run(["bunx", "pm2", "logs", "--lines", "100"]);
};

const main = async () => {
  ensureEnvExists();

  const mode = (process.argv[2] as Mode | undefined) ?? "up";

  if (mode === "up") {
    await up();
    return;
  }
  if (mode === "down") {
    await down();
    return;
  }
  if (mode === "status") {
    await status();
    return;
  }
  if (mode === "logs") {
    await logs();
    return;
  }

  throw new Error(`Unknown mode: ${mode}. Expected one of: up, down, status, logs.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
