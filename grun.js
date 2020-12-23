'use strict';

const PGManager = require('./src/util/PGManager');
const group = require('./src/group');

process.on('uncaughtException', err => {
  console.error(err);
});


const PG = new PGManager();
PG.connect()
.then(async () => {
  group.setPGClient(PG);
  await group.compressAvatar();
  console.log('执行完毕..........\n');
  await PG.end();
})
.catch(error => {
  console.error(error);
  PG.end();
});


