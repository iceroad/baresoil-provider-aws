const _ = require('lodash'),
  async = require('async'),
  chalk = require('chalk'),
  inquirer = require('inquirer'),
  path = require('path'),
  AWS = require('aws-sdk')
  ;


function getVpc(base, args, diskConfig, state) {
  return (cb) => {
    const config = _.get(diskConfig, 'master.aws.vpc', {});

    console.log(`
Virtual Private Cloud Setup
───────────────────────────
All EC2 and RDS resources are created inside a Virtual Private Cloud (VPC) that
can be extended with other resources.

Requires either an Administrator-level API access key, or the following security
policies attached to the current key: ${chalk.bold('AmazonEC2FullAccess')}, ${chalk.bold('AmazonVPCFullAccess')}
`);

    const ec2 = new AWS.EC2();

    return async.auto({
      //
      // clusterId: Short cluster identifier.
      //
      clusterId: (cb) => {
        const questions = [
          {
            type: 'input',
            name: 'clusterId',
            message: 'Regionally unique cluster identifier (alphanumeric with dash/underscore)',
            default: config.clusterId || path.basename(process.cwd()),
            filter: inStr => inStr.replace(/[^a-z0-9_-]/mgi, ''),
            validate: inStr => (
              (inStr.length && inStr.length < 15)
                ? true
                : 'Invalid cluster ID (must be between 1 and 15 alphanumeric with dash/underscore)'),
          },
        ];
        return inquirer.prompt(questions).then(answers => cb(null, answers.clusterId));
      },

      //
      // azList: list of selected availability zones in region.
      //
      zoneList: ['clusterId', (deps, cb) => {
        return ec2.describeAvailabilityZones((err, data) => {
          if (err) return cb(err);

          // Only keep AZ that are in state "available"
          const availableZones = _.filter(
            data.AvailabilityZones, zone => zone.State === 'available');
          if (!availableZones || !availableZones.length) {
            return cb(new Error(`No available zones in region ${state.region}.`));
          }
          const questions = [
            {
              type: 'checkbox',
              name: 'zones',
              message: 'Availability zones to use (at least 2)',
              choices: _.map(availableZones, 'ZoneName'),
              default: config.zoneList || _.map(availableZones, 'ZoneName').slice(0, 2),
              validate: (inChoices) => {
                if (inChoices.length < 2) {
                  return 'Please select at least 2 availability zones.';
                }
                return true;
              },
            },
          ];
          return inquirer.prompt(questions).then(answers => cb(null, answers.zones));
        });
      }],
    }, (err, results) => {
      if (err) return cb(err);
      return cb(null, { vpc: results });
    });
  };
}


module.exports = getVpc;
