'use strict';
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const ffmpegStatic = require('ffmpeg-static');
// const os = require('os');
// const path = require('path');

class FfmpegService {

  /**
   * 获取视频文件信息
   * mov,mp4,m4a,3gp,3g2,mj2
   * @param {String} videoPath 视频文件路径
   */
  async getVideoInfo(videoPath) {
    console.error(ffmpegStatic);
    // const firstFramePath = path.join(os.tmpdir(), `${Date.now()}.png`);
    const firstFramePath = `./thumb/${Date.now()}.png`;
    // 输出首帧文件
    const bash = `${ffmpegStatic} -i ${videoPath} -y -f image2 -ss 00:00:01 -t 0.001 ${firstFramePath}`;
    const { /* stdout, */ stderr } = await exec(bash).catch(error => {
      console.error('获取视频首帧失败: %o\n', error);
    });
    // console.error(stdout, stderr);
    // 提取视频时长
    const duration = this.privateFindDuration(stderr);
    console.log(firstFramePath, duration);
    return { firstFramePath, duration };
  }

  privateFindDuration(stderr) {
    const regexDuration = new RegExp(/Duration: (.*?), /);
    const ma = typeof stderr === 'string' && stderr.match(regexDuration);
    return ma ? ma[1] : '00:00:00';
  }
}

module.exports = new FfmpegService();
