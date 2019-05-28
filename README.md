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
  // either instance or host must be supplied
  instance: {
    zone: "gcp-region-with-zone", // e.g. us-east1-d
    name: "instance-name",
  },
  host: "host-or-ip",

  remotePort: 1234,
  localPort: 1234, // optional, will find a free port if not supplied

  projectId, // optional, project of the instance
  keyFilename: "path/to/service-account-keyfile.json", // optional, path to service account's keyfile
});

// the return value is actually a promise (that can also be awaited)
tunnel.then(port => {
  // tunnel is now ready to be connected to in localhost and with the given port!
});
// 
tunnel.close(); // closes the tunner and ends all client connections
```
