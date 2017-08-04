const chalk = require('chalk'),
  cpuUsage = require('./cpu-usage'),
  os = require('os'),
  http = require('http')
;

class HealthServer {
  init(deps, cb) {
    const config = deps.Config.HealthServer;
    const server = this.server_ = http.createServer((req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        username: os.userInfo().username,
        hostname: os.hostname(),
        time: Date.now(),
        pid: process.pid,
        cpuUsage: cpuUsage(),
        memUsage: (1.0 - (os.freemem() / os.totalmem())),
        stats: deps.Hub.getStats(),
      }, null, 2));
    });
    server.listen(config.port, '0.0.0.0', () => {
      console.debug(`Health server listening on port ${chalk.bold(config.port)}...`);
      return cb();
    });
    server.once('error', cb);
  }

  destroy(deps, cb) {
    return this.server_.close(cb);
  }
}


HealthServer.prototype.$spec = {
  name: 'HealthServer',
  deps: ['Config', 'Hub'],
  config: {
    type: 'object',
    desc: 'Options for an AWS ELB health check endpoint.',
    fields: {

      port: {
        type: 'integer',
        desc: 'Port for health server to listen on.',
      },

    },
  },
  defaults: {
    port: 8911,
  },
};


module.exports = HealthServer;
