const deployUtil = require('../util'),
  fse = require('fs-extra'),
  path = require('path'),
  GenesisDevice = require('genesis-device')
  ;

function genTerraform(base) {
  const clusterConfig = deployUtil.getClusterConfig(base.getDiskConfig());
  const serverConfig = base.getConfig();
  console.debug(`Server config: ${JSON.stringify(serverConfig, null, 2)}`);
  console.debug(`AWS Cluster config: ${JSON.stringify(clusterConfig, null, 2)}`);

  const genesis = new GenesisDevice();
  require('./preamble')(clusterConfig, genesis, serverConfig);
  require('./vpc')(clusterConfig, genesis, serverConfig);
  require('./subnets')(clusterConfig, genesis, serverConfig);
  require('./security')(clusterConfig, genesis, serverConfig);
  require('./bastion')(clusterConfig, genesis, serverConfig);
  require('./rds')(clusterConfig, genesis, serverConfig);
  require('./s3')(clusterConfig, genesis, serverConfig);
  require('./web')(clusterConfig, genesis, serverConfig);
  require('./dns')(clusterConfig, genesis, serverConfig);

  // Generate Terraform configuration.
  const tfOutput = genesis.toString();

  const tfOutputPath = path.resolve('terraform', 'main.tf');
  fse.ensureDirSync(path.dirname(tfOutputPath));
  fse.writeFileSync(tfOutputPath, tfOutput, 'utf-8');
  console.log(`Wrote Terraform file to "${tfOutputPath}"`);
}


module.exports = genTerraform;
