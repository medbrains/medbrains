//! Checks a dm-verity hash tree against its data and a root hash, as `veritysetup verify` does, without
//! `veritysetup`: the bundle tool runs on build machines that have no device mapper, macOS among them.
//! Only the format MedBrains images use: superblock version 1, hash type 1 (salt first), SHA-256. The tree
//! layout is cryptsetup's (`lib/verity/verity_hash.c`): the superblock in the first hash block, then each
//! level from the top down.

use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

use sha2::{Digest, Sha256};

const SIGNATURE: &[u8; 8] = b"verity\0\0";
const SUPERBLOCK_BYTES: usize = 512;
const DIGEST_BYTES: usize = 32;
const MAX_SALT: usize = 256;
const MIN_BLOCK: u32 = 512;
const MAX_BLOCK: u32 = 65_536;
/// A tree's levels held in memory: 16 MiB for a 2 GiB slot. Bounded so a forged count cannot exhaust it.
const MAX_DATA_BYTES: u64 = 64 * 1024 * 1024 * 1024;

/// What the superblock says about the tree.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Superblock {
    data_block: u32,
    hash_block: u32,
    data_blocks: u64,
    salt: Vec<u8>,
}

/// A little-endian number at `at` in `bytes`.
fn field<const N: usize>(bytes: &[u8], at: usize) -> Option<[u8; N]> {
    bytes.get(at..at + N)?.try_into().ok()
}

/// Reads the superblock, refusing any format other than the one MedBrains images use.
fn parse_superblock(bytes: &[u8]) -> Result<Superblock, String> {
    let bad = |why: &str| format!("The hash tree's superblock {why}.");
    if bytes.get(..8) != Some(SIGNATURE.as_slice()) {
        return Err(bad("is missing"));
    }
    let number = |at| field::<4>(bytes, at).map(u32::from_le_bytes);
    if number(8) != Some(1) || number(12) != Some(1) {
        return Err(bad("is not version 1, hash type 1"));
    }
    let algorithm = bytes.get(32..64).ok_or_else(|| bad("is short"))?;
    if algorithm.split(|b| *b == 0).next() != Some(b"sha256".as_slice()) {
        return Err(bad("names a hash other than sha256"));
    }
    let (data_block, hash_block) = (number(64), number(68));
    let data_blocks = field::<8>(bytes, 72).map(u64::from_le_bytes);
    let salt_size = field::<2>(bytes, 80).map(|raw| usize::from(u16::from_le_bytes(raw)));
    let (Some(data_block), Some(hash_block), Some(data_blocks), Some(salt_size)) =
        (data_block, hash_block, data_blocks, salt_size)
    else {
        return Err(bad("is short"));
    };
    let block_ok = |size: u32| size.is_power_of_two() && (MIN_BLOCK..=MAX_BLOCK).contains(&size);
    let data_bytes = data_blocks.checked_mul(u64::from(data_block));
    if !block_ok(data_block)
        || !block_ok(hash_block)
        || data_blocks < 2
        || data_bytes.is_none_or(|n| n > MAX_DATA_BYTES)
        || salt_size > MAX_SALT
    {
        return Err(bad("gives sizes out of range"));
    }
    let salt = bytes
        .get(88..88 + salt_size)
        .ok_or_else(|| bad("is short"))?;
    Ok(Superblock {
        data_block,
        hash_block,
        data_blocks,
        salt: salt.to_vec(),
    })
}

/// SHA-256 of the salt and then `block`, as hash type 1 defines a block's digest.
fn digest(salt: &[u8], block: &[u8]) -> [u8; DIGEST_BYTES] {
    let mut hasher = Sha256::new();
    hasher.update(salt);
    hasher.update(block);
    hasher.finalize().into()
}

/// Packs `digests` into hash blocks of `block` bytes, each padded with zeros.
fn pack(digests: &[[u8; DIGEST_BYTES]], block: usize) -> Vec<u8> {
    let per_block = block / DIGEST_BYTES;
    let mut level = Vec::with_capacity(digests.len().div_ceil(per_block) * block);
    for group in digests.chunks(per_block) {
        let start = level.len();
        level.extend(group.iter().flatten());
        level.resize(start + block, 0);
    }
    level
}

/// The digests of every data block in `data`.
fn data_digests(data: &mut impl Read, sb: &Superblock) -> Result<Vec<[u8; DIGEST_BYTES]>, String> {
    let size = usize::try_from(sb.data_block).map_err(|e| e.to_string())?;
    let mut block = vec![0_u8; size];
    let mut digests = Vec::new();
    for _ in 0..sb.data_blocks {
        data.read_exact(&mut block)
            .map_err(|_| "The system image is shorter than its hash tree says.".to_owned())?;
        digests.push(digest(&sb.salt, &block));
    }
    Ok(digests)
}

/// Every level of the tree, level 0 (over the data) first, ending with the single top block.
fn build_levels(
    mut digests: Vec<[u8; DIGEST_BYTES]>,
    sb: &Superblock,
) -> Result<Vec<Vec<u8>>, String> {
    let block = usize::try_from(sb.hash_block).map_err(|e| e.to_string())?;
    let mut levels = Vec::new();
    // Bounded: each level is at most a 1/128 of the one below, so 64 levels is past any real disk.
    for _ in 0..64 {
        let level = pack(&digests, block);
        let done = level.len() == block;
        digests = level.chunks(block).map(|b| digest(&sb.salt, b)).collect();
        levels.push(level);
        if done {
            return Ok(levels);
        }
    }
    Err("The hash tree would be deeper than any disk.".to_owned())
}

