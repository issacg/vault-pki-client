# vault-pki-client

## Synopsis

vault-pki-client is a tool, similar to [consul-template](https://github.com/hashicorp/consul-template)
but crafted specifically for [Vault](https://vaultproject.io) and the
[PKI (certificate) secret backend](https://vaultproject.io/docs/secrets/pki/index.html)

The tool will connect to a Vault server and periodically request a x509 keypair,
save the generated keypair to files, and optionally execute a command each time
the files are updated.  The tool runs as a daemon (unless the `--once` argument
is given), and will continue to run in the background and update the keypair
shortly before it expires.  The idea is to enable system administrators to
request shorter TTLs, aligning with Vault's principle of short-lived one-time
secrets.

## Installation

If you have node.js installed, simply `npm -g vault-pki-client`

If you don't have node.js installed, you can [download a binary package](https://github.com/issacg/vault-pki-client/releases/latest)

## Configuration

### Methods

vault-pki-client makes use of the excellent [rc](https://github.com/dominictarr/rc) module,
so variables can be passed as command line parameters, environment variables or
provided via a configuration file named .vault-pki-clientrc

For more detailed information about how to set parameters, see the [rc](https://github.com/dominictarr/rc#standards) page.

### Options

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| `vault.server.address` | `http://127.0.0.1:8200` | The protocol, hostname and port of the Vault server. |
| `vault.server.ca-cert` | None | Path to a PEM-encoded CA cert file to use to verify the Vault server SSL certificate |
| `vault.server.ca-path` | None | Path to a directory of PEM-encoded CA cert files to verify the Vault server SSL certificate. |
| `vault.server.tls-skip-verify` | `false` | If set, do not verify Vault's presented certificate before communicating with it. Setting this variable is not recommended except during testing. |
| `vault.server.api-version` | `v1` | The API version to use when communicating with the Vault server.  For now, only `v1` is supported. |
| `vault.pki.path` | `pki` | The path to the requested pki mount point in the Vault server. |
| `vault.pki.role` | None (**required**) | The name of the role used to request the client certificate pair.  See [the Vault documentation](https://vaultproject.io/docs/secrets/pki/index.html) for details of how to configure this in the Vault server. |
| `vault.token` | None | The token used to authenticate to the Vault server. |
| `vault.token-renewable` | `false` | If `true`, vault-pki-client will attempt to renew the token based on the TTL of the token. The token will be renewed immediately on startup to determine the TTL. |
| `certCN` | The hostname of the machine running vault-pki-client | The Common Name (CN) to be used in the requested x509 keypair.  For example, `foo.example.com`.  The value specified here must be a valid CN based on the role defined in `vault.pki.role` or the request will be rejected by the Vault server. |
| `certTTL` | None | The TTL of the keypair being requested by the Vault server.  In a production environment, this should normally be kept to a reasonably low value.  See [the Vault documentation](https://vaultproject.io/docs/secrets/pki/index.html).  If not specified, the Vault server will use the configured default lease TTL.  Note that the value specified may not exceed the maximum TTL defined on the Vault server mount. |
| `certFile` | `client.pem` | The file to store the x509 certificate returned by the Vault server. |
| `keyFile` | `client.key` | The file to store the private key for the certificate returned by the Vault server. |
| `caFile` | None | If specified, the file to store the certificate of the CA used to sign `certFile`.  If empty, the CA certificate will not be written to disk. |
| `onUpdate` | None | A command to run after updating the keypair.  Can be used to restart services.  For example `service httpd restart`.  The command should exit quickly - if you want to start a service, don't start the service directly, but rather write a short-running script/batch file to start the service. |
| `renewalCoefficient` | `0.9` | A coefficient applied to TTLs returned by the Vault server to determine when to renew secrets returned by the vault server.  A value of `1.0` means 100% of the lease time, and will almost certainly mean that secrets will expire before they can be renewed.  The default value of `0.9` means that secrets will be renewed at 90% of the TTL value.  This affects token renewel (if `vault.token-renewable` is set to `true`) and `certTTL` |
| `once` | `false` | If `true`, specifies that vault-pki-client will request a new keypair (including writing to disk and execuring `onUpdate`) and exit immediately without staying alive to renew the keypair when `certTTL` expires` |

###Vault environment variables

vault-pki-client will utilize the [standard Vault environment variables](https://vaultproject.io/docs/commands/environment.html) if they are defined.
Options passed directly to vault-pki-client (including by environment variables) will take precedence over these environment variables, but these environment
variables will take precedence over the defaults spefified in the Options section above.

For example if the environment variable `VAULT_TOKEN` is set to `foo`, and no
value for `vault.token` is specified, vault-pki-client will use `foo` as the
Vault token.  However, if the environment variable `VAULT_TOKEN` is set to
`foo`, and the environment variable `vault-pki-client_vault__token` is set to
`bar`, vault-pki-client will use `bar` as the Vault token.

## Examples

For more information about configuration files, environment variables and arguments,
see the configuration section.

``` vault-pki-client --vault.pki.role=example.com --certFile=client.pem --keyFile=client.key --caFile=ca.pem --certCN=foo.example.com --certTTL=24h ```

This example will attempt to fetch an x509 keypair with the CN `foo.example.com`
which expires 24 hours in the future.

## License

Copyright 2015 Issac Goldstand <margol@beamartyr.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.