const _ = require('lodash');


function route53(config, genesis) {
  if (!config.web.ami) {
    console.debug('Not setting up Route53 because no web AMI yet.');
    return;
  }

  if (config.domains.useTld) {
    const elbName = `${config.vpc.clusterId}-elb`;
    _.forEach(config.domains.domainList, (tld) => {
      const tfId = tld.name.replace(/[^A-Za-z0-9]/g, '_');
      genesis.addResource('aws_route53_record', tfId, {
        zone_id: tld.zoneId,
        name: tld.name,
        type: 'A',
        $inlines: [
          ['alias', {
            name: `\${aws_elb.${elbName}.dns_name}`,
            zone_id: `\${aws_elb.${elbName}.zone_id}`,
            evaluate_target_health: true,
          }],
        ],
      }, [
        `AWS Route53 Record for domain: ${tld.name}`,
      ]);

      const tfIdWild = `wild-${tld.name.replace(/[^A-Za-z0-9]/g, '_')}`;
      genesis.addResource('aws_route53_record', tfIdWild, {
        zone_id: tld.zoneId,
        name: `*.${tld.name}`,
        type: 'A',
        $inlines: [
          ['alias', {
            name: `\${aws_elb.${elbName}.dns_name}`,
            zone_id: `\${aws_elb.${elbName}.zone_id}`,
            evaluate_target_health: true,
          }],
        ],
      }, [
        `AWS Route53 Record for domain wildcard: *.${tld.name}`,
      ]);
    });
  }
}

module.exports = route53;
