const _ = require('lodash'),
  async = require('async'),
  chalk = require('chalk'),
  inquirer = require('inquirer'),
  AWS = require('aws-sdk')
  ;


function getEC2Cluster(base, args, diskConfig, state) {
  return (cb) => {
    const config = _.get(diskConfig, 'master.aws.web', {});

    console.log(`
Autoscaling EC2 Web Tier
────────────────────────
Requires either an Administrator-level API access key, or the following security
policies attached to the current key: ${chalk.bold('AmazonEC2FullAccess')}`);

    const questions = [
      {
        type: 'input',
        name: 'machineType',
        message: 'EC2 instance type',
        default: config.machineType || 't2.large',
      },
      {
        type: 'input',
        name: 'minInstances',
        message: 'Minimum number of EC2 instances in the autoscaling web tier',
        default: config.minInstances || 3,
        validate: (inStr) => {
          const inVal = _.toInteger(inStr);
          if (inVal < 1) return 'Must be a positive integer.';
          return true;
        },
      },
      {
        type: 'input',
        name: 'maxInstances',
        message: 'Maximum number of EC2 instances in the autoscaling web tier',
        default: config.maxInstances || 10,
        validate: (inStr, answers) => {
          const inVal = _.toInteger(inStr);
          if (inVal < answers.minInstances) {
            return `Must be greater than or equal to ${answers.minInstances}`;
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'buildMachineType',
        message: 'Temporary EC2 instance type to use for building images',
        default: config.buildMachineType || 'i3.large',
      },
    ];

    function checkAnswers(answers) {
      return cb(null, { web: answers });
    }

    return inquirer.prompt(questions).then(checkAnswers);
  };
}


module.exports = getEC2Cluster;
