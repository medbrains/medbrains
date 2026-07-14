-- Real-time notification delivery (RFC-NOTIFICATION-SYSTEM).
--
-- An AFTER INSERT trigger fires pg_notify on the `notification_created` channel.
-- pg_notify is TRANSACTIONAL — the payload is delivered only when the inserting
-- transaction COMMITS, which makes this inherently persist-then-deliver: every
-- producer that calls create_notification goes live automatically, with zero
-- caller changes and no phantom delivery on rollback.
--
-- A single backend PgListener task (services::notification_listener) receives
-- these and republishes to the in-process NotificationHub for WebSocket fan-out.

CREATE OR REPLACE FUNCTION notify_notification_created() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    -- Keep the payload well under Postgres's ~8000-byte NOTIFY limit: the body
    -- is truncated (the full row is always available via the REST feed).
    PERFORM pg_notify(
        'notification_created',
        json_build_object(
            'id', NEW.id,
            'tenant_id', NEW.tenant_id,
            'user_id', NEW.user_id,
            'kind', NEW.kind,
            'title', left(NEW.title, 2000),
            'body', left(NEW.body, 4000),
            'category', NEW.category,
            'entity_type', NEW.entity_type,
            'entity_id', NEW.entity_id,
            'action_url', NEW.action_url
        )::text
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_notify_created ON public.notifications;
CREATE TRIGGER notifications_notify_created
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION notify_notification_created();
