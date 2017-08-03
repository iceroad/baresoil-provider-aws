const _ = require('lodash'),
  chalk = require('chalk'),
  crypto = require('crypto'),
  inquirer = require('inquirer')
  ;


function getRds(base, args, diskConfig) {
  return (cb) => {
    const config = _.get(diskConfig, 'master.aws.rds', {});

    console.log(`
RDS Postgres MetaStore
──────────────────────
Requires either an Administrator-level API access key, or the following security
policies attached to the current key: ${chalk.bold('AWSRDSFullAccess')}

NOTE: Selecting multi-AZ mode will increase the billable instance count.`);

    const questions = [
      {
        type: 'input',
        name: 'machineType',
        message: 'RDS instance type for Postgres MetaStore (starts with "db.")',
        default: config.machineType || 'db.t2.micro',
      },
      {
        type: 'input',
        name: 'storage.sizeGb',
        message: 'RDS storage size for Postgres MetaStore (in gigabytes)',
        default: _.get(config, 'storage.sizeGb', 10),
        filter: inStr => _.toInteger(inStr),
        validate: (inVal) => {
          if (inVal < 5 || inVal > 6144) {
            return 'Must be a positive integer 5 <= n <= 6144.';
          }
          return true;
        },
      },
      {
        type: 'confirm',
        name: 'multiAZ',
        message: 'Create RDS instance in multi-AZ, high-availability mode?',
        default: config.multiAZ || false,
      },
      {
        type: 'password',
        name: 'root.password',
        message: 'RDS instance root password',
        default: _.get(
          config, 'root.password', crypto.randomBytes(24).toString('hex')),
      },
      {
        type: 'password',
        name: 'user.password',
        message: 'RDS instance user password',
        default: _.get(
          config, 'user.password', crypto.randomBytes(24).toString('hex')),
      },
    ];

    function checkAnswers(answers) {
      return cb(null, { rds: answers });
    }

    return inquirer.prompt(questions).then(checkAnswers);
  };
}

module.exports = getRds;
