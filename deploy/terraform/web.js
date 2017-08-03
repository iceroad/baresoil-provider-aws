const _ = require('lodash');


module.exports = function web(config, genesis, serverConfig) {
  if (!config.web.ami) {
    // Do nothing for this section if there is no web AMI yet.
    console.debug('There is no web AMI yet.');
    return;
  }

  //
  // ELB
  //
  const elbName = `${config.vpc.clusterId}-elb`;

  // ELB listeners depend on whether we have an SSL certificate or not.
  const elbListeners = [];
  if (config.tls.useTls) {
    // Secure setup with SSL: only add SSL listener if we have an SSL certificate ARN.
    // * bounce port 443 SSL -> instance 8088 tcp
    // * bounce port 80 HTTP -> instance 80 HTTP
    //
    elbListeners.push(['listener', {
      instance_port: 8088,
      instance_protocol: 'tcp',
      lb_port: 443,
      lb_protocol: 'ssl',
      ssl_certificate_id: config.tls.cert.arn,
    }]);

    // Port 80 on the instance is the nginx redirect listener.
    elbListeners.push(['listener', {
      instance_port: 80,
      instance_protocol: 'http',
      lb_port: 80,
      lb_protocol: 'http',
    }]);
  } else {
    // Insecure setup without SSL.
    // * bounce port 80 SSL -> instance 8088 tcp
    //
    // Port 80 on the instance is the nginx redirect listener.
    elbListeners.push(['listener', {
      instance_port: 8088,
      instance_protocol: 'tcp',
      lb_port: 80,
      lb_protocol: 'tcp',
    }]);
  }

  // Add health check port.
  elbListeners.push(['health_check', {
    interval: 15, // seconds
    healthy_threshold: 3, // consecutive passed checks
    unhealthy_threshold: 3, // consecutive failed checks
    timeout: 10, // HTTP request timeout
    target: 'HTTP:8911/',
  }]);

  // Add ELB resource.
  genesis.addResource('aws_elb', elbName, {
    name: elbName,
    subnets: _.map(config.vpc.azList, azDef => `\${aws_subnet.${azDef.name}-public.id}`),
    security_groups: ['${aws_security_group.allow_all_security_group.id}'],

    // LB options
    idle_timeout: Math.ceil(serverConfig.Server.websocket.maxSessionDurationMs / 1000),

    // Drain connections on deregister.
    connection_draining: true,
    connection_draining_timeout: 10,

    // Balance across AZs
    cross_zone_load_balancing: true,

    // Coordinate the instance port number below with nginx.site.conf.
    $inlines: elbListeners,
  }, [
    'ELB: main public-facing load balancer',
  ]);

  genesis.addOutput('elb-dns', {
    value: `\${aws_elb.${elbName}.dns_name}`,
  }, [
    'ELB public DNS name',
  ]);

  //
  // ELB Proxy Protocol policy for TCP
  //
  genesis.addResource('aws_proxy_protocol_policy', 'proxy_proto', {
    load_balancer: `\${aws_elb.${elbName}.name}`,
    instance_ports: ['8088'],
  }, [
    'ELB Proxy Protocol policy for TCP sockets',
    'This enables getting the remote IP for WebSockets.',
  ]);

  //
  // Launch Configuration to use with ASG.
  //
  genesis.addResource('aws_launch_configuration', 'web_tier_lc', {
    image_id: config.web.ami,
    instance_type: config.web.machineType,
    associate_public_ip_address: true, // needed for direct outgoing traffic
    security_groups: ['${aws_security_group.web_tier_security_group.id}'],
    $inlines: [
      ['lifecycle', {
        create_before_destroy: true,
      }],
      ['root_block_device', {
        volume_type: 'gp2',
        volume_size: config.web.rootDeviceSizeGb,
      }],
    ],
  }, [
    'ASG Launch Configuration for the web tier.',
  ]);

  //
  // Autoscaling group of instances (ASG).
  //
  const asgName = `${config.vpc.clusterId}-asg`;
  genesis.addResource('aws_autoscaling_group', 'web_tier_asg', {
    name: `${asgName}-\${aws_launch_configuration.web_tier_lc.name}`,
    availability_zones: _.map(config.vpc.azList, 'name'),
    min_size: config.web.minInstances,
    max_size: config.web.maxInstances,
    health_check_grace_period: 60,
    health_check_type: 'ELB',
    desired_capacity: config.web.minInstances,
    wait_for_elb_capacity: config.web.minInstances,
    enabled_metrics: ['GroupDesiredCapacity'],
    force_delete: true,
    launch_configuration: '${aws_launch_configuration.web_tier_lc.name}',
    load_balancers: [`\${aws_elb.${elbName}.name}`],
    vpc_zone_identifier: _.map(config.vpc.azList, (azDef) => {
      return `\${aws_subnet.${azDef.name}-public.id}`;
    }),
    termination_policies: [
      'OldestLaunchConfiguration',
      'OldestInstance',
      'ClosestToNextInstanceHour',
    ],
    $inlines: [
      ['lifecycle', {
        create_before_destroy: true,
      }],
      ['tag', {
        key: 'Name',
        value: asgName,
        propagate_at_launch: true,
      }],
    ],
  }, [
    'ASG for the web tier.',
  ]);

  //
  // Scale-up policy
  //
  genesis.addResource('aws_autoscaling_policy', 'roofs-on-fire', {
    name: 'roofs-on-fire-policy',
    scaling_adjustment: Math.abs(config.web.scaleUp.adjustment),
    adjustment_type: 'ChangeInCapacity',
    cooldown: 300,
    autoscaling_group_name: '${aws_autoscaling_group.web_tier_asg.name}',
  }, [
    'Scale-up policy for ASG',
  ]);

  //
  // Scale-down policy
  //
  genesis.addResource('aws_autoscaling_policy', 'roof-fire-ended', {
    name: 'roof-fire-ended-policy',
    scaling_adjustment: -Math.abs(config.web.scaleDown.adjustment),
    adjustment_type: 'ChangeInCapacity',
    cooldown: 300,
    autoscaling_group_name: '${aws_autoscaling_group.web_tier_asg.name}',
  }, [
    'Scale-down policy for ASG',
  ]);

  //
  // CloudWatch metric alarm to trigger scale-up based on CPU usage.
  //
  genesis.addResource('aws_cloudwatch_metric_alarm', 'cpu-usage-too-high', {
    alarm_name: 'cpu-usage-too-high',
    comparison_operator: 'GreaterThanOrEqualToThreshold',
    evaluation_periods: 2,
    metric_name: 'CPUUtilization',
    namespace: 'AWS/EC2',
    period: 300,
    statistic: config.web.scaleUp.statistic,
    threshold: config.web.scaleUp.threshold,
    alarm_actions: ['${aws_autoscaling_policy.roofs-on-fire.arn}'],
    alarm_description: 'Web tier CPU utilization too high: scale up',
    $inlines: [
      ['dimensions', {
        AutoScalingGroupName: '${aws_autoscaling_group.web_tier_asg.name}',
      }],
    ],
  }, [
    'CloudWatch Alarm: CPU usage too high',
  ]);


  //
  // CloudWatch metric alarm to trigger scale-down based on CPU usage.
  //
  genesis.addResource('aws_cloudwatch_metric_alarm', 'cpu-usage-too-low', {
    alarm_name: 'cpu-usage-too-low',
    comparison_operator: 'LessThanOrEqualToThreshold',
    evaluation_periods: 2,
    metric_name: 'CPUUtilization',
    namespace: 'AWS/EC2',
    period: 300,
    statistic: config.web.scaleDown.statistic,
    threshold: config.web.scaleUp.threshold,
    alarm_actions: ['${aws_autoscaling_policy.roof-fire-ended.arn}'],
    alarm_description: 'Web tier CPU utilization too low: scale down',
    $inlines: [
      ['dimensions', {
        AutoScalingGroupName: '${aws_autoscaling_group.web_tier_asg.name}',
      }],
    ],
  }, [
    'CloudWatch Alarm: CPU usage too low',
  ]);
};
