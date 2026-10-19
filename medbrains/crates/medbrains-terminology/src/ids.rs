//! SNOMED CT metadata identifiers the store relies on. These are the fixed
//! model ids every RF2 release uses, not licensed clinical content.

/// `116680003 |Is a|` — the subtype relationship.
pub const IS_A: i64 = 116_680_003;
/// `138875005 |SNOMED CT Concept|` — the root of the hierarchy.
pub const ROOT: i64 = 138_875_005;
/// `900000000000003001 |Fully specified name|`.
pub const FSN: i64 = 900_000_000_000_003_001;
/// `900000000000013009 |Synonym|`.
pub const SYNONYM: i64 = 900_000_000_000_013_009;
/// `900000000000548007 |Preferred|` — language refset acceptability.
pub const PREFERRED: i64 = 900_000_000_000_548_007;
/// `900000000000549004 |Acceptable|`.
pub const ACCEPTABLE: i64 = 900_000_000_000_549_004;
/// `900000000000011006 |Inferred relationship|`.
pub const INFERRED: i64 = 900_000_000_000_011_006;
/// `900000000000073002 |Sufficiently defined concept definition status|`.
pub const DEFINED: i64 = 900_000_000_000_073_002;
/// `900000000000509007 |United States of America English language reference set|`.
pub const US_ENGLISH: i64 = 900_000_000_000_509_007;
/// `900000000000508004 |Great Britain English language reference set|`.
pub const GB_ENGLISH: i64 = 900_000_000_000_508_004;
