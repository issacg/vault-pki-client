#! /usr/bin/env node

var debug = require('debug')('vault-pki-client:main'),
    config = require('./config'),
    Promise = require('bluebird'),
    util = require('util'),
    request = require('request-promise'),
    pkginfo = require('./package.json'),
    child = Promise.promisifyAll(require('child_process')),
    fs = Promise.promisifyAll(require('fs'));

var token = config.vault.token;
function main() {
    if (config.version) {
        console.log(pkginfo.name + " v" + pkginfo.version);
        process.exit(0);
    }
    Promise.resolve()
    .then(config.vault["token-renewable"] ? renewVaultToken : Promise.resolve)
    .then(fetchCert)
    .catch(function(e) {
        if (e && e.name && e.name == "StatusCodeError") {
            console.error("Vault error: " + e.statusCode + " " + e.error.errors.join(" "));
        } else {
            console.error(e);
        }
    });
}

var fetchCert = (function() {
    var debug = require('debug')('vault-pki-client:certRenewal');
    var exec, args = [];
    if (config.onUpdate) {
        args = config.onUpdate.split(/\s+/);
        exec = args.shift();
    }
    return function() {
        var path = [config.vault.pki.path, "issue", config.vault.pki.role].join("/");
        debug("Attempting to fetch a keypair from " + path);
        var opts = {
            common_name: config.certCN
        }
        if (config.certTTL) opts.ttl = config.certTTL;
        return vaultRequest(path, 'POST', opts).then(function(data) {
            return Promise.all([
                saveKey(data.data.private_key),
                saveCert(data.data.certificate),
                saveCA(data.data.issuing_ca)
            ]).then(function() {
                if (config.once) return Promise.resolve();
                var next = data.lease_duration * config.renewalCoefficient * 1000;
                debug("Next renewal in " + next + "ms");
                setTimeout(fetchCert, next);
            }).then(function() {
                if (config.onUpdate) {
                    debug("Executing " + exec + " " + args.join(" "));
                    return child.spawnAsync(exec, args, {});
                } else {
                    return Promise.resolve();
                }
            }).catch(function(e) {
                debug("Failed to fetch and update keypair");
                console.error(e);
            });
        });
    };
    function saveKey(data) {
        debug("Writing private key to " + config.keyFile);
        return fs.writeFileAsync(config.keyFile, data);
    }

    function saveCert(data) {
        debug("Writing certificate to " + config.certFile);
        return fs.writeFileAsync(config.certFile, data);
    }

    function saveCA(data) {
        if (!config.caFile) return Promise.resolve();
        debug("Writing CA certificate to " + config.caFile);
        return fs.writeFileAsync(config.caFile, data);
    }
})();

// Attempt to periodically renew the vault token
var renewVaultToken = (function() {
    var debug = require('debug')('vault-pki-client:tokenRenewal');
    return function() {
        debug("Attempting to renew vault token");
        return vaultRequest('auth/token/renew-self','POST').then(function(data) {
            token = data.auth.client_token;
            debug("Token renewal succeeded");
            if (data.auth.renewable) {
                var next = data.auth.lease_duration * config.renewalCoefficient * 1000;
                debug("Next renewal in " + next + "ms");
                setTimeout(renewVaultToken, next).unref();
            }
            return Promise.resolve();
        }).catch(function(err) {
            debug("Token renewal failed");
            console.error(err);
            return Promise.reject();
        });
    };
})();

// Build request options
function buildReqOpts() {
    var reqOpts = {
        ca:[],
        rejectUnauthorized: !config.vault.server["tls-skip-verify"]
    };

    if (config.vault.server["ca-path"]) {
        // This won't work for bundle files with multiple CAs in a single file...
        var match = "-----BEGIN CERTIFICATE-----",
            len = match.length;
        fs.readdirSync(config.vault.server["ca-path"]).forEach(function(file) {
            file = [config.vault.server["ca-path"], file].join("/");
            if (!fs.statSync(file).isFile()) return;
            var buf = fs.readFileSync(file);
            if (buf.slice(0, len) == match)
                reqOpts.ca.push(buf);
        })
    }

    if (config.vault.server["ca-cert"])
        reqOpts.ca.push(fs.readFileSync(config.vault.server["ca-cert"]));

    // Fallback to default node-bundled CAs
    if (reqOpts.ca.length == 0)
        delete reqOpts.ca;

    if (config.vault.server["client-cert"])
        reqOpts.ca.push(fs.readFileSync(config.vault.server["client-cert"]));

    if (config.vault.server["client-key"])
        reqOpts.ca.push(fs.readFileSync(config.vault.server["ca-cert"]));

    return reqOpts;
}

var vaultRequest = (function () {
    var debug = require('debug')('vault-pki-client:http');
    var defOpts = buildReqOpts();
    return function(url, method, body) {
        method = method || "GET";
        body = body || undefined;
        var opts = util._extend(defOpts, {
            url: [config.vault.server['address'], config.vault.server['api-version'], url].join("/"),
            headers: {
                "X-Vault-Token": token
            },
            method: method,
            body: body,
            json: true
        });
        debug(method + "ing data to " + opts.url);
        return request(opts).then(function(data) {debug("Got data: " + data); return data});
    };
})();

main();