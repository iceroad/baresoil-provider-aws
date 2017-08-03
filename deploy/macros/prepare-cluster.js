const _ = require('lodash'),
  assert = require('assert'),
  async = require('async'),
  chalk = require('chalk'),
  deployUtil = require('../util'),
  json = JSON.stringify
  ;

function prepareCluster(base) {
  const tfState = deployUtil.getTerraformOutputs();
  const clusterConfig = deployUtil.getClusterConfig(base.getDiskConfig());
  const sshPrivKeyPath = clusterConfig.credentials.ssh.privatePath;
  const bastionIp = _.get(tfState, 'bastionIp.value');
  if (!bastionIp) {
    console.error(
      'Cannot find bastion node IP address in Terraform output; ' +
        'did you run "terraform apply" in the "terraform" directory?');
    return process.exit(1);
  }
  const dbAddress = _.get(tfState, 'pgAddress.value');
  const dbPort = _.get(tfState, 'pgPort.value');
  const linkPort = _.random(8000, 32768);

  // Make remote command runner.
  const runAsync = deployUtil.makeRemoteCommandRunnerAsync(bastionIp, sshPrivKeyPath);
  const run = deployUtil.makeRemoteCommandRunner(bastionIp, sshPrivKeyPath);

  async.auto({
    // Check remote OS issue
    osIssue: (cb) => {
      runAsync('cat /etc/issue', 'Checking bastion host OS issue...', (err, result) => {
        if (err) return cb(err);
        const etcIssue = result.stdout.join(' ');
        assert(etcIssue.match(/Ubuntu/i), `Non-Ubuntu OS found on bastion: ${etcIssue}`);
        return cb();
      });
    },

    // Install simpleproxy
    simpleproxy: ['osIssue', (deps, cb) => runAsync(
      'sudo apt-get install -y simpleproxy',
      'Installing simpleproxy on remote host using apt-get...', cb)],

    // Check remote simpleproxy version
    simpleProxyVersion: ['simpleproxy', (deps, cb) => runAsync(
      'simpleproxy -V 2>&1', 'Checking remote simpleproxy version...', cb)],

    // Create simpleproxy link over ssh.
    proxyLink: ['simpleProxyVersion', (deps, cb) => {
      const proxyCmd = `simpleproxy -L :${linkPort} -R ${dbAddress}:${dbPort}`;
      const sshCmd = [
        'ssh',
        `-i ${json(sshPrivKeyPath)}`,
        `-L ${linkPort}:localhost:${linkPort}`,
        '-o StrictHostKeyChecking=no',
        `ubuntu@${bastionIp}`,
        JSON.stringify(proxyCmd),
      ].join(' ');

      // Start proxy link and wait 3 seconds for it to become live.
      const cbOnce = _.once(cb);
      const child = deployUtil.runLocalCommandAsync(
        sshCmd,
        `Setting up ssh/simpleproxy link to ${chalk.bold(dbAddress)} ` +
          `on port ${linkPort}...`,
        bastionIp, cbOnce);
      _.delay(() => cbOnce(null, child), 3000);
    }],

    // Start setup-postgres CLI command.
    setupPostgres: ['proxyLink', (deps, cb) => {
      const setupPgCmd = base.getCliCommand('setup-postgres').impl;
      const setupPgOpt = {
        host: '127.0.0.1',
        port: linkPort,
        rootUser: clusterConfig.rds.root.username,
        rootPassword: clusterConfig.rds.root.password,
        rootDatabase: clusterConfig.rds.root.database,
        user: clusterConfig.rds.user.username,
        password: clusterConfig.rds.user.password,
        database: clusterConfig.rds.user.database,
      };
      return setupPgCmd.$core(setupPgOpt, cb);
    }],

    // Copy master SSH private key to bastion.
    setupBastion: ['setupPostgres', (deps, cb) => {
      const scpCmd = [
        'scp',
        `-i ${json(sshPrivKeyPath)}`,
        '-o StrictHostKeyChecking=no',
        `${json(sshPrivKeyPath)}`,
        `ubuntu@${bastionIp}:master-key`,
      ].join(' ');
      return deployUtil.runLocalCommandAsync(
        scpCmd, 'Copying master-key to bastion node...', bastionIp, cb);
    }],

  }, (err, results) => {
    // Kill proxy link regardless of the outcome.
    if (results.proxyLink) {
      run('pkill simpleproxy', 'Killing remote simpleproxy processes...');
    }

    if (err) {
      console.error(err);
      return process.exit(1);
    }
    console.log(chalk.green.bold('All done, you can now run "baresoil-server build-image".'));
    return process.exit(0);
  });
}

module.exports = prepareCluster;
