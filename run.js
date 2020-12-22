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
  // 获取指定用户的标绘
  // const marks = await task.getMarkData([uid], page, limit);
  // 获取带有视频的标绘
  // const marks = await task.getVideoMark(page, limit);
  // 获取剩下的标绘
  const marks = await task.getOtherMark(page, limit);
  const data =  await task.getMoveData(marks);
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
  // const uid = program.uid ? program.uid : 'ff808081719202590171a14fb2697742';
  // const uid = program.uid ? program.uid : 'ff80808171cef6500171dd1f1bc7143b';
  // const uid = program.uid ? program.uid : 'ff80808171cef6500171dd1da3b7142d';
  // const uid = program.uid ? program.uid : 'ff80808171cef6500171de4bf11a1762';
  // const uid = program.uid ? program.uid : 'ff80808171cef6500171dd1df8971433';
  // const uid = program.uid ? program.uid : 'ff80808171cef6500171dd1e34cd1437';
  // const uid = program.uid ? program.uid : 'ff80808171cef6500171dd2200851461';
  // const uid = program.uid ? program.uid : 'ff80808171cef6500171dd1c12431416';
  const uid = program.uid ? program.uid : 'ff80808171cef6500171debb503719f7';

  return { page, limit, uid };
}