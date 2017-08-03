const _ = require('lodash'),
  fs = require('fs'),
  chalk = require('chalk'),
  os = require('os'),
  json = JSON.stringify,
  path = require('path'),
  readline = require('readline'),
  spawn = require('child_process').spawn,
  spawnSync = require('child_process').spawnSync,
  AWS = require('aws-sdk'),
  Netmask = require('netmask').Netmask
  ;

// Read current Terraform outputs and cluster configuration.
function getTerraformOutputs() {
  try {
    const tfOutputs = JSON.parse(spawnSync('terraform output -json', {
      shell: true,
      cwd: 'terraform',
      stdio: 'pipe',
    }).stdout.toString('utf-8'));
    return tfOutputs;
  } catch (e) {
    console.warn(`No Terraform outputs: ${e.message}`);
  }
}

function replaceArrays(objValue, srcValue) {
  if (_.isArray(srcValue)) {
    return srcValue;
  }
}


function getClusterConfig(diskConfig) {
  const diskMasterConf = _.get(diskConfig, 'config.master.aws', {});
  const defaultClusterConf = _.cloneDeep(require('./cluster-config.schema').default);
  const mergedConfig = _.mergeWith({}, defaultClusterConf, diskMasterConf, replaceArrays);

  //
  // Set vpc.azList from zoneList and VPC CIDR block;
  //
  if (mergedConfig.vpc.zoneList && !mergedConfig.vpc.azList) {
    const nm = new Netmask(mergedConfig.vpc.cidrBlock);
    nm.bitmask += 4; // leaves 4094 IPs in each subnet with a /16 VPC
    let subnetMask = new Netmask(nm.toString());
    const getNextSubnet = () => {
      const subnetStr = subnetMask.toString();
      subnetMask = subnetMask.next();
      return subnetStr;
    };
    mergedConfig.vpc.azList = _.map(_.sortBy(mergedConfig.vpc.zoneList), (azName) => {
      return {
        name: azName,
        publicCidrBlock: getNextSubnet(),
        privateCidrBlock: getNextSubnet(),
      };
    });
  }

  //
  // Set vpc.name from master.credentials.clusterId
  //
  if (!mergedConfig.vpc.name) {
    mergedConfig.vpc.name = `vpc-${mergedConfig.vpc.clusterId}`;
  }

  return mergedConfig;
}

// Read Bash script, filter out comments and empty lines.
function getScriptLines(scriptPath) {
  const rawText = fs.readFileSync(scriptPath, 'utf-8');
  return _.filter(rawText.split(/\n/),
    line => !(line.match(/^\s*#/) || line.match(/^\s*$/)));
}

function getUserSSHPublicKey() {
  try {
    const pubKeyLocation = path.join(os.userInfo().homedir, '.ssh', 'id_rsa.pub');
    return fs.readFileSync(pubKeyLocation, 'utf-8').replace(/[\r\n]/mg, '').trim();
  } catch (e) {
    console.warn(`No SSH public key found: ${e.message}`);
  }
}

// Return current cluster configuration, or undefined if cluster data does
// not exist.
function getJson(jsonPath) {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
}

// Run a command at a remote host over SSH.
function makeRemoteCommandRunner(remoteIp, sshPrivKeyPath) {
  return (cmdLine, statusMsg) => {
    if (statusMsg) {
      console.log(chalk.green.bold(`> ${statusMsg}`));
    }
    const sshCmd = `ssh -i ${json(sshPrivKeyPath)} -o StrictHostKeyChecking=no ubuntu@${remoteIp} ${JSON.stringify(cmdLine)}`;
    const rv = spawnSync(sshCmd, {
      shell: true,
      stdio: 'pipe',
    });
    const stdout = rv.stdout.toString('utf-8');
    const stderr = rv.stderr.toString('utf-8');
    if (rv.status !== 0) {
      _.forEach(stdout.split('\n'), line => console.log(`${chalk.blue('stdout:')} ${line}`));
      _.forEach(stderr.split('\n'), line => console.log(`${chalk.red('stderr:')} ${line}`));
      throw new Error(`Nonzero return code from shell out to "${cmdLine}"`);
    }
    return { stdout, stderr, status: rv.status };
  };
}


// Run a local command.
function runLocalCommandAsync(cmdLine, statusMsg, linePrefix, cb) {
  if (statusMsg) {
    console.log(chalk.green.bold(`> ${statusMsg}`));
  }

  // Spawn child.
  const child = spawn(cmdLine, {
    shell: true,
    stdio: 'pipe',
  });

  // Collect output lines.
  const outLines = [], errLines = [];

  // Register handlers.
  const cbOnce = _.once(cb);
  child.once('error', err => cbOnce(err));
  child.once('exit', (code, signal) => {
    if (code || signal) {
      return cbOnce(new Error(`ssh exited with code=${code} signal=${signal}`));
    }
    return cbOnce(null, {
      stdout: outLines,
      stderr: errLines,
      code,
      signal,
    });
  });

  // Listen for lines on stderr and stdout.
  const rlOut = readline.createInterface({ input: child.stdout });
  const rlErr = readline.createInterface({ input: child.stderr });
  const prefixOut = `${chalk.gray(linePrefix)}:${chalk.green('stdout')}:`;
  const prefixErr = `${chalk.gray(linePrefix)}:${chalk.red('stderr')}:`;

  rlOut.on('line', (lineStr) => {
    outLines.push(lineStr);
    console.log(prefixOut, chalk.gray(lineStr));
  });

  rlErr.on('line', (lineStr) => {
    errLines.push(lineStr);
    console.log(prefixErr, lineStr);
  });

  return child;
}


// Run a command at a remote host over SSH.
function makeRemoteCommandRunnerAsync(remoteIp, sshPrivKeyPath) {
  return (cmdLine, statusMsg, cb) => {
    const sshCmd = [
      'ssh',
      `-i ${json(sshPrivKeyPath)}`,
      '-o StrictHostKeyChecking=no',
      `ubuntu@${remoteIp}`,
      JSON.stringify(cmdLine),
    ].join(' ');
    return runLocalCommandAsync(sshCmd, statusMsg, remoteIp, cb);
  };
}

// Get AMIs in a region
function getAmiList(region, cb) {
  // Create client and get all AMIs available in the region.
  const ec2 = new AWS.EC2({ region });
  const params = { Owners: ['self'] };
  ec2.describeImages(params, cb);
}

module.exports = {
  getAmiList,
  getClusterConfig,
  getTerraformOutputs,
  getJson,
  getScriptLines,
  getUserSSHPublicKey,
  makeRemoteCommandRunner,
  makeRemoteCommandRunnerAsync,
  runLocalCommandAsync,
};
