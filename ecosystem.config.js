module.exports = {
  apps: [
    {
      name: "monitoreo-frontend",
      script: "node_modules\\next\\dist\\bin\\next",
      args: "start -p 3020",
      cwd: "C:\\monitoreo-prodominicana\\apps\\frontend",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 3020,
      },
    }
  ]
}