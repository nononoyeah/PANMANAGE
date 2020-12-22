'use strict';

const sharp = require('sharp');

class SharpService {
/**
 * toFile
 * @param {String} basePicture 源文件路径
 * @param {String} newFilePath 新文件路径
 */
  writeTofile(basePicture, newFilePath) {
    sharp(basePicture)
      .rotate(20) // 旋转
      .resize(500, 500) // 缩放
      .toFile(newFilePath);
  }

  /**
   * (流式处理)压缩文件
   * @param {Stream} inputStream 输入流
   * @param {Number} width 宽度
   * @param {Number} height 高度
   */
  compress(inputStream, width = 120, height = 120) {
    const transformer = sharp().resize({
      width,
      height,
      fit: sharp.fit.cover,
      position: sharp.strategy.entropy,
    });
    // 将文件读取到的流数据写入transformer进行处理
    inputStream.pipe(transformer);
    return transformer;
  }
}

module.exports = new SharpService();
