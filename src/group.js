// 处理队伍缩略图

const fs = require('fs');
const stream = require('stream');
const pipeline = require('util').promisify(stream.pipeline);
const s3 = require('./util/s3');
const sharp = require('./util/sharp');
const logger = require('./logger');

class Group {
  constructor() {
    this.PG;
  }
  setPGClient(pg) {
    this.PG = pg;
  }

  async compressAvatar() {
    const { PG } = this;
    // 组队队伍
    const gsql = 'SELECT "avatar" FROM "groups"';
    const { rows: grows } = await PG.doQuery(gsql);
    logger.info('组队队伍头像：%d', grows.length);
    // 管理队伍
    const msql = 'SELECT "avatar" FROM "manage_groups"';
    const { rows: mrows } = await PG.doQuery(msql);
    logger.info('管理队伍头像：%d', mrows.length);

    // 头像
    const avatars = grows.concat(mrows).map(a => { return a.avatar; });

    // 压缩头像
    for (const a of avatars) {
      await this.image(a);
    }
  }

  async image(filename) {
    const tempPath = `./avatar/${filename}`;
    try {
      await s3.headObject(filename, 'avatar').catch(err => {
        console.log(err);
        throw new Error(`${filename}文件不存在`);
      });
      await pipeline(s3.getObject(filename, 'avatar'), fs.createWriteStream(tempPath));
      // 大小
      const stat = await fs.promises.stat(tempPath);
      console.log(stat.size);
      if(!stat.size) {
        throw new Error(`${filename}文件已损坏`);
      }
      // 缩略图
      const thumbStream = sharp.compress(fs.createReadStream(tempPath));
      await s3.upload(filename, thumbStream, 'avatar');
    } catch (error) {
      logger.error(error);
    }
  }
}

module.exports = new Group();