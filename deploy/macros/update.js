function update(base, args) {
  base.getCliCommand('gen-terraform').impl.call(this, base, args);
}

module.exports = update;
