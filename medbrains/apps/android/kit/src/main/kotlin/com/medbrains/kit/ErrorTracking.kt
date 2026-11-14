package com.medbrains.kit

import android.content.Context
import io.sentry.Breadcrumb
import io.sentry.DataCollection
import io.sentry.KeyValueCollectionBehavior
import io.sentry.Sentry
import io.sentry.SentryEvent
import io.sentry.android.core.SentryAndroid
import io.sentry.protocol.Request
import io.sentry.protocol.User
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.net.URI
import java.security.MessageDigest

/**
 * Crash and error reports, to the hospital's own Rustrak through its server. Off unless the
 * server says it is on. The phone never talks to the real DSN host (it is often 127.0.0.1 on the
 * hospital box): the SDK is given a DSN on the hospital server, whose tunnel runs every report
 * through the Rust patient-data scrubber before forwarding it. Mirrors
 * apps/web/src/lib/error-tracking.ts; the shape-level scrub here mirrors error-tracking-scrub.ts.
 */

/** `GET /api/public/error-tracking/config?app=android`. */
@Serializable
data class ErrorTrackingConfig(
    val enabled: Boolean = false,
    val dsn: String? = null,
    val environment: String? = null,
    val tunnel_dsn_path: String? = null,
)

/** What one app passes to start error tracking. */
data class TrackedApp(
    val context: Context,
    val client: ApiClient,
    val auth: AuthStore,
    /** The app's versionName. */
    val release: String,
    /** Set by release CI when it uploads the R8 mapping; null otherwise. */
    val proguardUuid: String? = null,
)

private const val CONFIG_PATH = "/api/public/error-tracking/config?app=android"

/**
 * Asks the server whether to report and, if so, starts the SDK and keeps the report's user in
 * step with sign-in. Any failure to ask leaves it off.
 */
fun startErrorTracking(scope: CoroutineScope, app: TrackedApp) {
    scope.launch {
        val target = loadTunnelTarget(app.client.baseUrl) { app.client.get(CONFIG_PATH) } ?: return@launch
        SentryAndroid.init(app.context) { o ->
            o.dsn = target.dsn
            o.environment = target.environment
            o.release = app.release
            o.proguardUuid = app.proguardUuid
            collectNothing(o.dataCollection)
            o.isAttachScreenshot = false
            o.isAttachViewHierarchy = false
            o.isEnableUserInteractionBreadcrumbs = false
            o.tracesSampleRate = null
            o.sessionReplay.sessionSampleRate = null
            o.sessionReplay.onErrorSampleRate = null
            o.setBeforeBreadcrumb { crumb, _ -> scrubBreadcrumb(crumb) }
            o.setBeforeSend { event, _ -> scrubEvent(event) }
        }
        app.auth.state.collect(::tagUser)
    }
}

/**
 * Collect nothing about the person or the request: 8.x's replacement for `sendDefaultPii`
 * (deprecated), set explicitly as the web does with its `dataCollection`.
 */
private fun collectNothing(d: DataCollection) {
    d.userInfo = false
    d.cookies = KeyValueCollectionBehavior.off()
    d.urlQueryParams = KeyValueCollectionBehavior.off()
    d.httpBodies = emptySet()
    d.databaseQueryData = false
    d.filePaths = false
    d.httpHeaders.request = KeyValueCollectionBehavior.off()
    d.httpHeaders.response = KeyValueCollectionBehavior.off()
    d.graphql.document = false
    d.graphql.variables = false
}

/** The DSN the SDK starts with and the environment it reports, once the server said yes. */
internal data class TunnelTarget(val dsn: String, val environment: String?)

/** Fetches the config; a failed fetch is "off", never an error the app sees. */
internal suspend fun loadTunnelTarget(baseUrl: String, fetch: suspend () -> ErrorTrackingConfig): TunnelTarget? {
    val config = try {
        fetch()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        null
    }
    return tunnelDsn(baseUrl, config)?.let { TunnelTarget(it, config?.environment) }
}

