/**
 * PM2 Ecosystem Configuration — NurZeka
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs          # start all
 *   pm2 start ecosystem.config.cjs --only nurzeka-outbox
 *   pm2 reload ecosystem.config.cjs         # zero-downtime reload (Node apps)
 *   pm2 save && pm2 startup                 # persist across reboots
 */
module.exports = {
  apps: [
    {
      name: 'nurzeka-backend',
      script: 'server.js',
      cwd: '/www/wwwroot/nurzek/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    {
      name: 'nurzeka-rag',
      script: '/www/wwwroot/nurzek/rag_service/start_rag.sh',
      cwd: '/www/wwwroot/nurzek/rag_service',
      interpreter: 'bash',
      autorestart: true,
      watch: false,
      max_memory_restart: '2000M',
      restart_delay: 5000,
      env: {
        PYTHONPATH: '/www/wwwroot/nurzek/rag_service',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    {
      // Outbox worker — long-lived daemon, NOT cron.
      // Polls audit_outbox every OUTBOX_POLL_INTERVAL_MS ms.
      // Backs off exponentially on consecutive DB errors.
      // MUST be instances:1 — FOR UPDATE SKIP LOCKED requires single consumer.
      // Only effective when PG_DATABASE_URL is set in /www/wwwroot/nurzek/backend/.env
      name: 'nurzeka-outbox',
      script: 'scripts/outbox_worker.js',
      cwd: '/www/wwwroot/nurzek/backend',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '100M',
      restart_delay: 5000,
      max_restarts: 20,
      env: {
        NODE_ENV: 'production',
        OUTBOX_BATCH_SIZE: 50,
        OUTBOX_POLL_INTERVAL_MS: 5000,
        OUTBOX_MAX_CONSECUTIVE_ERRORS: 5,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};

