const _ = require('lodash'),
  chalk = require('chalk'),
  helpers = require('../../util/helpers'),
  inquirer = require('inquirer'),
  json = JSON.stringify,
  spawnSync = require('child_process').spawnSync
  ;


function teardownCluster() {
  console.info(`Running ${chalk.bold('terraform destroy')} in terraform/...`);
  const rv = spawnSync('terraform destroy', {
    cwd: 'terraform',
    shell: true,
    stdio: 'inherit',
  });
  console.info(`${chalk.bold('terraform destroy')} exited with code ${rv.status}`);
  if (rv.status) {
    console.error(`${chalk.bold('terraform destroy')} failed`);
    return process.exit(1);
  }
  console.info(`${chalk.green('Cluster has been DESTROYED.')}`);
  return process.exit(0);
}


module.exports = teardownCluster;
