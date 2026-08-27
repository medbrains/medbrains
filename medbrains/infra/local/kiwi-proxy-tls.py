"""Tell Kiwi that TLS is terminated in front of it.

Dropped into Kiwi's `tcms_settings_dir`, which the image imports as local
settings.

Kiwi hardcodes `SECURE_SSL_REDIRECT = "runserver" not in sys.argv` and never
sets `SECURE_PROXY_SSL_HEADER`, so it has no way to learn that a request
arrived over HTTPS. Behind a TLS-terminating proxy that means Django sees plain
HTTP, redirects to the https URL, the proxy forwards that as plain HTTP again,
and the browser bounces between the two until it gives up -- a 301 from `/` to
`/`, which is what this fixes.

Turning the redirect off is not a downgrade: nothing reaches Kiwi except
through the proxy, which is published on loopback only and speaks TLS to every
client. Trusting `X-Forwarded-Proto` matters as much, so Django builds https
URLs and accepts the CSRF origin on the login form; the proxy strips that
header from inbound requests and sets it itself, so it cannot be spoofed by a
caller.
"""

SECURE_SSL_REDIRECT = False

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

CSRF_TRUSTED_ORIGINS = ["https://medbrains-kiwi.localhost"]
