const envFile = "../../.env";
const apiPort = process.env.PORT || "8274";
const webPort = process.env.WEB_PORT || "5123";

module.exports = {
  apps: [
    {
      name: "olymroad-api",
      cwd: "./apps/api",
      script: "bun",
      args: `--env-file=${envFile} run dist/index.js`,
      interpreter: "none",
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 10,
      watch: false,
      time: true,
      env_production: {
        NODE_ENV: "production",
        PORT: apiPort,
      },
    },
    {
      name: "olymroad-web",
      cwd: ".",
      script: "bun",
      args: `run --filter @olymroad/web preview -- --host 0.0.0.0 --port ${webPort}`,
      interpreter: "none",
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 10,
      watch: false,
      time: true,
      env_production: {
        NODE_ENV: "production",
        WEB_PORT: webPort,
      },
    },
  ],
};
