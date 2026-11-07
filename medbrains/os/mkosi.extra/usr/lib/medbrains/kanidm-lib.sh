# Shared by the scripts that talk to Kanidm on loopback. Passwords and tokens reach curl through a pipe,
# never as an argument, because any process on the machine can read another's arguments.

ORIGIN=https://idm.medbrains.local:8444
UP_TRIES=60

# Calls Kanidm, trusting only its own certificate. Prints the body. Fails on an HTTP error.
api() {
    curl -fsS -m 30 --cacert /var/lib/kanidm/tls-chain.pem --resolve idm.medbrains.local:8444:127.0.0.1 "$@"
}

# The same with a token, given first. The token goes through a pipe.
api_as() {
    local token="$1"
    shift
    api -K <(printf 'header = "Authorization: Bearer %s"\n' "$token") "$@"
}

# Sends JSON on stdin as the request's body.
json_body() {
    api -H 'Content-Type: application/json' -d @- "$@"
}

# The same with a token, given first.
json_body_as() {
    local token="$1"
    shift
    api_as "$token" -H 'Content-Type: application/json' -d @- "$@"
}

# Prints a string as JSON's inside of quotes. Setup refuses control characters, so these two are all.
json_escape() {
    local text="${1//\\/\\\\}"
    printf '%s' "${text//\"/\\\"}"
}

# Waits until Kanidm answers, or fails.
wait_for_kanidm() {
    local try
    for ((try = 0; try < UP_TRIES; try++)); do
        api -o /dev/null "$ORIGIN/status" 2>/dev/null && return 0
        sleep 2
    done
    echo "Kanidm did not answer" >&2
    return 1
}

# Prints a token for an account, given a password on stdin.
token_for_password() {
    local account="$1" password session
    IFS= read -r password
    session="$(printf '{"step":{"init2":{"username":"%s","issue":"token","privileged":true}}}' "$account" |
        api -D - -o /dev/null -H 'Content-Type: application/json' -d @- "$ORIGIN/v1/auth" |
        tr -d '\r' | sed -n 's/^x-kanidm-auth-session-id: //Ip')"
    printf '{"step":{"begin":"password"}}' |
        api -o /dev/null -H 'Content-Type: application/json' -H "X-KANIDM-AUTH-SESSION-ID: $session" -d @- "$ORIGIN/v1/auth"
    printf '{"step":{"cred":{"password":"%s"}}}' "$(json_escape "$password")" |
        api -H 'Content-Type: application/json' -H "X-KANIDM-AUTH-SESSION-ID: $session" -d @- "$ORIGIN/v1/auth" |
        sed -n 's/.*"success":"\([^"]*\)".*/\1/p'
}

# Prints a privileged token for a built-in account, from a password that exists only for this run.
admin_token() {
    local account="$1" password
    password="$(runuser -u kanidm -- kanidmd scripting recover-account "$account" 2>/dev/null | sed -n 's/.*"output":"\([^"]*\)".*/\1/p')"
    [[ -n "$password" ]] || { echo "could not recover $account" >&2; return 1; }
    printf '%s\n' "$password" | token_for_password "$account"
}
