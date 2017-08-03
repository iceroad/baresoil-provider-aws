const _ = require('lodash'),
  assert = require('assert')
;

module.exports = function security(config, genesis) {
  const vpcName = config.vpc.name;
  const azList = config.vpc.azList;
  assert(
    _.isArray(azList) && azList.length >= 1,
    'vpc.azList must be a non-empty array');

  //
  // "allow all" security group to allow all incoming and outgoing traffic.
  //
  genesis.addResource('aws_security_group', 'allow_all_security_group', {
    description: `${vpcName}: Allow all traffic security group`,
    name: 'allow_all_security_group',
    vpc_id: `\${aws_vpc.${config.vpc.name}.id}`,
    $inlines: [
      ['ingress', {
        from_port: 0,
        to_port: 0,
        protocol: '-1',
        cidr_blocks: ['0.0.0.0/0'],
      }],

      ['egress', {
        from_port: 0,
        to_port: 0,
        protocol: '-1',
        cidr_blocks: ['0.0.0.0/0'],
      }],
    ],
  }, [
    'EC2 Security Group: all network traffic allowed allowed.',
  ]);

  //
  // Add a VPC Security Group for the bastion node.
  //
  genesis.addResource('aws_security_group', 'bastion_security_group', {
    description: `${vpcName}: Security group for the bastion node`,
    name: 'bastion_security_group',
    vpc_id: `\${aws_vpc.${config.vpc.name}.id}`,
    $inlines: [
      ['ingress', {
        from_port: 22,
        to_port: 22,
        protocol: 'tcp',
        cidr_blocks: ['0.0.0.0/0'],
      }],
      ['egress', {
        from_port: 0,
        to_port: 0,
        protocol: '-1',
        cidr_blocks: ['0.0.0.0/0'],
      }],
    ],
  }, [
    'EC2 Security Group to only allow incoming SSH traffic and all outgoing.',
  ]);


  //
  // Security group for the Postgres instance.
  //
  genesis.addResource('aws_security_group', 'db_security_group', {
    description: `${vpcName}: Database security group`,
    name: 'db_security_group',
    vpc_id: `\${aws_vpc.${config.vpc.name}.id}`,
    $inlines: [
      ['ingress', {
        from_port: 0,
        to_port: 0,
        protocol: '-1',
        cidr_blocks: [config.vpc.cidrBlock],
      }],
      ['egress', {
        from_port: 0,
        to_port: 0,
        protocol: '-1',
        cidr_blocks: [config.vpc.cidrBlock],
      }],
    ],
  }, [
    'EC2 Security Group for Postgres instances.',
  ]);

  //
  // EC2 Security Group for the web tier.
  //
  genesis.addResource('aws_security_group', 'web_tier_security_group', {
    description: `${vpcName}: Web tier security group.`,
    name: 'web_tier_security_group',
    vpc_id: `\${aws_vpc.${config.vpc.name}.id}`,
    $inlines: [
      //
      // Local VPC traffic
      // Allow all inbound and outbound within VPC CIDR block.
      //
      ['ingress', {
        from_port: 0,
        to_port: 0,
        protocol: '-1',
        cidr_blocks: [config.vpc.cidrBlock],
      }],

      ['egress', {
        from_port: 0,
        to_port: 0,
        protocol: '-1',
        cidr_blocks: [config.vpc.cidrBlock],
      }],

      //
      // Public traffic (CIDR block 0.0.0.0/0)
      //

      // Allow HTTPS egress for outgoing HTTPS calls.
      ['egress', {
        from_port: 0,
        to_port: 443,
        protocol: 'tcp',
        cidr_blocks: ['0.0.0.0/0'],
      }],

      // Allow HTTP egress too.
      ['egress', {
        from_port: 0,
        to_port: 80,
        protocol: 'tcp',
        cidr_blocks: ['0.0.0.0/0'],
      }],

      // Allow incoming/outgoing NTP protocol
      ['egress', {
        from_port: 0,
        to_port: 123,
        protocol: 'udp',
        cidr_blocks: ['0.0.0.0/0'],
      }],
      ['ingress', {
        from_port: 0,
        to_port: 123,
        protocol: 'udp',
        cidr_blocks: ['0.0.0.0/0'],
      }],
    ],
  }, [
    'EC2 Security Group for web tier nodes:',
    '  Intra-VPC traffic: all allowed.',
    '  Public traffic: NTP in+out, HTTP(s) out.',
  ]);
};
