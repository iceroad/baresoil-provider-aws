const _ = require('lodash'),
  chalk = require('chalk'),
  deployUtil = require('../util'),
  fs = require('fs'),
  helpers = require('../../util/helpers'),
  inquirer = require('inquirer'),
  json = JSON.stringify,
  moment = require('moment'),
  Table = require('cli-table2')
  ;

function deployImage(base, args) {
  const creds = base.getDiskConfig().config.master.aws.credentials;
  helpers.loadAWSCredentials(creds);

  // Get all AMIs in region.
  deployUtil.getAmiList(creds.region, (err, result) => {
    if (err) {
      console.error(`Cannot retrieve AMI list for user: ${err.message}`);
      return process.exit(1);
    }
    const imgList = _.sortBy(_.map(result.Images, imgInfo => ({
      arch: imgInfo.Architecture,
      ami: imgInfo.ImageId,
      created: (new Date(imgInfo.CreationDate)).getTime(),
      desc: imgInfo.Description,
      name: imgInfo.Name,
      state: imgInfo.State,
    })), 'created');

    const table = new Table({
      head: ['Image', 'Arch', 'AMI', 'Created', 'State', 'Comment'],
    });
    _.forEach(imgList, (img) => {
      table.push([
        img.name,
        img.arch,
        img.ami,
        moment(img.created).fromNow(),
        img.state,
        img.desc,
      ]);
    });
    console.log(table.toString());

    const questions = [
      {
        type: 'list',
        choices: _.map(imgList, img => ({
          name: `${img.ami}: ${img.name} (created ${moment(img.created).fromNow()})`,
          value: img.ami,
          short: img.ami,
        })),
        name: 'ami',
        default: _.get(_.last(imgList), 'ami'),
        message: 'Select AMI to deploy',
      },
    ];
    inquirer.prompt(questions).then((answers) => {
      // Set AMI in master config.
      const config = base.getDiskConfig().config;
      config.master.aws.web.ami = answers.ami;
      const cfgPath = base.getDiskConfig().configPath;
      fs.writeFileSync(cfgPath, json(config, null, 2), 'utf-8');
      console.log(`Updated ${chalk.bold(cfgPath)} to AMI ${chalk.green(answers.ami)}`);

      // Run "update".
      base.getCliCommand('update').impl.call(this, base, args);

      // Run "apply".
      return base.getCliCommand('apply').impl.call(this, base, args);
    });
  });
}


module.exports = deployImage;
