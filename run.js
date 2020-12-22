
const PGManager = require('./src/util/PGManager');
const task = require('./src/task');

process.on('uncaughtException', err => {
  console.error(err);
})


const PG = new PGManager();
PG.connect()
.then(async client => {
  task.setPGClient(PG);
  const marks = await task.getMarkData(['ff808081719202590171a14fb2697742'], 1, 10)
  const data = await task.getMoveData(marks);
  await task.move(data);
  console.log('执行完毕..........\n')
  await PG.end();
})
.catch(error => {
  console.error(error);
})
