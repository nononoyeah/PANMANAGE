// 处理历史标绘缩略图

const fs = require('fs');
const path = require('path');
const moment = require('moment');
const stream = require('stream');
const pipeline = require('util').promisify(stream.pipeline);
const ffmpeg = require('./util/ffmpeg');
const s3 = require('./util/s3');
const sharp = require('./util/sharp');
const uuid = require('uuid');
const logger = require('./logger');

class Task {
  constructor() {
    this.PG;
  }

  setPGClient(pg) {
    this.PG = pg;
  }

  async getMarkData(uids, page = 1, limit = 10) {
    const { PG } = this;
    // AND position('mp4' IN "filename") > 0
    const sql = `
      SELECT "id","groupid","layerid","spotid","mtype","userid","filename" AS "filenames","thumb_saved","created_at"
      FROM "mark_copy"
      WHERE "userid" IN (${this.privateArrayToStr(uids)}) AND position('mp4' IN "filename") > 0
      ORDER BY "created_at" DESC
      LIMIT ${limit}
      OFFSET ${(page - 1) * limit};`;
    logger.info('本次标绘查询语句：%s\n', sql);
    const { rows } = await PG.doQuery(sql);
    return rows;
  }
  
  async getVideoMark(page, limit) {
    const { PG } = this;
    const uids = [
      'ff808081719202590171a14fb2697742',
      'ff80808171cef6500171dd1f1bc7143b',
      'ff80808171cef6500171dd1da3b7142d',
      'ff80808171cef6500171de4bf11a1762',
      'ff80808171cef6500171dd1df8971433',
      'ff80808171cef6500171dd1e34cd1437',
      'ff80808171cef6500171dd2200851461',
      'ff80808171cef6500171dd1c12431416',
      'ff80808171cef6500171debb503719f7'
    ];
    const sql = `
      SELECT "id","groupid","layerid","spotid","mtype","userid","filename" AS "filenames","thumb_saved","created_at"
      FROM "mark_copy"
      WHERE "userid" IN (${this.privateArrayToStr(uids)}) AND position('mp4' IN "filename") > 0
      ORDER BY "created_at" DESC
      LIMIT ${limit}
      OFFSET ${(page - 1) * limit};`;
    logger.info('本次标绘查询语句：%s\n', sql);
    const { rows } = await PG.doQuery(sql);
    return rows;
  }

  async getOtherMark(page, limit) {
    const { PG } = this;
    const uids = [
      'ff808081719202590171a14fb2697742',
      'ff80808171cef6500171dd1f1bc7143b',
      'ff80808171cef6500171dd1da3b7142d',
      'ff80808171cef6500171de4bf11a1762',
      'ff80808171cef6500171dd1df8971433',
      'ff80808171cef6500171dd1e34cd1437',
      'ff80808171cef6500171dd2200851461',
      'ff80808171cef6500171dd1c12431416',
      'ff80808171cef6500171debb503719f7'
    ];
    const sql = `
      SELECT "id","groupid","layerid","spotid","mtype","userid","filename" AS "filenames","thumb_saved","created_at"
      FROM "mark_copy"
      WHERE "userid" NOT IN (${this.privateArrayToStr(uids)})
      ORDER BY "created_at" DESC
      LIMIT ${limit}
      OFFSET ${(page - 1) * limit};`;
    logger.info('本次标绘查询语句：%s\n', sql);
    const { rows } = await PG.doQuery(sql);
    return rows;
  }

  async getSpecialMark() {
    const { PG } = this;

    const sql = `
    SELECT "id","groupid","layerid","spotid","mtype","userid","filename" AS "filenames","thumb_saved","created_at"
    FROM "mark_copy"
    WHERE "id" = '7657e67f-8704-47cd-b3b4-6c044324feea';`;
    logger.info('本次标绘查询语句：%s\n', sql);
    const { rows } = await PG.doQuery(sql);
    return rows;
  }

