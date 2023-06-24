const yaml = require('js-yaml');
const fs = require('fs');

function createPool(collection, pool) {
  let node_cpu = pool.node_group.node_cpu;
  let node_ram = pool.node_group.node_ram;
  let node_count = pool.node_group.node_count;

  collection.insert({
    _key: pool.id,
    name: pool.name,
    description: pool.description,
    user_id: null,
    node_group: pool.node_group,
    operation: null,
    health: pool.health,
    created_at: new Date().toISOString(),
    resources: {
      cpu_total: node_cpu * node_count,
      ram_total: node_ram * node_count,
      nodes_total: node_count,
      cpu_avail: node_cpu * node_count,
      ram_avail: node_ram * node_count,
      nodes_avail: node_count,
      fuzzer_max_cpu: node_cpu,
      fuzzer_max_ram: node_ram
    }
  });
}

function getCollection(col_name) {
  return db._collection(col_name) || db._create(col_name);
}

function createPools(config) {
  db._useDatabase(config.arangodb.database);
  let collection = getCollection(config.arangodb.collection);
  collection.truncate();

  config.pools.forEach((pool) => {
    console.log(`Create pool '${pool.name}'`);
    createPool(collection, pool);
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
  console.log(`Pool setup started. Config path: '${cfg_path}'`);
  createPools(readConfig(cfg_path));
  console.log('Pool setup finished successfully');
}

main(ARGUMENTS);
