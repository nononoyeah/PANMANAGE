'use strict';

const S3 = require('aws-sdk/clients/s3');
const { prod, local } = require('../../config.json');

const config = process.platform === 'win32' ? local : prod;
const { accessKeyId, secretAccessKey, endpoint,s3ForcePathStyle,region } = config.s3.client;

class S3Manager {
  constructor() {
    this.s3 = new S3({ 
      accessKeyId, 
      secretAccessKey, 
      endpoint,
      s3ForcePathStyle,
      region
    });
  }

  getObject(Key, bucket) {
    return this.s3.getObject({
      Bucket: bucket ? bucket : config.s3.bucket.initial,
      Key,
    }).createReadStream();
  }

  getObjectPromise(Key, bucket) {
    return this.s3.getObject({
      Bucket: bucket ? bucket : config.s3.bucket.initial,
      Key,
    }).promise();
  }

  upload(Key, Body, bucket) {
    // const options = { partSize: 10 * 1024 * 1024, queueSize: 1 };
    return this.s3.upload({
      Bucket: bucket ? bucket : config.s3.bucket.initial,
      Key,
      Body,
    }/* , options*/).promise().then(data => {
      console.log(data);
    });
  }

  deleteObject(Key, bucket) {
    return this.s3.deleteObject({
      Bucket: bucket ? bucket : config.s3.bucket.initial,
      Key,
    }).promise();
  }

  listObjectsV2(folder, bucket) {
    return this.s3.listObjectsV2({
      Bucket: bucket ? bucket : config.s3.bucket.initial,
      Prefix: folder,
    }).promise();
  }

  deleteObjects(Objects, bucket) {
    return this.s3.deleteObjects({
      Bucket: bucket ? bucket : config.s3.bucket.initial,
      Delete: {
        Objects,
      },
    }).promise();
  }
  
  headObject(Key, bucket) {
    return this.s3.getObject({
      Bucket: bucket ? bucket : config.s3.bucket.initial,
      Key,
    }).promise();
  }

}


module.exports = new S3Manager();
