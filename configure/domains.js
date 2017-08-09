const _ = require('lodash'),
  async = require('async'),
  chalk = require('chalk'),
  helpers = require('../util/helpers'),
  fs = require('fs'),
  inquirer = require('inquirer'),
  json = JSON.stringify,
  path = require('path'),
  temp = require('temp'),
  AWS = require('aws-sdk')
  ;


function getDomains(base, args, diskConfig, state) {
  const config = _.get(diskConfig, 'master.aws.domains', {});
  return (cb) => {
    console.log(`
Domain Setup
────────────
Requires either an Administrator-level API access key, or the following security
policies attached to the current: ${chalk.bold('Route53FullAccess')},
`);

    async.auto({
      // Prompt whether to use Route53 or not.
      useTld: (cb) => {
        const questions = [
          {
            type: 'confirm',
            name: 'useTld',
            message: 'Set up one or more Route53-managed domain names?',
            default: config.useTld,
          },
        ];
        inquirer.prompt(questions).then(answers => cb(null, answers.useTld));
      },

      // Get domain list.
      domainList: ['useTld', (deps, cb) => {
        if (!deps.useTld) return cb(null, []);
        const route53 = new AWS.Route53();
        route53.listHostedZones((err, result) => {
          if (err) return cb(err);

          // Index currently selected domains.
          const selectedDomainIdx = _.keyBy(config.domainList);

          // Assemble domain list.
          let domains = _.map(result.HostedZones, (hostedZone) => {
            return {
              name: hostedZone.Name.replace(/\.$/, ''),
              zoneId: hostedZone.Id,
              desc: _.get(hostedZone, 'Config.Comment'),
              private: _.get(hostedZone, 'Config.PrivateZone'),
            };
          });

          // Sort by currently selected.
          domains = _.sortBy(domains, (domain) => {
            return selectedDomainIdx[domain.name] ? -1 : 1;
          });

          const questions = [
            {
              type: 'checkbox',
              name: 'domainList',
              message: 'Domain names to assign to Baresoil cluster',
              choices: _.map(domains, (domain) => {
                const domainName = domain.name.replace(/\.$/, '');
                return {
                  name: ` ${chalk.bold(domainName)} ${chalk.gray(domain.desc)}`,
                  value: {
                    name: domainName,
                    zoneId: domain.zoneId,
                  },
                  short: domainName,
                };
              }),
              default: config.domainList,
              validate: (inChoices) => {
                if (inChoices.length < 1) {
                  return 'Please select at least 1 domain.';
                }
                if (inChoices.length > 5) {
                  return 'Please select up to 5 domains.';
                }
                return true;
              },
            },
          ];

          return inquirer.prompt(questions).then((answers) => {
            state.domainList = answers.domainList;
            return cb(null, answers.domainList);
          });
        });
      }],
    }, (err, results) => {
      if (err) return cb(err);
      return cb(null, { domains: results });
    });
  };
}

module.exports = getDomains;
