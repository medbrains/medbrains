//! Re-hydrating a streamed answer. A placeholder can be split across chunks
//! (`"[PATI"` then `"ENT_1]"`), so an unfinished `[…` is held back until it
//! closes — bounded, so a stray bracket cannot stall the stream.

use super::PseudonymMap;

/// Longest placeholder held back while waiting for its `]`.
const MAX_PENDING: usize = 32;

/// Feeds model chunks in, hands re-hydrated text out.
#[derive(Debug, Default)]
pub struct StreamRehydrator {
    pending: String,
}

impl StreamRehydrator {
    /// Re-hydrated text that is safe to show now.
    pub fn push(&mut self, chunk: &str, map: &PseudonymMap) -> String {
        self.pending.push_str(chunk);
        let hold_from = self
            .pending
            .rfind('[')
            .filter(|&i| !self.pending[i..].contains(']'))
            .filter(|&i| self.pending.len() - i <= MAX_PENDING);
        let ready = match hold_from {
            Some(i) => {
                let tail = self.pending.split_off(i);
                std::mem::replace(&mut self.pending, tail)
            }
            None => std::mem::take(&mut self.pending),
        };
        map.rehydrate(&ready)
    }

    /// Whatever is still held when the stream ends.
    pub fn finish(&mut self, map: &PseudonymMap) -> String {
        map.rehydrate(&std::mem::take(&mut self.pending))
    }
}