/**
 * `{scheme}://medbrains@{host}[:port][base path]{tunnel_dsn_path}`: a DSN on the server the app
 * already talks to. Null unless the server enabled tracking and named both a DSN and the path.
 */
internal fun tunnelDsn(baseUrl: String, config: ErrorTrackingConfig?): String? {
    if (config == null || !config.enabled || config.dsn == null) return null
    val path = config.tunnel_dsn_path ?: return null
    val uri = runCatching { URI(baseUrl.trim()) }.getOrNull() ?: return null
    val scheme = uri.scheme ?: return null
    val host = uri.host ?: return null
    val port = if (uri.port == -1) "" else ":${uri.port}"
    // ponytail: keeps a reverse-proxy prefix, as ApiClient does when it appends /api/...
    val basePath = uri.rawPath.orEmpty().trimEnd('/')
    return "$scheme://medbrains@$host$port$basePath$path"
}

/** Breadcrumb fields that say what kind of request or navigation it was. */
private val KEPT_BREADCRUMB_DATA = setOf("method", "status_code", "url", "from", "to")

/** Typed text and console lines can hold patient data. */
private val DROPPED_CATEGORIES = setOf("console", "ui.input")
private val UUID_SEGMENT = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
private val LONG_DIGITS = Regex("\\d{4,}")

/** A URL or path with no query or fragment, and record ids (UUIDs, 4+ digits) as `:id`. */
internal fun scrubUrl(raw: String): String {
    val withoutQuery = raw.split('?', '#').first()
    val originEnd = withoutQuery.indexOf("://")
    val pathStart = if (originEnd == -1) 0 else withoutQuery.indexOf('/', originEnd + 3)
    if (pathStart == -1) return withoutQuery
    val path = withoutQuery.substring(pathStart).split('/').joinToString("/") {
        if (UUID_SEGMENT.matches(it) || LONG_DIGITS.containsMatchIn(it)) ":id" else it
    }
    return withoutQuery.substring(0, pathStart) + path
}

/** Drops console and typed-text crumbs, a `ui.*` message, and every data key but the kept ones. */
internal fun scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb? {
    val category = crumb.category
    if (category in DROPPED_CATEGORIES) return null
    // A ui.click message names the element, which can carry its text.
    if (category?.startsWith("ui.") == true) crumb.message = null
    for (key in crumb.data.keys.toList()) {
        val value = crumb.getData(key)
        when {
            key !in KEPT_BREADCRUMB_DATA -> crumb.removeData(key)
            value is String -> crumb.setData(key, scrubUrl(value))
        }
    }
    return crumb
}

/** The request is reduced to method and scrubbed URL, the user to its id hash, extras dropped. */
internal fun scrubEvent(event: SentryEvent): SentryEvent {
    event.request = event.request?.let { old ->
        Request().apply {
            method = old.method
            url = old.url?.let(::scrubUrl)
        }
    }
    event.user = event.user?.id?.let { hashed -> User().apply { id = hashed } }
    event.setExtras(null)
    event.serverName = null
    event.breadcrumbs = event.breadcrumbs?.mapNotNull(::scrubBreadcrumb)
    return event
}

/** The id an error report carries for a user: sha256 hex, first 32 chars, as the web and server. */
internal fun hashUserId(userId: String): String =
    MessageDigest.getInstance("SHA-256").digest(userId.toByteArray())
        .joinToString("") { "%02x".format(it) }.take(32)

/** Only an id hash, the tenant and the role: never a name, username or email. */
private fun tagUser(state: AuthState) {
    val who = (state as? AuthState.SignedIn)?.identity
    Sentry.setUser(who?.let { User().apply { id = hashUserId(it.userId) } })
    if (who == null) {
        Sentry.removeTag("tenant_id")
        Sentry.removeTag("role")
        return
    }
    Sentry.setTag("tenant_id", who.tenantId)
    who.role?.let { Sentry.setTag("role", it) } ?: Sentry.removeTag("role")
}
