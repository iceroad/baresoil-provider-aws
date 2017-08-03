const chalk = require('chalk'),
  inquirer = require('inquirer'),
  spawnSync = require('child_process').spawnSync
  ;


function tfApply() {
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
    console.info(`${chalk.green('terraform apply succeeded.')}`);
  });
}

module.exports = tfApply;
