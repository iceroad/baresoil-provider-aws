const fs = require('fs');

module.exports = function bastion(config, genesis) {
  //
  // Import public key into bastion node's authorized_keys so that the
  // executing user can log into it without a password.
  //
  const keyName = `${config.vpc.clusterId}-bastion`;
  genesis.addResource('aws_key_pair', keyName, {
    key_name_prefix: `${keyName}-`,
    public_key: fs.readFileSync(config.credentials.ssh.publicPath, 'utf-8').trim(),
  }, [
    'EC2 public key for bastion node',
  ]);

  //
  // Add Canonical's official Ubuntu AMI filters to use as the bastion node.
  //
  genesis.addData('aws_ami', 'bastion-ami', {
    most_recent: true,
    owners: ['099720109477'], // Canonical
    $inlines: [
      ['filter', {
        name: 'name',
        values: [config.bastion.amiSearchTerm],
      }],
      ['filter', {
        name: 'architecture',
        values: ['x86_64'],
      }],
      ['filter', {
        name: 'virtualization-type',
        values: ['hvm'],
      }],
    ],
  });


  //
  // Put bastion node in the first AZ's public subnet.
  //
  const azDef = config.vpc.azList[0];
  genesis.addResource('aws_instance', 'bastion', {
    availability_zone: azDef.name,
    instance_type: config.bastion.machineType,
    ami: '${data.aws_ami.bastion-ami.id}',
    associate_public_ip_address: true,
    subnet_id: `\${aws_subnet.${azDef.name}-public.id}`,
    key_name: `\${aws_key_pair.${keyName}.id}`,
    vpc_security_group_ids: ['${aws_security_group.bastion_security_group.id}'],
    $inlines: [
      ['tags', {
        Name: `${config.vpc.clusterId}:bastion`,
      }],
    ],
  }, [
    'EC2 bastion node.',
  ]);

  genesis.addOutput('bastionIp', {
    value: '${aws_instance.bastion.public_ip}',
  }, [
    'Output: bastionIp: Bastion node public IP address',
  ]);
};
