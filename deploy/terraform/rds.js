module.exports = function rds(config, genesis) {
  const rdsConfig = config.rds;

  //
  // RDS Postgres instance.
  //
  const instanceName = `${config.vpc.clusterId}-metastore`;
  genesis.addResource('aws_db_instance', instanceName, {
    // Postgres instance options.
    allocated_storage: rdsConfig.storage.sizeGb,
    engine: rdsConfig.engine.name,
    engine_version: rdsConfig.engine.version,
    identifier: instanceName,
    instance_class: rdsConfig.machineType,
    storage_type: rdsConfig.storage.type,

    // Root username and password.
    username: rdsConfig.root.username,
    password: rdsConfig.root.password,

    // Placement and meta
    publicly_accessible: false,
    skip_final_snapshot: true,
    storage_encrypted: rdsConfig.encryption.enabled,
    multi_az: rdsConfig.multiAZ,
    db_subnet_group_name: '${aws_db_subnet_group.regional_db_subnet.id}',
    vpc_security_group_ids: ['${aws_security_group.db_security_group.id}'],
    backup_retention_period: rdsConfig.storage.backupRetentionDays,
    $inlines: [
      ['tags', {
        Name: instanceName,
      }],
    ],
  }, [
    `${instanceName}: RDS Postgres instance for MetaStore.`,
  ]);

  //
  // Save database address, port, and dbname as outputs.
  //
  genesis.addOutput('pgAddress', {
    value: `\${aws_db_instance.${instanceName}.address}`,
  }, [
    `Output "pgAddress": DNS hostname for Postgres instance "${instanceName}"`,
  ]);

  genesis.addOutput('pgPort', {
    value: `\${aws_db_instance.${instanceName}.port}`,
  }, [
    `Output "pgPort": Port for Postgres instance "${instanceName}"`,
  ]);
};
