//! The one place an error report is made safe before it leaves: every envelope
//! the server sends, and every envelope the browser tunnels through it, passes
//! through [`scrub_envelope`].

use std::sync::Arc;
use std::time::Duration;

use sentry::protocol::{Envelope, EnvelopeHeaders, EnvelopeItem, SessionAttributes, SessionUpdate};
use sentry::transports::ReqwestHttpTransportOptions;
use sentry::{Transport, TransportFactory, TransportOptions};

use crate::scrub::{is_opaque_user_id, scrub_event, scrub_transaction};

/// Errors, transactions and session counts, scrubbed. Attachments, logs,
/// metrics, check-ins and anything unrecognised are dropped: they can carry
/// whatever the program put in them. The envelope header keeps only the event
/// id — the sender's copy names a DSN and a sampling context nobody needs.
/// `None` when nothing is left to send.
#[must_use]
pub(crate) fn scrub_envelope(envelope: Envelope) -> Option<Envelope> {
    let headers = envelope.uuid().map_or_else(EnvelopeHeaders::new, |id| {
        EnvelopeHeaders::new().with_event_id(*id)
    });
    let mut out = Envelope::new().with_headers(headers);
    let mut kept = 0usize;
    for item in envelope.into_items() {
        if let Some(item) = scrub_item(item) {
            out.add_item(item);
            kept += 1;
        }
    }
    (kept > 0).then_some(out)
}

fn scrub_item(item: EnvelopeItem) -> Option<EnvelopeItem> {
    match item {
        EnvelopeItem::Event(mut event) => {
            scrub_event(&mut event);
            Some(EnvelopeItem::Event(event))
        }
        EnvelopeItem::Transaction(mut tx) => {
            scrub_transaction(&mut tx);
            Some(EnvelopeItem::Transaction(tx))
        }
        EnvelopeItem::SessionUpdate(session) => {
            Some(EnvelopeItem::SessionUpdate(scrub_session(session)))
        }
        EnvelopeItem::SessionAggregates(mut aggregates) => {
            scrub_attributes(&mut aggregates.attributes);
            for bucket in &mut aggregates.aggregates {
                bucket.distinct_id = bucket.distinct_id.take().filter(|id| is_opaque_user_id(id));
            }
            Some(EnvelopeItem::SessionAggregates(aggregates))
        }
        _ => None,
    }
}

fn scrub_session(mut session: SessionUpdate<'static>) -> SessionUpdate<'static> {
    session.distinct_id = session
        .distinct_id
        .take()
        .filter(|id| is_opaque_user_id(id));
    scrub_attributes(&mut session.attributes);
    session
}

fn scrub_attributes(attributes: &mut SessionAttributes<'static>) {
    attributes.ip_address = None;
    attributes.user_agent = None;
}

/// Wraps the SDK's own HTTP transport so nothing reaches it unscrubbed.
struct ScrubbingTransport {
    inner: Arc<dyn Transport>,
}

impl Transport for ScrubbingTransport {
    fn send_envelope(&self, envelope: Envelope) {
        if let Some(envelope) = scrub_envelope(envelope) {
            self.inner.send_envelope(envelope);
        }
    }

    fn flush(&self, timeout: Duration) -> bool {
        self.inner.flush(timeout)
    }

    fn shutdown(&self, timeout: Duration) -> bool {
        self.inner.shutdown(timeout)
    }
}

/// The transport factory for `sentry::init`: the default HTTP transport behind
/// the scrubber.
#[derive(Debug, Clone, Copy)]
pub(crate) struct ScrubbingHttp;

impl TransportFactory for ScrubbingHttp {
    fn create_transport_with_options(&self, options: TransportOptions) -> Arc<dyn Transport> {
        scrubbing(Arc::new(ReqwestHttpTransportOptions::from(options).build()))
    }
}

/// Any transport behind the scrubber — the HTTP one in production, the SDK's
/// test transport in the tests that prove what leaves.
pub(crate) fn scrubbing(inner: Arc<dyn Transport>) -> Arc<dyn Transport> {
    Arc::new(ScrubbingTransport { inner })
}
