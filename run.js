'use strict';

const program = require('commander');

const PGManager = require('./src/util/PGManager');
const task = require('./src/task');

process.on('uncaughtException', err => {
  console.error(err);
});

const { page, limit, uid } = std();
console.log(page, limit, uid);

const PG = new PGManager();
PG.connect()
.then(async () => {
  task.setPGClient(PG);

  const marks = await task.getMarkData([uid], page, limit);
  const data = await task.getMoveData(marks);
  await task.move(data);
  console.log('执行完毕..........\n');
  await PG.end();
})
.catch(error => {
  console.error(error);
  PG.end();
});

function std() {
  // process.stdin.setEncoding('utf-8');
  // const argvs = process.argv;
  // // argvs为数组
  // // 第一个元素为node执行目录
  // // 第二个元素为执行文件的目录
  // // 其余元素为命令参数
  // const bashParams = argvs.splice(2);

  program
    // .version('0.1.0') -V
    .version('0.0.1', '-v, --version') // -v
    .option('-u, --uid <string>', 'Add uid')
    .option('-p, --page <n>', 'Add page', parseInt)
    .option('-l, --limit <n>', 'Add limit', parseInt)
    .parse(process.argv);

  const page = program.page ? program.page : 1;
  const limit = program.limit ? program.limit : 10;
  const uid = program.uid ? program.uid : 'ff808081719202590171a14fb2697742';
  return { page, limit, uid };
}