const _ = require('lodash'),
  fs = require('fs'),
  os = require('os'),
  path = require('path'),
  json = JSON.stringify,
  spawnSync = require('child_process').spawnSync,
  temp = require('temp'),
  AWS = require('aws-sdk')
  ;


function getDefaultPublicKey() {
  try {
    const pubKeyLocation = path.join(os.userInfo().homedir, '.ssh', 'id_rsa.pub');
    const pubKeyRaw = fs.readFileSync(pubKeyLocation, 'utf-8')
      .replace(/[\r\n]/mg, '')
      .trim();
    return {
      source: pubKeyLocation,
      contents: pubKeyRaw,
    };
  } catch (e) {
    console.warn(`No SSH public key found: ${e.message}`);
  }
}


function loadAWSCredentials(creds) {
  // Load AWS API credentials into temporary file and then read into AWS SDK.
  const tmpPath = temp.path();
  fs.writeFileSync(tmpPath, json(creds), 'utf-8');
  AWS.config.loadFromPath(tmpPath);
  fs.unlinkSync(tmpPath);
  console.debug(`AWS SDK set to use key ${creds.accessKeyId}:${creds.region}`);
}


function getDefaultAWSCredentials() {
  // Look in process environment
  if (process.env.AWS_ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY) {
    return {
      source: '<environment>',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
    };
  }

  // Look in default credentials locations.
  const awsCredsLocation = path.join(os.userInfo().homedir, '.aws', 'credentials');
  const creds = {};
  let rawCreds;
  try {
    rawCreds = fs.readFileSync(awsCredsLocation, 'utf-8');
  } catch (e) {
    console.debug(
      `No AWS credentials found at location "${awsCredsLocation}": ${e.message}`);
    return;
  }

  // Parse AWS credentials.
  _.forEach(rawCreds.split(/\n/), (line) => {
    const m1 = line.match(/^aws_access_key_id\s*=\s*(\S+)/);
    if (m1) {
      creds.accessKeyId = m1[1];
    }
    const m2 = line.match(/^aws_secret_access_key\s*=\s*(\S+)/);
    if (m2) {
      creds.secretAccessKey = m2[1];
    }
  });


  if (!_.isEmpty(creds)) {
    creds.source = awsCredsLocation;
    return creds;
  }
}


function getTerrformVersion() {
  const rv = spawnSync('terraform -v', {
    shell: true,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  if (rv.status !== 0) {
    throw new Error(
      'Cannot run "terraform -v" on your system; is Hashicorp Terraform installed and ' +
        'in the system path?');
  }
  const vStr = rv.stdout.toString('utf-8');
  const vMatch = vStr.match(/terraform v(\S+)/mi);
  if (!vMatch) {
    throw new Error(
      `Cannot determine Terraform version from "${vStr}".`);
  }
  return vMatch[1];
}


function getPackerVersion() {
  const rv = spawnSync('packer version', {
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'], // Packer emits junk on stderr
  });
  if (rv.status !== 0) {
    throw new Error(
      'Cannot run "packer version" on your system; is Hashicorp Packer installed and ' +
        'in the system path?');
  }
  const vStr = rv.stdout.toString('utf-8');
  const vMatch = vStr.match(/packer v(\S+)/mi);
  if (!vMatch) {
    throw new Error(
      `Cannot determine Packer version from "${vStr}".`);
  }
  return vMatch[1];
}


module.exports = {
  getPackerVersion,
  getTerrformVersion,
  getDefaultAWSCredentials,
  getDefaultPublicKey,
  loadAWSCredentials,
};
