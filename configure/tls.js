const _ = require('lodash'),
  async = require('async'),
  chalk = require('chalk'),
  inquirer = require('inquirer'),
  AWS = require('aws-sdk')
  ;


function getTLSCertificate(base, args, diskConfig, state) {
  return (cb) => {
    const config = _.get(diskConfig, 'master.aws.tls', {});
    const domainList = state.domainList || config.domainList;
    const domainListStr = _.map(domainList, d => chalk.bold(d.name)).join(', ');

    // SANs required on the candidate certificate, and preferred (with wildcards).
    const sansRequired = _.map(domainList, 'name');
    const sansPreferred = _.flatten(_.map(domainList, (domain) => {
      return [domain.name, `*.${domain.name}`];
    }));
    const sansRequiredStr = _.map(sansRequired, s => chalk.bold(s)).join(', ');
    const sansPreferredStr = _.map(sansPreferred, s => chalk.bold(s)).join(', ');

    console.log(`
SSL/TLS Certificate Setup
─────────────────────────
Requires either an Administrator-level API access key, or the following security
policies attached to the current key: ${chalk.bold('AWSCertificateManagerFullAccess')},

Domains: ${domainListStr}
SANs required on certificate: ${sansRequiredStr}
SANs preferred on certificate: ${sansPreferredStr}`);

    // Prompt whether to use HTTPS or not.
    const questions = [
      {
        type: 'confirm',
        name: 'useTls',
        message: 'Use an Amazon Certificate Manager certificate for HTTPS support?',
        default: config.useTls || true,
      },
    ];

    return inquirer.prompt(questions).then((answers) => {
      if (!answers.useTls) {
        return cb(null, {
          tls: answers,
        });
      }

      const ACM = new AWS.ACM();
      ACM.listCertificates((err, data) => {
        if (err) return cb(err);

        const metadataRunners = _.map(data.CertificateSummaryList, (certSum) => {
          return cb => ACM.describeCertificate({
            CertificateArn: certSum.CertificateArn,
          }, (err, certDetails) => {
            if (err) return cb(err);
            const cert = certDetails.Certificate;
            return cb(null, {
              sanList: cert.SubjectAlternativeNames,
              name: cert.DomainName,
              arn: cert.CertificateArn,
              status: cert.Status,
            });
          });
        });

        return async.parallelLimit(metadataRunners, 5, (err, certificates) => {
          if (err) return cb(err);
          console.log(
            `Found ${chalk.bold(certificates.length)} TLS certificates in ` +
            `ACM region ${chalk.bold(state.region)}.`);

          // Find a minimum and preferred certificate.
          let minCert, prefCert;
          _.forEach(certificates, (cert) => {
            const isMinimum = _.isEmpty(_.difference(sansRequired, cert.sanList));
            const isPreferred = _.isEmpty(_.difference(sansPreferred, cert.sanList));
            if (isMinimum) minCert = cert;
            if (isPreferred) prefCert = cert;
            if (isMinimum || isPreferred) {
              console.log(
                `Found a ${isPreferred ? chalk.green('preferred') : 'satisfying'} TLS ` +
                  `certificate: status=${cert.status} name=${chalk.yellow(cert.name)}`);
            }
          });

          if (!minCert) {
            return cb(new Error(
              `Could not find a certificate in ACM ${chalk.bold(state.region)} that includes ` +
              `all required SANs: ${sansRequiredStr}`));
          }

          const resultCert = prefCert || minCert;
          if (resultCert.status !== 'ISSUED') {
            return cb(new Error(
              `Found a certificate, but status is "${resultCert.status}", not ` +
                `"ISSUED": arn=${resultCert.arn}`));
          }

          return cb(err, {
            tls: {
              useTls: true,
              cert: resultCert,
            },
          });
        });
      });
    });
  };
}

module.exports = getTLSCertificate;