  async syncToMark() {
    const { PG } = this;
    // pan_mark_copy 
    const sqlp = 'SELECT DISTINCT("markid") FROM "pan_mark_copy" ';
    const { rows: p } = await PG.doQuery(sqlp);
    // 同步成功的标绘ID
    const markids_success = p.map(r => { return r.markid; });
    // mark_copy
    // const sqlm = 'SELECT DISTINCT("markid") FROM "mark_copy" AND "created_at" <= \'2020-12-21 07:36:33.497+00\'';
    const sqlm = 'SELECT DISTINCT("id") FROM "mark_copy"';
    const { rows: m } = await PG.doQuery(sqlm);
    const ids = m.map(r => { return r.id; });

    // 同步失败的标绘ID
    const markids_failed = ids.filter(i => { return !markids_success.includes(i); });

    // mark_copy
    const sql2 = `UPDATE "mark_copy" SET "thumb_saved"=TRUE WHERE "id" IN(${this.privateArrayToStr(markids_success)})`;
    const sql3 = `UPDATE "mark_copy" SET "thumb_saved"=FALSE WHERE "id" IN(${this.privateArrayToStr(markids_failed)})`;
    logger.info('本次标绘更新：同步成功的数量：%d\n语句sql2：%s\n', markids_success.length, sql2);
    logger.info('本次标绘更新：同步失败的数量：%d\n语句sql3：%s\n', markids_failed.length, sql3);

    await PG.doQuery(sql2);
    markids_failed.length && await PG.doQuery(sql3);
  }

  async getMoveData(marks) {
    const data = [];
    for (const mark of marks) {
      const {
        id: markid,
        groupid,
        layerid,
        spotid,
        mtype,
        userid,
        filenames,
        thumb_saved,
        created_at
      } = mark;
      const arr = filenames ? filenames.split(',') : [];
      for (let index = 0; index < arr.length; index++) {
        const filename = arr[index];
        const obj = {
          markid,
          mtype,
          userid,
          cloud_filename: filename,
          thumb_saved,
          created_at: created_at instanceof Date && created_at.toLocaleString()
        };
        if (spotid) {
          obj.show_filename = `${spotid}-${index + 1}${filename.slice(filename.lastIndexOf('.'))}`;
        } else {
          const tms = created_at instanceof Date && moment(created_at).format('YYYYMMDDHHmmss');
          const mms = this.privateGenmms(index);
          obj.show_filename = `${tms}${mms}${filename.slice(filename.lastIndexOf('.'))}`;
        }
        obj.groupid = groupid ? groupid : '';
        obj.layerid = layerid ? layerid : '';
        obj.spotid = spotid ? spotid : '';
        obj.filetype = [ '.mp4', '.MP4' ].includes(path.extname(filename)) ? 2 : 1;
        obj.filesize = 0;
        data.push(obj);
      }
    }
    return data;
  }
  
  async move(data) {
    for (let index = 0; index < data.length; index++) {
      const {
        markid,
        mtype,
        userid,
        groupid,
        layerid,
        spotid,
        filetype,
        show_filename,
        cloud_filename,
        thumb_saved,
        created_at
      } = data[index];
      const obj = {
        markid,
        mtype,
        userid,
        groupid,
        layerid,
        spotid,
        filetype,
        show_filename,
        cloud_filename,
        thumb_saved,
        created_at
      };
      let media = {
        size: 0,
        thumb_saved: false,
        thumb: '',
        duration: '',
      };
      if(filetype === 2) {
        media = await this.video(cloud_filename);
      } else {
        media = await this.image(cloud_filename);
      }
      obj.thumb_saved = media.thumb_saved;
      obj.filesize = media.size;
      obj.duration = media.duration;
      obj.thumb = media.thumb;

      const { PG } = this;
      const sql = `SELECT "id" FROM "pan_mark_copy" WHERE "markid" = '${markid}' AND "cloud_filename"='${cloud_filename}'`;
      const { rows } = await PG.doQuery(sql);

      let doSql = '';
      if(rows.length) {
        doSql = `
        UPDATE "pan_mark_copy" SET
          "thumb_saved"=${obj.thumb_saved},
          "thumb"='${obj.thumb}',
          "filesize"=${obj.filesize},
          "filetype"=${obj.filetype},
          "duration"='${obj.duration}', 
          "created_at"='${obj.created_at}', 
          "cloud_filename"='${obj.cloud_filename}', 
          "show_filename"='${obj.show_filename}', 
          "spotid"='${obj.spotid}', 
          "layerid"='${obj.layerid}',
          "groupid"='${obj.groupid}',
          "userid"='${obj.userid}',
          "mtype"=${obj.mtype},
          "markid"='${obj.markid}'
        WHERE "id" = '${rows[0].id}'`;
      } else {
        doSql = `
          INSERT INTO "pan_mark_copy"
            ("id","thumb_saved","thumb","filesize","filetype","duration","created_at","cloud_filename","show_filename","spotid","layerid","groupid","userid","mtype","markid")
          VALUES
            ('${uuid.v4()}',${obj.thumb_saved},'${obj.thumb}',${obj.filesize},${obj.filetype},'${obj.duration}','${obj.created_at}','${obj.cloud_filename}','${obj.show_filename}','${obj.spotid}','${obj.layerid}','${obj.groupid}','${obj.userid}',${obj.mtype},'${obj.markid}');`;
      }
      logger.info('插入归档数据：\n');
      logger.info('SQL：%s\n', doSql);
      await PG.doQuery(doSql);
    }
  }

