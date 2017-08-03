module.exports = function s3(config, genesis) {
  //
  // S3 Bucket for blob storage.
  //
  genesis.addResource('aws_s3_bucket', 'blobstore-bucket', {
    bucket_prefix: `${config.vpc.clusterId}-blob-`,
    acl: 'private',
    region: config.s3.region || config.credentials.region,
    versioning: {
      // Bucket object versioning is not strictly needed, but allows
      // inter-region replication if required.
      enabled: true,
    },
    $inlines: [
      ['tags', {
        Name: `${config.vpc.clusterId}:BlobStore`,
      }],
    ],
  }, [
    'S3 Bucket for storing immutable blobs.',
  ]);

  genesis.addOutput('blobBucketName', {
    value: '${aws_s3_bucket.blobstore-bucket.id}',
  }, [
    'Output "blobBucketName": S3 bucket for immutable blob storage.',
  ]);
};
