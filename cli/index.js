module.exports = {
  //
  // Main Workflow
  //
  init: {
    name: 'init',
    desc: 'Create base configuration files for a Baresoil cluster on AWS.',
    helpPriority: 1,
    helpGroup: 'AWS Cluster',
    argSpec: {
      'no-questions': {
        type: 'unary',
        desc: 'If --no-questions is specified, accept defaults for all questions without prompting.',
      },
    },
  },

  'raise-cluster': {
    name: 'raise-cluster',
    desc: 'Run "terraform plan" and then "terraform apply" in the terraform directory.',
    helpPriority: 2,
    helpGroup: 'AWS Cluster',
  },

  'build-image': {
    name: 'build-image',
    desc: 'Build a new Baresoil server AMI based on the current configuration.',
    helpPriority: 3,
    helpGroup: 'AWS Cluster',
  },

  'deploy-image': {
    name: 'deploy-image',
    desc: 'Deploy a previously built image to production.',
    helpPriority: 4,
    helpGroup: 'AWS Cluster',
  },

  'teardown-cluster': {
    name: 'teardown-cluster',
    desc: 'Destroy a cluster by running "terraform destroy".',
    helpPriority: 5,
    helpGroup: 'AWS Cluster',
  },

  //
  // Subcommands / Advanced
  //
  update: {
    name: 'update',
    desc: 'Update auto-generated files after manual configuration updates.',
    helpPriority: 1000,
    helpGroup: 'Advanced',
  },

  'gen-terraform': {
    name: 'gen-terraform',
    desc: 'Generate master Terraform file based on current configuration.',
    helpPriority: 1001,
    helpGroup: 'Advanced',
  },

  'gen-build': {
    name: 'gen-build',
    desc: 'Generate a clean directory structure for building a new image.',
    helpPriority: 1002,
    helpGroup: 'Advanced',
  },

  'prepare-cluster': {
    name: 'prepare-cluster',
    desc: 'Set up a cluster using the bastion node.',
    helpPriority: 1003,
    helpGroup: 'Advanced',
  },

  configure: {
    name: 'configure',
    desc: 'Interactively configure baresoil-server.conf.json in the current directory.',
    helpPriority: 1004,
    helpGroup: 'Advanced',
  },

  apply: {
    name: 'apply',
    desc: 'Run "terraform plan" and then "terraform apply".',
    helpPriority: 1010,
    helpGroup: 'Advanced',
  },
};
