module.exports = function preamble(config, genesis) {
  //
  // Set AWS credentials and region.
  //
  const region = config.credentials.region;
  genesis.addProvider('aws', {
    access_key: config.credentials.accessKeyId,
    secret_key: config.credentials.secretAccessKey,
    region,
  }, [
    `Provider: AWS region "${region}"`,
  ]);
};
