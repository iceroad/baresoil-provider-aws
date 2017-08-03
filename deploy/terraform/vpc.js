module.exports = function vpc(config, genesis) {
  const vpcName = config.vpc.name;

  //
  // Add a containing master VPC. The CIDR block should be /16.
  //
  genesis.addResource('aws_vpc', vpcName, {
    cidr_block: config.vpc.cidrBlock,
    enable_dns_hostnames: true,
    enable_dns_support: true,
    $inlines: [
      ['tags', {
        Name: vpcName,
      }],
    ],
  }, [
    `${vpcName}: Master VPC for region`,
    '',
    `* CIDR block: ${config.vpc.cidrBlock}`,
  ]);
  genesis.addOutput('vpcId', {
    value: `\${aws_vpc.${vpcName}.id}`,
  }, [
    'Output: vpcId: Master VPC ID',
  ]);

  //
  // Add VPC Internet gateway
  //
  genesis.addResource('aws_internet_gateway', 'regional_internet_gateway', {
    vpc_id: `\${aws_vpc.${vpcName}.id}`,
  }, [
    'Give the master VPC access to the public Internet via an Internet Gateway.',
  ]);

  //
  // Route default outbound traffic (destination 0.0.0.0/0) to the
  // Internet gateway in the VPC's main route table.
  //
  genesis.addResource('aws_route', 'allow_public_internet', {
    route_table_id: `\${aws_vpc.${vpcName}.main_route_table_id}`,
    destination_cidr_block: '0.0.0.0/0',
    gateway_id: '${aws_internet_gateway.regional_internet_gateway.id}',
  }, [
    'Route default outbound traffic (destination 0.0.0.0/0) to the',
    'Internet gateway in the main VPC route table.',
    '',
    'This allows EC2 instances to communicate with the public Internet.',
  ]);
};
