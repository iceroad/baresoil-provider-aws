function genPackerConfig(distRoot, clusterConfig, buildArgs) {
  if (!distRoot.match(/\/$/)) {
    distRoot += '/';
  }
  return {
    builders: [
      {
        type: 'amazon-ebs',
        access_key: clusterConfig.credentials.accessKeyId,
        secret_key: clusterConfig.credentials.secretAccessKey,
        ami_name: buildArgs.buildName || `${clusterConfig.vpc.clusterId}-{{isotime "2006-01-02-15-04"}}`,
        instance_type: clusterConfig.web.buildMachineType,
        region: clusterConfig.credentials.region,
        ssh_username: 'ubuntu',
        ami_description: (
          `${clusterConfig.vpc.clusterId}: ` +
          `${buildArgs.buildComment || buildArgs.buildName}`),
        source_ami_filter: {
          filters: {
            'virtualization-type': 'hvm',
            name: clusterConfig.web.baseAmiSearchTerm,
            'root-device-type': 'ebs',
          },
          owners: ['099720109477'], // Canonical
          most_recent: true,
        },
        tags: {
          Name: buildArgs.buildName,
          BaresoilImageName: buildArgs.buildName,
          BaresoilImageComment: buildArgs.buildComment,
        },
      },
    ],
    provisioners: [
      {
        type: 'shell',
        inline_shebang: '/bin/bash -ex',
        inline: [
          'sudo mkdir -p /baresoil',
          'sudo chown -R ubuntu:ubuntu /baresoil',
        ],
      },
      {
        type: 'file',
        source: distRoot,
        destination: '/baresoil',
      },
      {
        type: 'shell',
        inline_shebang: '/bin/bash -ex',
        inline: [
          'cd /baresoil && find . && sudo bash install.sh',
        ],
      },
    ],
  };
}

module.exports = genPackerConfig;
