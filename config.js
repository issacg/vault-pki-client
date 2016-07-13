var rc = require("rc");

var defaults = {
    vault: {
        server: {
            "address": process.env.VAULT_ADDR || "http://localhost:8200",
            "ca-cert": process.env.VAULT_CACERT || undefined,
            "ca-path": process.env.VAULT_CAPATH || undefined,
            "tls-skip-verify": process.env.VAULT_SKIP_VERIFY || false,
            "api-version": "v1"
        }, pki: {
            "path": "pki",
            "role": ""
        },
        "token": process.env.VAULT_TOKEN || "",
        "token-renewable": false
    },
    certCN: require("os").hostname(),
    certAltNames: [],
    certIPs: [],
    certTTL: undefined,
    certFile: "client.pem",
    keyFile: "client.key",
    caFile: undefined,
    onUpdate: undefined,
    renewalCoefficient: 0.9,
    once: false
};

module.exports = rc("vault-pki-client", defaults);
