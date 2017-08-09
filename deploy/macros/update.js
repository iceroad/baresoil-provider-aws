const chalk = require('chalk');

function update(base, args) {
  base.getCliCommand('gen-terraform').impl.call(this, base, args);
  console.log(chalk.green.bold(
    'All done, you can now run "baresoil-server raise-cluster".'));
}

module.exports = update;
