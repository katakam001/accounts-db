module.exports = {
  apps: [{
    name: "accounts-db",
    script: "./src/index.js",
    cwd: "/home/ec2-user/accounts-db",
    env_production: {
      NODE_ENV: "production"
    }
  }]
};
