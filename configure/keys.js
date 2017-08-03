const _ = require('lodash'),
  col = require('../util/helpers').color,
  helpers = require('../util/helpers'),
  fs = require('fs'),
  inquirer = require('inquirer'),
  json = JSON.stringify,
  path = require('path'),
  spawnSync = require('child_process').spawnSync,
  temp = require('temp'),
  AWS = require('aws-sdk')
  ;


// Get SSH and AWS keys from environment or console.
function getKeys(base, args, diskConfig, state) {
  return (cb) => {
    console.log(col.heading('Access Keys'));

    // Mutate "master.aws.credentials"
    const config = _.get(diskConfig, 'master.aws.credentials', {});
    _.set(diskConfig, 'master.aws.credentials', config);

    // Get default AWS credentials from logged-in user.
    const defaultAwsCreds = helpers.getDefaultAWSCredentials();
    if (defaultAwsCreds.source) {
      console.log(col.status(
        `AWS access key read form ${defaultAwsCreds.source}`));
    }

    // Get or generate SSH keypair into "master.aws.credentials.ssh" and on
    // disk into master-key(.pub).
    if (!config.ssh) {
      if (fs.existsSync('master-key') && fs.existsSync('master-key.pub')) {
        console.log(col.status(
          'Reading SSH keypair from "master-key" and "master-key.pub"'));
        config.ssh = {
          publicPath: path.resolve('master-key.pub'),
          privatePath: path.resolve('master-key'),
        };
      } else {
        // Generate SSH keypair
        console.log(col.status(
          'Generating a master SSH keypair for this cluster using "ssh-keygen"'));
        try { fs.unlinkSync('master-key'); } catch (e) { }
        try { fs.unlinkSync('master-key.pub'); } catch (e) { }
        const cmdLine = 'ssh-keygen -q -t rsa -N "" -f master-key';
        const rv = spawnSync(cmdLine, {
          shell: true,
          cwd: process.cwd(),
          stdio: ['inherit', 'ignore', 'inherit'],
        });
        if (rv.status) {
          return cb(new Error(`
No master keypair found and cannot run "ssh-keygen" on your system;
ensure that you have OpenSSH installed and available in the system path,
or create an SSH keypair in the files "master-key" and "master-key.pub" in
the current directory.`));
        }
        fs.chmodSync('master-key', 0o600);
        fs.chmodSync('master-key.pub', 0o600);
        config.ssh = {
          publicPath: path.resolve('master-key.pub'),
          privatePath: path.resolve('master-key'),
        };
      }
    }

    const questions = [
      {
        type: 'input',
        name: 'accessKeyId',
        message: 'Amazon AWS Access Key ID',
        default: config.accessKeyId || defaultAwsCreds.accessKeyId,
        filter: inStr => inStr.replace(/\s+/mgi, ''),
        validate: inStr => (inStr.length > 10 ? true : 'Invalid access key ID'),
      },
      {
        type: 'input',
        name: 'secretAccessKey',
        message: 'AWS Secret Access Key',
        default: config.secretAccessKey || defaultAwsCreds.secretAccessKey,
        filter: inStr => inStr.replace(/\s+/mgi, ''),
        validate: inStr => (inStr.length > 10 ? true : 'Invalid secret access key'),
      },
      {
        type: 'input',
        name: 'region',
        message: 'AWS Region',
        default: config.region || 'us-east-1',
        filter: inStr => inStr.replace(/\s+/mgi, ''),
        validate: inStr => ((inStr.length > 6 && inStr.length < 15) ? true : 'Invalid AWS region'),
      },
    ];

    function checkAnswers(answers) {
      // Load AWS API credentials into temporary file and then read into AWS SDK.
      const tmpPath = temp.path();
      fs.writeFileSync(tmpPath, json(answers), 'utf-8');
      AWS.config.loadFromPath(tmpPath);
      fs.unlinkSync(tmpPath);
      console.debug(`AWS SDK set to use key ${answers.accessKeyId}`);

      // Get region info.
      // console.log(`> Getting information about AWS region ${answers.region}...`);
      const ec2 = new AWS.EC2();
      return ec2.describeRegions({}, (err, data) => {
        if (err) {
          console.error(`Could not validate AWS credentials: ${err.message}`);
          return inquirer.prompt(questions).then(checkAnswers);
        }
        state.regionList = _.map(data.Regions, 'RegionName');
        state.region = answers.region;
        console.debug(
          `Found ${state.regionList.length} AWS regions: ` +
          `${state.regionList.join(', ')}`);
        return cb(null, { credentials: answers });
      });
    }

    return inquirer.prompt(questions).then(checkAnswers);
  };
}

module.exports = getKeys;
