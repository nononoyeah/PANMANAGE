
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
    const sql = `
      SELECT "id","groupid","layerid","spotid","mtype","userid","filename" AS "filenames","thumb_saved","created_at"
      FROM "mark_copy"
      WHERE "userid" IN (${this.privateArrayToStr(uids)}) AND position('mp4' IN "filename") > 0
      ORDER BY "created_at" DESC
      LIMIT ${limit}
      OFFSET (${(page-1)*limit});`;
    const { rows } = await PG.doQuery(sql);
    return rows;
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
          obj.show_filename = `${spotid}-${index}${filename.slice(filename.lastIndexOf('.'))}`;
        } else {
          const tms = created_at instanceof Date && moment(created_at).format('YYYYMMDDHHmmss');
          obj.show_filename = `${tms}-${index}${filename.slice(filename.lastIndexOf('.'))}`;
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
        filesize,
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
        filesize,
        filetype,
        show_filename,
        cloud_filename,
        thumb_saved,
        thumb: cloud_filename,
        created_at
      }
      if(filetype === 2) {
        const data = await this.video(cloud_filename).catch(err => {
          obj.thumb_saved = false;
          obj.thumb = '';
        });
        obj.thumb_saved = true;
        obj.filesize = data.size;
        obj.duration = data.duration;
        obj.thumb = data.thumb;
      } else {
        const data = await this.image(cloud_filename).catch(err => {
          obj.thumb_saved = false;
          obj.thumb = '';
        });
        obj.thumb_saved = true;
        obj.filesize = data.size;
        obj.duration = '';
      }
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
            ('${uuid.v4()}',${obj.thumb_saved},'${obj.thumb}',${obj.filesize},${obj.filetype},'${obj.duration}','${obj.created_at}','${obj.cloud_filename}','${obj.show_filename}','${obj.spotid}','${obj.layerid}','${obj.groupid}','${obj.userid}',${obj.mtype},'${obj.markid}');`
      }
      logger.info('插入归档数据：\n');
      logger.info('SQL：%s\n', doSql);
      await PG.doQuery(doSql);
    }
  }

  async video(filename) {
    let size = 0;
    let tduration = '';
    try {
      const tempPath = `./video/${Date.now()}${path.extname(filename)}`;
      await s3.headObject(`标绘/${filename}`).catch(err => {
        console.log(err);
        throw new Error(`${filename}文件不存在`);
      });
      await pipeline(s3.getObject(`标绘/${filename}`),fs.createWriteStream(tempPath));
      // 文件大小
      const stat = await fs.promises.stat(tempPath);
      size = stat.size;
      // 首帧，时长
      const { firstFramePath, duration } = ffmpeg.getVideoInfo(tempPath);
      tduration = duration;
      // 上传首帧
      const thumbStream = fs.createReadStream(firstFramePath);
      const pic = `${path.basename(filename, path.extname(filename))}.png`;
      await s3.upload(`thumb/${pic}`, thumbStream);
    } catch (error) {
      logger.error(error);
    }
    return { size, duration: tduration, thumb: pic };
  }

  async image(filename) {
    let size = 0;
    const tempPath = `./image/${Date.now()}${path.extname(filename)}`
    try {
      await s3.headObject(`标绘/${filename}`).catch(err => {
        console.log(err);
        throw new Error(`${filename}文件不存在`);
      });
      await pipeline(s3.getObject(`标绘/${filename}`), fs.createWriteStream(tempPath));
      // 大小
      const stat = await fs.promises.stat(tempPath);
      size = stat.size;
      // 缩略图
      const thumbStream = sharp.compress(fs.createReadStream(tempPath));
      await s3.upload(`thumb/${filename}`, thumbStream);
    } catch (error) {
      logger.error(error);
    }
    return { size };
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
  };
}

module.exports = new Task();
