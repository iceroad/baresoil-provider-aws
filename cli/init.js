const fs = require('fs'),
  fse = require('fs-extra'),
  path = require('path')
  ;

function init(base, args) {
  // Ensure init is run in an empty directory.
  if (fs.readdirSync(process.cwd()).length) {
    return base.getCliCommand('configure').impl.call(this, base, args);
  }

  // Create skeleton baresoil-server.conf.json with just the current provider list.
  const outputFile = 'baresoil-server.conf.json';
  try {
    fs.writeFileSync(outputFile, JSON.stringify({
      provider: base.getProviderList().slice(1).join(','),
    }, null, 2), 'utf-8');
  } catch (e) {
    console.error(
      `Cannot write configuration file "${outputFile}": ${e.message}`);
    return process.exit(1);
  }

  // Copy image setup templates from deploy directory.
  const imageTemplatePath = path.resolve(__dirname, '../deploy/image');
  const imageOutPath = path.resolve('image-setup');
  fse.copySync(imageTemplatePath, imageOutPath);

  // Run "configure"
  return base.getCliCommand('configure').impl.call(this, base, args);
}


module.exports = init;
