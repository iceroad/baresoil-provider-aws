const _ = require('lodash'),
  async = require('async'),
  chalk = require('chalk'),
  fs = require('fs'),
  json = JSON.stringify
  ;


function Configure(base, args) {
  const diskConfig = base.getDiskConfig().config || {
    provider: 'aws',
  };

  console.log(`
  ${chalk.yellow.bold('Baresoil Provider for Amazon AWS')}

  You will need:

     * an ${chalk.yellow('AWS Access Key')}, with enough permissions to provision and
       manage EC2, RDS, Route53, and S3 resources for your account.
     * ${chalk.yellow('OpenSSH')}, or a compatible ssh program.
     * Hashicorp's ${chalk.yellow('Terraform')}, to manage AWS infrastructure.
     * Hashicorp's ${chalk.yellow('Packer')}, to build AWS machine images (AMIs).

  Recommended, but optional:

     * a ${chalk.yellow('domain name')} managed by Amazon's ${chalk.yellow('Route 53')}
       DNS service to use as the top-level domain for your instance.
       User applications can register subdomains of this domain.
`);

  const state = {};

  const sections = [
    require('./keys')(base, args, diskConfig, state),
    require('./domains')(base, args, diskConfig, state),
    require('./tls')(base, args, diskConfig, state),
    require('./vpc')(base, args, diskConfig, state),
    require('./ec2')(base, args, diskConfig, state),
    require('./rds')(base, args, diskConfig, state),
  ];
  return async.series(sections, (err, results) => {
    if (err) {
      console.error(err.message);
      return process.exit(1);
    }
    const result = _.merge({}, diskConfig, {
      provider: 'aws',
      master: {
        aws: _.merge({}, ...results),
      },
    });
    const diskConfigPath = base.getDiskConfig().configPath || 'baresoil-server.conf.json';
    fs.writeFileSync(diskConfigPath, json(result, null, 2), 'utf-8');
    console.log(`Updated "master" section of ${chalk.bold.green(diskConfigPath)}`);

    // Update auto-generated files.
    return base.getCliCommand('update').impl.call(this, base, args);
  });
}


module.exports = Configure;
