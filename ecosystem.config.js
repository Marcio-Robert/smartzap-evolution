module.exports = {
  apps: [
    {
      name: "smartzap-evo",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      time: true
    }
  ]
}
