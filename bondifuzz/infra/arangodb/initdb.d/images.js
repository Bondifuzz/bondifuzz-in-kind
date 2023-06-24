const yaml = require('js-yaml');
const fs = require('fs');

function createLang(collection, lang) {
  collection.insert({
    _key: lang.id,
    display_name: lang.display_name,
  });
}

function createEngine(collection, engine) {
  collection.insert({
    _key: engine.id,
    display_name: engine.display_name,
    langs: engine.langs,
  });
}

function createImage(collection, image) {
  collection.insert({
    _key: image.id,
    name: image.name,
    description: image.description,
    engines: image.engines,
    status: image.status,
  });
}

function getCollection(col_name) {
  return db._collection(col_name) || db._create(col_name);
}

function createLangs(config) {
  db._useDatabase(config.arangodb.database);
  let collection = getCollection(config.arangodb.collections.langs);
  collection.truncate();

  config.langs.forEach((lang) => {
    console.log(`Create lang '${lang.display_name}'`);
    createLang(collection, lang);
  });
}

function createEngines(config) {
  db._useDatabase(config.arangodb.database);
  let collection = getCollection(config.arangodb.collections.engines);
  collection.truncate();

  config.engines.forEach((engine) => {
    console.log(`Create engine '${engine.display_name}'`);
    createEngine(collection, engine);
  });
}

function createImages(config) {
  db._useDatabase(config.arangodb.database);
  let collection = getCollection(config.arangodb.collections.images);
  collection.truncate();

  config.images.forEach((image) => {
    console.log(`Create image '${image.display_name}'`);
    createImage(collection, image);
  });
}

function readConfig(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  return yaml.safeLoad(content);
}

function main(argv) {
  if (argv.length != 1) {
    console.error('Usage: ./pools.js <config-path>');
    return;
  }

  const cfg_path = argv[0];
  console.log(`Images setup started. Config path: '${cfg_path}'`);
  const config = readConfig(cfg_path);

  console.log(`Creating langs...`);
  createLangs(config);
  console.log(`Creating langs... OK`);

  console.log(`Creating engines...`);
  createEngines(config);
  console.log(`Creating engines... OK`);

  console.log(`Creating images...`);
  createImages(config);
  console.log(`Creating images... OK`);

  console.log('Images setup finished successfully');
}

main(ARGUMENTS);
