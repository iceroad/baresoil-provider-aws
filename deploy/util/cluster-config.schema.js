module.exports = {
  name: 'AWSClusterConfig',
  type: 'object',
  fields: {

    credentials: {
      type: 'object',
      desc: 'Access keys and AWS region',
      fields: {

        region: {
          type: 'string',
          desc: 'AWS region',
        },

        accessKeyId: {
          type: 'string',
          desc: 'AWS access key ID',
        },

        secretAccessKey: {
          type: 'string',
          desc: 'AWS secret access key',
        },

        ssh: {
          type: 'object',
          desc: 'SSH master key pair',
          fields: {

            public: { type: 'string', desc: 'SSH public key' },
            private: { type: 'string', desc: 'SSH private key' },

          },
        },
      },
    },

    bastion: {
      type: 'object',
      desc: 'Options for the VPC bastion node.',
      fields: {

        machineType: {
          type: 'string',
          desc: 'EC2 machine type for bastion node.',
        },

        amiSearchTerm: {
          type: 'string',
          desc: 'Search term to provide to EC2 describeImages()',
        },

      },
    },

    domains: {
      type: 'object',
      desc: 'Top-level Route53 domain setup',
      fields: {

        useTld: {
          type: 'boolean',
          desc: 'Use one or more top-level Route53-managed domain(s)',
        },

        domainList: {
          type: 'array',
          elementType: 'string',
          optional: true,
        },

      },
    },

    tls: {
      type: 'object',
      desc: 'TLS/SSL certificate setup using AWS ACM',
      fields: {

        useTls: {
          type: 'boolean',
          desc: 'Use an Amazon Certificate Manager-managed TLS certificate',
        },

        cert: {
          type: 'object',
          desc: 'ACM certificate details',
          optional: true,
          fields: {

            sanList: { type: 'array', elementType: 'string' },
            name: { type: 'string' },
            arn: { type: 'string' },
            status: { type: 'string', optional: true },

          },
        },
      },
    },

    vpc: {
      type: 'object',
      desc: 'Options for overall containing EC2 VPC',
      fields: {

        clusterId: {
          type: 'string',
          desc: 'Short VPC identifier',
          minLength: 1,
        },

        cidrBlock: {
          type: 'string',
          desc: 'VPC CIDR block',
          minLength: 9,
        },

        zoneList: {
          type: 'array',
          desc: 'Availability zones to include in VPC',
        },

      },
    },

    rds: {
      type: 'object',
      desc: 'Options for MetaStore hosted on Amazon RDS (Postgres)',
      fields: {

        machineType: {
          type: 'string',
          desc: 'RDS machine type',
          minLength: 3,
          maxLength: 12,
        },

        multiAZ: {
          type: 'boolean',
          desc: 'Maintain a synchronous replica in another availability zone (doubles instance count).',
        },

        storage: {
          sizeGb: {
            type: 'integer',
            desc: 'Gigabytes of storage for MetaStore.',
          },
          type: {
            type: 'string',
            desc: 'Instance storage type.',
          },
        },

        engine: {
          type: 'object',
          desc: 'RDS database engine to use.',
          fields: {

            name: {
              type: 'string',
              desc: 'Engine name',
            },

            version: {
              type: 'string',
              desc: 'Engine version',
            },

          },
        },

      },
    },

    web: {
      type: 'object',
      desc: 'Options for autoscaling web tier',
      fields: {
        baseAmiSearchTerm: {
          type: 'string',
          desc: 'Ubuntu Linux search term for base AMI from Canonical',
        },
        minInstances: {
          type: 'integer',
          desc: 'Minimum number of instances in the autoscaling group.',
        },
        maxInstances: {
          type: 'integer',
          desc: 'Maximum number of instances in the autoscaling group.',
        },
        machineType: {
          type: 'string',
          desc: 'EC2 machine type',
        },
        rootDeviceSizeGb: {
          type: 'integer',
          desc: 'Size of instance root device (in gigabytes)',
        },
        buildMachineType: {
          type: 'string',
          desc: 'EC2 machine type for building images.',
        },
        scaleUpAdjustment: {
          type: 'integer',
          desc: 'Number of instances to add on a cluster scale UP event.',
        },
        scaleDownAdjustment: {
          type: 'integer',
          desc: 'Number of instances to remove on a cluster scale DOWN event.',
        },

      },
    },

  },
  default: {
    credentials: {
      region: 'us-east-1',
    },
    bastion: {
      amiSearchTerm: 'ubuntu/images/hvm-ssd/ubuntu-xenial-16.04-amd64-server*',
      machineType: 't2.nano',
    },
    rds: {
      machineType: 'db.t2.micro',
      storage: {
        sizeGb: 10,
        type: 'gp2',
        backupRetentionDays: 30,
      },
      multiAZ: false,
      encryption: {
        enabled: false,
      },
      engine: {
        name: 'postgres',
        version: '9.6',
      },
      root: {
        username: 'postgres',
        database: 'postgres',
      },
      user: {
        username: 'baresoil',
        database: 'baresoil',
      },
    },
    s3: {},
    vpc: {
      cidrBlock: '10.0.0.0/16',
    },
    web: {
      baseAmiSearchTerm: 'ubuntu/images/hvm-ssd/ubuntu-xenial-16.04-amd64-server*',
      machineType: 't2.small',
      minInstances: 1,
      maxInstances: 10,
      buildMachineType: 'i3.large',
      rootDeviceSizeGb: 10,
      scaleUp: {
        adjustment: 3,
        threshold: 70,
        statistic: 'Average',
      },
      scaleDown: {
        adjustment: 1,
        threshold: 10,
        statistic: 'Average',
      },
    },
  },
};
