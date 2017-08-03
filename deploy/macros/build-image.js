const _ = require('lodash'),
  chalk = require('chalk'),
  helpers = require('../../util/helpers'),
  inquirer = require('inquirer'),
  json = JSON.stringify,
  spawnSync = require('child_process').spawnSync
  ;


function buildImage(base, args) {
  // Run "update"
  base.getCliCommand('update').impl.call(this, base, args);

  // Run "gen-build"
  const buildDir = base.getCliCommand('gen-build').impl.call(this, base, args);

  // Run "packer build"
  const rv = spawnSync('packer build --color=true packer.json', {
    cwd: buildDir,
    stdio: 'inherit',
    shell: true,
  });
  if (rv.status) {
    console.error(`Cannot run "${chalk.bold('packer build')}".`);
    return process.exit(1);
  }
  console.info(chalk.green('Packer build finished successfully, AMI built.'));
}


module.exports = buildImage;
