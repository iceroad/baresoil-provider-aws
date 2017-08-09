const _ = require('lodash'),
  chalk = require('chalk'),
  deployUtil = require('../util'),
  fs = require('fs'),
  fse = require('fs-extra'),
  genNginxConfig = require('../image/nginx-conf.js'),
  genPackerConfig = require('../packer'),
  os = require('os'),
  json = JSON.stringify,
  path = require('path')
  ;


function GenerateServerConfig(base, tfState, clusterConfig) {
  const baseServerConfig = base.getConfig();
  baseServerConfig.MetaStore.postgres.host = tfState.pgAddress.value;
  baseServerConfig.MetaStore.postgres.user = clusterConfig.rds.user.username;
  baseServerConfig.MetaStore.postgres.password = clusterConfig.rds.user.password;
  baseServerConfig.MetaStore.postgres.database = clusterConfig.rds.user.database;
  baseServerConfig.BlobStore.s3.bucket = tfState.blobBucketName.value;
  baseServerConfig.BlobStore.s3.region = (
    clusterConfig.s3.region || clusterConfig.credentials.region);
  return { server: baseServerConfig };
}


function genBuild(base, args) {
  const tfState = deployUtil.getTerraformOutputs();
  const clusterConfig = deployUtil.getClusterConfig(base.getDiskConfig());
  const dt = new Date().toISOString().replace(/[:T]/g, '-').substr(0, 19);
  const buildName = args.name || `${clusterConfig.vpc.clusterId}-${dt}`;
  const buildComment = (args.comment ||
      `${os.userInfo().username}@${os.hostname()} on ${new Date().toString()}`);

  // Create build directory.
  const buildDir = path.resolve(`builds/${buildName}`);
  fse.ensureDirSync(path.join(buildDir, 'dist'));

  // Create source package tree.
  const srcPkgArgs = _.clone(args);
  srcPkgArgs.output = path.join(buildDir, 'dist');
  base.getCliCommand('source-package').impl(base, srcPkgArgs);

  // Generate a server config and write it to the build directory.
  const serverConfig = GenerateServerConfig(base, tfState, clusterConfig);
  const configPath = path.join(buildDir, 'dist/config.json');
  fs.writeFileSync(configPath, json(serverConfig, null, 2), 'utf-8');
  console.log(`Wrote server configuration to "${chalk.green(configPath)}".`);

  // Copy the Dockerfile to the image directory.
  const dockerfileIn = path.resolve('image-setup/Dockerfile');
  const dockerfileOut = path.join(buildDir, 'dist/Dockerfile');
  console.log(chalk.green(`> Writing ${chalk.bold(dockerfileOut)}...`));
  fse.copySync(dockerfileIn, dockerfileOut);

  // Generate the server install script and write it to the build directory.
  const installScriptPath = path.resolve('image-setup/install.sh');
  const scriptOutPath = path.join(buildDir, 'dist/install.sh');
  console.log(chalk.green(`> Writing ${chalk.bold(scriptOutPath)}...`));
  fse.copySync(installScriptPath, scriptOutPath);

  // Generate nginx config.
  const nginxConf = genNginxConfig(clusterConfig, base.getConfig());
  let confOutPath = path.join(buildDir, 'dist/nginx.site.conf');
  console.log(chalk.green(`> Writing ${chalk.bold(confOutPath)}...`));
  fs.writeFileSync(confOutPath, nginxConf, 'utf-8');

  // Copy supervisord config.
  const supervisorConf = fs.readFileSync('image-setup/supervisord.conf', 'utf-8');
  confOutPath = path.join(buildDir, 'dist/supervisord.conf');
  console.log(chalk.green(`> Writing ${chalk.bold(confOutPath)}...`));
  fs.writeFileSync(confOutPath, supervisorConf, 'utf-8');

  // Write Packer config.
  const packerConf = genPackerConfig(path.join(buildDir, 'dist'), clusterConfig, {
    buildName,
    buildComment,
  });
  confOutPath = path.join(buildDir, 'packer.json');
  console.log(chalk.green(`> Writing ${chalk.bold(confOutPath)}...`));
  fs.writeFileSync(confOutPath, json(packerConf, null, 2), 'utf-8');

  // Write SSH public key
  const pubKeyPath = path.join(buildDir, 'dist/id_rsa.pub');
  console.log(chalk.green(`> Writing ${chalk.bold(pubKeyPath)}...`));
  fse.copySync(clusterConfig.credentials.ssh.publicPath, pubKeyPath);

  // Write AWS credentials.
  const credsOutStr = `\
[default]
aws_access_key_id = ${clusterConfig.credentials.accessKeyId}
aws_secret_access_key = ${clusterConfig.credentials.secretAccessKey}
aws_region = ${clusterConfig.credentials.region}
`;
  const credsOutPath = path.join(buildDir, 'dist/aws-cred');
  console.log(chalk.green(`> Writing ${chalk.bold(credsOutPath)}...`));
  fs.writeFileSync(credsOutPath, credsOutStr, 'utf-8');

  return buildDir;
}

module.exports = genBuild;
