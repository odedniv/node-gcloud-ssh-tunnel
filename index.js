'use strict';

const GcloudCli = require('gcloud-cli');
const { spawn } = require('child_process');
const getPort = require('get-port');

class GcloudSshTunnel {
  constructor({ name, project, zone, remotePort, localPort, sshKeyFile }) {
    this.name = name;
    this.project = project;
    this.zone = zone;
    this.remotePort = remotePort;
    this.localPort = localPort;
    this.sshKeyFile = sshKeyFile;

    this.result = {
      end: () => this.process && this.process.stdin.end(),
      destroy: () => this.process && this.process.kill(),
      unref: () => this.process && this.process.unref(),
    };
  }

  start() {
    let promise = new Promise(async (resolve, reject) => {
      while (true) {
        let localPort = this.localPort || await getPort();
        await this.spawn(localPort);
        try {
          await this.monitor();
        } catch (err) {
          if (err.message && err.message.includes('Address already in use') && !this.localPort) {
            // race condition on chose localPort, retrying
            continue;
          }
          reject(err);
          break;
        }
        resolve(localPort);
        break;
      }
    });
    Object.assign(promise, this.result);
    return promise;
  }

  async spawn(localPort) {
    let args = [
      'compute', 'ssh', this.name, '--quiet',
      '--ssh-flag', `-L ${localPort}:localhost:${this.remotePort}`,
      '--command', 'echo READY && cat',
    ];
    if (this.project) args.push('--project', this.project);
    if (this.zone) args.push('--zone', this.zone);
    if (this.sshKeyFile) args.push('--ssh-key-file', this.sshKeyFile);

    this.process = spawn(await GcloudCli.getPath(), args);
  }

  monitor() {
    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";

      this.process
        .on('error', err => {
          delete this.process;
          reject(err);
        })
        .on('exit', (code, signal) => {
          delete this.process;
          // doesn't do anything if the promise was already resolved or rejected
          reject(new Error(`gcloud exited with: ${code || signal}\n${stderr}`));
        });

      // gather STDOUT and STDERR
      this.process.stdout.on('data', data => {
        stdout += data;
        if (stdout.includes('READY')) {
          // echo reached, tunnel is ready
          this.process.unref();
          resolve();
        }
      }).unref();
      this.process.stderr.on('data', data => {
        stderr += data;
        if (stderr.includes('Address already in use')) {
          // tunnel failed, ending
          this.process.unref();
          this.process.stdin.end();
          reject(new Error(`ssh tunnel failed with: ${stderr}`));
        }
      }).unref();
    });
  }
}

function gcloudSshTunnel(options) {
  return new GcloudSshTunnel(options).start();
}

module.exports = gcloudSshTunnel;