/// Checks the tree in `tree` against the data in `data` and `roothash`, every block of both.
pub fn verify_tree(data: &Path, tree: &Path, roothash: &str) -> Result<(), String> {
    let open = |path: &Path| File::open(path).map_err(|e| format!("{}: {e}", path.display()));
    let mut tree_file = open(tree)?;
    let mut superblock = [0_u8; SUPERBLOCK_BYTES];
    tree_file
        .read_exact(&mut superblock)
        .map_err(|e| format!("{}: {e}", tree.display()))?;
    let sb = parse_superblock(&superblock)?;
    let digests = data_digests(&mut BufReader::with_capacity(1 << 20, open(data)?), &sb)?;
    let levels = build_levels(digests, &sb)?;
    let mut at = u64::from(sb.hash_block);
    for level in levels.iter().rev() {
        let mut stored = vec![0_u8; level.len()];
        tree_file
            .seek(SeekFrom::Start(at))
            .and_then(|_| tree_file.read_exact(&mut stored))
            .map_err(|_| "The hash tree is shorter than its data needs.".to_owned())?;
        if stored != *level {
            return Err("The hash tree does not match the system image.".to_owned());
        }
        at += level.len() as u64;
    }
    let top = levels
        .last()
        .ok_or_else(|| "The hash tree is empty.".to_owned())?;
    if hex::encode(digest(&sb.salt, top)) != roothash {
        return Err(
            "The system image and its tree do not match the boot file's root hash.".to_owned(),
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{DIGEST_BYTES, Superblock, build_levels, digest, parse_superblock, verify_tree};

    /// A superblock as `veritysetup format` writes it, for `blocks` blocks of 4 KiB and `salt`.
    fn superblock(blocks: u64, salt: &[u8]) -> Vec<u8> {
        let mut sb = vec![0_u8; 512];
        sb[..8].copy_from_slice(b"verity\0\0");
        sb[8..12].copy_from_slice(&1_u32.to_le_bytes());
        sb[12..16].copy_from_slice(&1_u32.to_le_bytes());
        sb[32..38].copy_from_slice(b"sha256");
        sb[64..68].copy_from_slice(&4096_u32.to_le_bytes());
        sb[68..72].copy_from_slice(&4096_u32.to_le_bytes());
        sb[72..80].copy_from_slice(&blocks.to_le_bytes());
        sb[80..82].copy_from_slice(&u16::try_from(salt.len()).unwrap_or(0).to_le_bytes());
        sb[88..88 + salt.len()].copy_from_slice(salt);
        sb
    }

    /// Only the format MedBrains images use is read; anything else is refused, never guessed.
    #[test]
    fn only_version_1_sha256_superblocks_are_read() {
        let good = superblock(300, b"salt");
        assert_eq!(
            parse_superblock(&good),
            Ok(Superblock {
                data_block: 4096,
                hash_block: 4096,
                data_blocks: 300,
                salt: b"salt".to_vec()
            })
        );
        let mut other = good.clone();
        other[32..38].copy_from_slice(b"sha1\0\0");
        assert!(parse_superblock(&other).is_err());
        let mut chrome = good.clone();
        chrome[12..16].copy_from_slice(&0_u32.to_le_bytes());
        assert!(parse_superblock(&chrome).is_err());
        assert!(parse_superblock(&superblock(u64::MAX, b"")).is_err());
        assert!(parse_superblock(&[0; 512]).is_err());
    }

    /// 300 data blocks need three hash blocks under one top block: two levels, as cryptsetup lays them.
    #[test]
    fn levels_shrink_to_one_block() -> Result<(), String> {
        let sb = parse_superblock(&superblock(300, b"s"))?;
        let digests = vec![[7_u8; DIGEST_BYTES]; 300];
        let levels = build_levels(digests, &sb).unwrap_or_default();
        assert_eq!(
            levels.iter().map(Vec::len).collect::<Vec<_>>(),
            [3 * 4096, 4096]
        );
        Ok(())
    }

    /// A tree built here verifies, and one changed byte in the data, the tree or the root hash is refused.
    #[test]
    fn a_changed_byte_anywhere_is_refused() -> Result<(), String> {
        let dir = std::env::temp_dir().join(format!("mb-verity-tree-{}", std::process::id()));
        assert!(std::fs::create_dir_all(&dir).is_ok());
        let (data_path, tree_path) = (dir.join("data"), dir.join("tree"));
        let data: Vec<u8> = (0..300 * 4096_u32).map(|n| (n % 251) as u8).collect();
        let sb_bytes = superblock(300, b"salt");
        let sb = parse_superblock(&sb_bytes)?;
        let digests = data.chunks(4096).map(|b| digest(&sb.salt, b)).collect();
        let levels = build_levels(digests, &sb).unwrap_or_default();
        let mut tree = sb_bytes;
        tree.resize(4096, 0);
        for level in levels.iter().rev() {
            tree.extend_from_slice(level);
        }
        let root = hex::encode(digest(
            &sb.salt,
            levels.last().map_or(&[][..], Vec::as_slice),
        ));
        let write =
            |path: &std::path::Path, bytes: &[u8]| assert!(std::fs::write(path, bytes).is_ok());
        write(&data_path, &data);
        write(&tree_path, &tree);
        assert_eq!(verify_tree(&data_path, &tree_path, &root), Ok(()));
        assert!(verify_tree(&data_path, &tree_path, &"0".repeat(64)).is_err());
        let mut changed = data.clone();
        changed[5000] ^= 1;
        write(&data_path, &changed);
        assert!(verify_tree(&data_path, &tree_path, &root).is_err());
        write(&data_path, &data);
        let mut bad_tree = tree.clone();
        bad_tree[4096 + 10] ^= 1;
        write(&tree_path, &bad_tree);
        assert!(verify_tree(&data_path, &tree_path, &root).is_err());
        drop(std::fs::remove_dir_all(&dir));
        Ok(())
    }
}