  async video(filename) {
    const data = {
      size: 0,
      duration: '',
      thumb: '',
      thumb_saved: false,
    };
    try {
      const tempPath = `./video/${Date.now()}${path.extname(filename)}`;
      await s3.headObject(`标绘/${filename}`).catch(err => {
        console.log(err);
        throw new Error(`${filename}文件不存在`);
      });
      await pipeline(s3.getObject(`标绘/${filename}`),fs.createWriteStream(tempPath));
      // 文件大小
      const stat = await fs.promises.stat(tempPath);
      console.log(stat.size);
      if(!stat.size) {
        throw new Error(`${filename}文件已损坏`);
      }
      // 首帧，时长
      const { firstFramePath, duration } = await ffmpeg.getVideoInfo(tempPath);
      // 上传首帧
      const thumbStream = fs.createReadStream(firstFramePath);
      const pic = `${path.basename(filename, path.extname(filename))}.png`;
      await s3.upload(`thumb/${pic}`, thumbStream);

      data.size = stat.size;
      data.duration = duration;
      data.thumb = pic;
      data.thumb_saved = true;
    } catch (error) {
      logger.error(error);
    }
    return data;
  }

  async image(filename) {
    const data = {
      size: 0,
      duration: '',
      thumb: '',
      thumb_saved: false,
    };
    const tempPath = `./image/${Date.now()}${path.extname(filename)}`;
    try {
      await s3.headObject(`标绘/${filename}`).catch(err => {
        console.log(err);
        throw new Error(`${filename}文件不存在`);
      });
      await pipeline(s3.getObject(`标绘/${filename}`), fs.createWriteStream(tempPath));
      // 大小
      const stat = await fs.promises.stat(tempPath);
      console.log(stat.size);
      if(!stat.size) {
        throw new Error(`${filename}文件已损坏`);
      }
      // 缩略图
      const thumbStream = sharp.compress(fs.createReadStream(tempPath));
      await s3.upload(`thumb/${filename}`, thumbStream);

      data.size = stat.size;
      data.thumb = filename;
      data.thumb_saved = true;
    } catch (error) {
      logger.error(error);
    }
    return data;
  }


  // 用于sql语句in查询
  privateArrayToStr(arr) {
    let str = '';
    for (let index = 0; index < arr.length; index++) {
      const element = arr[index];
      if (index === arr.length - 1) {
        if (typeof element === 'string') {
          str += `'${element}'`;
        } else if (typeof element === 'number') {
          str += `${element}`;
        }
      } else {
        if (typeof element === 'string') {
          str += `'${element}',`;
        } else if (typeof element === 'number') {
          str += `${element},`;
        }
      }
    }
    return str;
  }

  privateGenmms(index) {
    const mms = String(index);
    return index > 999 ? mms.slice(-3) : mms.padStart(3, '0');
  }
}

module.exports = new Task();
