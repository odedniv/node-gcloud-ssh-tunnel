# gcloud-ssh-tunnel

Create secure IAM-controlled connections between Google Cloud resources and VM instances!

## Why?

* Become free from VPC firewall rules and start using IAM roles to control access in the Google Cloud.
* Allow yourself to use App Engine *Standard* environment that doesn't allow custom network configuration,
  instead of the slow-ass *Flexible* environment.
* Stop wasting your time trying to connect Cloud Functions to the VPC network.

## How it works with IAM?

Simply give the allowed resource's service account the [`Service Account User`](https://cloud.google.com/compute/docs/access/iam#iam.serviceAccountUser) role,
as well as either [`Compute OS Login`](https://cloud.google.com/compute/docs/access/iam#compute.osLogin)
or (the less recommended) [`Compute OS Admin Login`](https://cloud.google.com/compute/docs/access/iam#compute.osAdminLogin)
(which can be given on a specific VM instance), and start connecting!

## Usage

Install with:

```bash
npm install --save gcloud-ssh-tunnel
```

Then use it:

```javascript
const gcloudSshTunnel = require('gcloud-ssh-tunnel');

let tunnel = gcloudSshTunnel({
  name: "instance-name",
  project: "project-name", // optional, will use gcloud default if not supplied
  zone: "instance-region-and-zone", // optional, will use gcloud default if not supplied
  remotePort: 1234,
  localPort: 1234, // optional, will find a free port if not supplied

  // optional, will use gcloud default and possibly create a new SSH key if it doesn't exist
  // see notes below!
  sshKeyFile: `${process.env.HOME}/.ssh/google_compute_engine`,
});

// the return value is actually a promise (that can also be awaited)
tunnel.then(port => {
  // tunnel is now ready to be connected to in localhost and with the given port!
});
// 
tunnel.end(); // gracefully closes the tunnel (will be left open until all connections were closed)
tunnel.destroy(); // kills the tunnel without waiting for connections

// mostly unnecessary since the child process is unrefed as soon as the tunnel is open (promise has resolved),
// but can be used if you want to allow the NodeJS process to exit while waiting for the tunnel to open
tunnel.unref();
```

### Notes about SSH key file

* If the supplied or default key file doesn't exist, a new one will be created and used.
* If a new SSH key is created, it will not be encrypted (empty passphrase).
  Depends on the situation this may be considered insecure (e.g if you do it in a stealable unencrypted laptop).
* If the given or default SSH key *is* encrypted with a passphrase, you must add the key to ssh-agent first!
  (otherwise you'll get a passphrase prompt in the middle of the execution)
