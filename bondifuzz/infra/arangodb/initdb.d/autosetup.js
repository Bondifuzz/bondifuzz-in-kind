const db_users = require('@arangodb/users');
const yaml = require('js-yaml');
const fs = require('fs');

function readConfig(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  return yaml.safeLoad(content);
}

function getValues(dict, keys) {
  return keys.map((key) => {
    if (key in dict) {
      return dict[key];
    } else {
      msg = 'Config entry lookup error';
      actual_keys = `Actual keys: [${Object.keys(dict)}]`;
      expected_keys = `Expected keys: [${keys}]`;
      help_info = `${expected_keys}. ${actual_keys}`;
      throw new Error(`${msg}: '${key}'. ${help_info}`);
    }
  });
}

function switchDatabase(db_name, callback) {
  old_db_name = db._name();
  db._useDatabase(db_name);
  callback();
  db._useDatabase(old_db_name);
}

function autoSetup(config) {
  const keys = ['users', 'databases', 'grants'];
  const [users, databases, grants] = getValues(config, keys);

  console.log('Creating users...');
  setupUsers(users);

  console.log('Creating databases...');
  setupDatabases(databases);

  console.log('Creating grants...');
  setupGrants(grants);
}

function setupUsers(users) {
  const keys = ['username', 'password'];
  users.forEach((user) => {
    const [username, password] = getValues(user, keys);
    if (!db_users.exists(username)) {
      db_users.save(username, password, true);
      console.log(`User '${username}' created`);
    } else {
      console.log(`User '${username}' already exists`);
    }
  });
}

function setupDatabases(databases) {
  const keys = ['name', 'collections'];
  databases.forEach((database) => {
    const [name, collections] = getValues(database, keys);
    if (!db._databases().includes(name)) {
      db._createDatabase(name);
      console.log(`Database '${name}' created`);
    } else {
      console.log(`Database '${name}' already exists`);
    }
    switchDatabase(name, () => {
      setupCollections(collections);
    });
  });
}

function setupCollections(collections) {
  const keys = ['name', 'type', 'indexes'];
  collections.forEach((collection) => {
    const options = {};
    const [name, type, indexes] = getValues(collection, keys);
    if (!db._collection(name)) {
      db._create(name, options, type);
      console.log(`Collection '${name}' created`);
    } else {
      console.log(`Collection '${name}' already exists`);
    }
    setupIndexes(db._collection(name), indexes);
  });
}

function setupIndexes(collection, indexes) {
  const fields_required = ['name', 'type', 'fields'];
  indexes.forEach((index) => {
    getValues(index, fields_required);
    if (!collection.indexes().find((x) => x.name === index['name'])) {
      collection.ensureIndex(index);
      console.log(`Index '${index['name']}' created`);
    } else {
      console.log(`Index '${index['name']}' already exists`);
    }
  });
}

function setupGrants(grants) {
  const keys = ['username', 'database', 'permissions'];
  grants.forEach((grant) => {
    const [username, database, permissions] = getValues(grant, keys);
    db_users.grantDatabase(username, database, permissions);
    msg = `Granted '${permissions}' access to user '${username}' on database '${database}'`;
    console.log(msg);
  });
}

function main(argv) {
  if (argv.length != 1) {
    console.error('Usage: ./autosetup.js <config-path>');
    return;
  }

  const cfg_path = argv[0];
  console.log(`Autosetup started. Config path: '${cfg_path}'`);
  autoSetup(readConfig(cfg_path));
  console.log('Autosetup finished successfully');
}

main(ARGUMENTS);
