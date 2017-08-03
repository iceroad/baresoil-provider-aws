const _ = require('lodash'),
  assert = require('assert')
;

module.exports = function subnets(config, genesis) {
  const azList = config.vpc.azList;
  assert(
    _.isArray(azList) && azList.length >= 1,
    'vpc.azList must be a non-empty array');

  //
  // Create a public and private subnet for each availability zone.
  //
  _.forEach(azList, (azDef) => {
    const azName = azDef.name;
    const privateSubnetName = `${azName}-private`;
    const publicSubnetName = `${azName}-public`;

    //
    // Private subnet: no public IPs mapped on instance launch.
    //
    genesis.addResource('aws_subnet', privateSubnetName, {
      vpc_id: `\${aws_vpc.${config.vpc.name}.id}`,
      cidr_block: azDef.privateCidrBlock,
      availability_zone: azName,
      map_public_ip_on_launch: false,
      $inlines: [
        ['tags', {
          Name: privateSubnetName,
        }],
      ],
    }, [
      `${privateSubnetName}: Private subnet for AZ "${azName}"`,
    ]);

    //
    // Public subnet: public IPs mapped on instance launch.
    //
    genesis.addResource('aws_subnet', publicSubnetName, {
      vpc_id: `\${aws_vpc.${config.vpc.name}.id}`,
      cidr_block: azDef.publicCidrBlock,
      availability_zone: azName,
      map_public_ip_on_launch: true,
      $inlines: [
        ['tags', {
          Name: publicSubnetName,
        }],
      ],
    }, [
      `${publicSubnetName}: Public subnet for AZ "${azName}"`,
    ]);
  });

  //
  // Database subnet group to contain all private subnets in the region. This
  // is required for multi-AZ RDS database deployments.
  //
  genesis.addResource('aws_db_subnet_group', 'regional_db_subnet', {
    subnet_ids: _.map(
      azList,
      azDef => `\${aws_subnet.${azDef.name}-private.id}`),
  }, [
    'DB subnet group containing all private subnets across all AZs.',
  ]);
};
