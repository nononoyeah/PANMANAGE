'use strict';

const pg = require('pg');
const { prod, local } = require('../../config.json');

class PGManager {
  constructor() {
    const config = process.platform === 'win32' ? local : prod;
    //tcp://用户名：密码@localhost/数据库名
    const { connect: strConnent } = config;
    this.strConnent = strConnent;
    this.client;
  }

  // 连接PG
  connect() {
    //客户端连接，进行数据插入
    return new Promise((resolve, reject) => {
      const client =  new pg.Client(this.strConnent);
      client.connect((error/*, results*/) => {
        if (error) {
          console.error('PG connection Error:' + error.message);
          client.end();
          reject(error);
        }
        console.log('PG connection success...\n');
        this.client = client;
        resolve(client);
      });
    });
  }

  async end() {
    this.client && await this.client.end();
  }
  // 执行查询
  doQuery(sql) {
    return new Promise((resolve, reject) => {
      this.client.query(sql,function(error,results) {
        if(error) {
          console.error(error);
          reject(error);
        }
        resolve(results);
      });
    });
  }
}

module.exports = PGManager;