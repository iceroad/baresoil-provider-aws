module.exports = {
  name: 'aws',
  paths: {
    root: __dirname,
    cli: 'cli',
    server: 'lib',
  },
  plugins: [
    require('baresoil-plugin-postgres-metastore'),
    require('baresoil-plugin-docker-sandbox'),
    require('baresoil-plugin-s3-blobstore'),
  ],
};
