'use strict';

const { OsLoginServiceClient } = require('@google-cloud/os-login');
const ssh = require('ssh2');
const net = require('net');
const sshpk = require('sshpk');

class GcloudSshTunnel {
  constructor({ host, remotePort, localPort, keyFilename }) {
    this.host = host;
    this.remotePort = remotePort;
    this.localPort = localPort;
    this.osLoginServiceClient = new OsLoginServiceClient({ keyFilename });

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
    if (this.client) this.client.end();
    if (this.server) this.server.close();
    for (let connection of this.connections) {
      connection.end().unref();
    }
  }

  async promise() {
    await this.osLogin();
    try {
      await this.ssh();
      await this.listen();
    } catch (err) {
      this.close();
      throw err;
    } finally {
      await this.osLogout();
    }
    return this.localPort;
  }

  async osLogin() {
    let response = await this.osLoginServiceClient.importSshPublicKey({
      parent: `users/${await this.user}`,
      sshPublicKey: { key: this.key.toPublic().toString() },
    });
    this.loginProfile = response[0].loginProfile;
  }

  async osLogout() {
    let fingerprint = Object.keys(this.loginProfile.sshPublicKeys).find(
      fingerprint => this.loginProfile.sshPublicKeys[fingerprint].key === this.key.toPublic().toString()
    );
    if (fingerprint) {
      await this.osLoginServiceClient.deleteSshPublicKey({
        name: `users/${await this.user}/sshPublicKeys/${fingerprint}`
      });
    }
  }

  listen() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer().unref();
      this.server
        .on('listening', () => {
          this.localPort = this.server.address().port;
          resolve();
        })
        .on('error', reject)
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

  ssh() {
    return new Promise((resolve, reject) => {
      this.client = new ssh();
      this.client
        .on('ready', resolve)
        .on('error', reject)
        .on('close', () => this.close());
      this.client.connect({
        host: this.host,
        username: this.loginProfile.posixAccounts[0].username,
        privateKey: this.key.toString(),
      });
      this.client._sock.unref();
    });
  }

  get user() {
    if (!this._user) {
      this._user = new Promise(async resolve => {
        let credentials = await this.osLoginServiceClient.auth.getCredentials();
        resolve(credentials.client_email);
      });
    }
    return this._user;
  }

  get key() {
    if (!this._key) {
      this._key = sshpk.generatePrivateKey('ecdsa');
    }
    return this._key;
  }
}

function gcloudSshTunnel(options) {
  return new GcloudSshTunnel(options).start();
}

module.exports = gcloudSshTunnel;
