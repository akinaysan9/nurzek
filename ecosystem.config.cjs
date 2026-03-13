module.exports = {
  apps: [
    {
      name: "nurzeka-backend",
      script: "server.js",
      cwd: "/www/wwwroot/nurzek/backend",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3001
      }
    },
    {
      name: "nurzeka-rag",
      script: "/www/wwwroot/nurzek/rag_service/start_rag.sh",
      cwd: "/www/wwwroot/nurzek/rag_service",
      interpreter: "bash",
      autorestart: true,
      watch: false,
      max_memory_restart: "2000M",
      restart_delay: 5000,
      env: {
        PYTHONPATH: "/www/wwwroot/nurzek/rag_service"
      }
    }
  ]
};
