//! A small generator for property tests, so they need no new dependency and always run the same
//! cases: a failure reproduces.

/// An xorshift sequence from a non-zero seed.
pub(crate) struct Rng(pub(crate) u64);

impl Rng {
    /// The next value.
    pub(crate) fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    /// One item of a list; the default value for an empty one.
    pub(crate) fn pick<'a>(&mut self, items: &[&'a str]) -> &'a str {
        let index = usize::try_from(self.next() % items.len().max(1) as u64).unwrap_or(0);
        items.get(index).copied().unwrap_or_default()
    }
}
