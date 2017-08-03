const _ = require('lodash'),
  chalk = require('chalk'),
  helpers = require('../../util/helpers'),
  inquirer = require('inquirer'),
  json = JSON.stringify,
  spawnSync = require('child_process').spawnSync
  ;


function raiseCluster(base, args) {
  console.info(`Running ${chalk.bold('terraform plan')} in terraform/...`);
  const rv = spawnSync('terraform plan', {
    cwd: 'terraform',
    shell: true,
    stdio: 'inherit',
  });
  console.info(`${chalk.bold('terraform plan')} exited with code ${rv.status}`);
  if (rv.status) {
    console.error(`${chalk.bold('terraform plan')} failed`);
    return process.exit(1);
  }

  inquirer.prompt([
    {
      type: 'confirm',
      name: 'runApply',
      message: 'Run "terraform apply"?',
      default: false,
    },
  ]).then((answers) => {
    if (!answers.runApply) {
      return process.exit(1);
    }

    console.info(`Running ${chalk.bold('terraform apply')} in terraform/...`);
    const rv = spawnSync('terraform apply', {
      cwd: 'terraform',
      shell: true,
      stdio: 'inherit',
    });
    console.info(`${chalk.bold('terraform apply')} exited with code ${rv.status}`);
    if (rv.status) {
      console.error(`${chalk.bold('terraform apply')} failed`);
      return process.exit(1);
    }

    console.info(`${chalk.green('Cluster has been raised.')}`);

    // Run "prepare-cluster"
    return base.getCliCommand('prepare-cluster').impl.call(this, base, args);
  });
}


module.exports = raiseCluster;
