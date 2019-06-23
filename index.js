'use strict';

const gcloudSsh = require('gcloud-ssh');
const net = require('net');

class GcloudSshTunnel {
  constructor({ remotePort, localPort, ...sshOptions }) {
    this.remotePort = remotePort;
    this.localPort = localPort;
    this.sshOptions = sshOptions;

    this.connections = [];

    this.result = {
      close: () => this.close(),
    };
  }

  start() {
    let promise = this.promise();
    Object.assign(promise, this.result);
    return promise;
  }

  close() {
    if (this.clientPromise) this.clientPromise.end();
    if (this.server) this.server.close();
    for (let connection of this.connections) {
      connection.end().unref();
    }
  }

  async promise() {
    await this.ssh();
    try {
      await this.listen();
    } catch (err) {
      this.client.end();
      throw err;
    }
    return {
      port: this.localPort,
      client: this.client,
      server: this.server,
      close: () => this.close(),
    };
  }

  async ssh() {
    this.clientPromise = gcloudSsh(this.sshOptions);
    this.client = await this.clientPromise;
    this.client.on('close', () => this.close());
  }

  listen() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer().unref();
      this.server
        .on('listening', () => {
          this.localPort = this.server.address().port;
          resolve();
        })
        .on('error', err => {
          this.close();
          reject(err);
        })
        .on('connection', connection => {
          this.connections.push(connection);
          connection.on('close', () => {
            this.connections.splice(this.connections.indexOf(connection), 1)
          });
          this.client.forwardOut('localhost', this.remotePort, 'localhost', this.remotePort, (err, stream) => {
            if (err) {
              connection.end();
              return;
            }
            connection.pipe(stream).pipe(connection);
          });
        });
      this.server.listen(this.localPort, 'localhost');
    });
  }
}

function gcloudSshTunnel(options) {
  return new GcloudSshTunnel(options).start();
}

module.exports = gcloudSshTunnel;
