//! The order of an update's writes, kept apart so the order itself can be tested.
//!
//! A boot file finds its
//! system by the two partition UUIDs its root hash gives (`OS-VERITY.md`), and the updater and the screen
//! read a slot's version from its name. So a boot entry may exist only while the partitions it names are
//! complete, and a slot may carry a version's name only once it is: that is what makes a power cut at any
//! step harmless, and `tests` checks it at every step.

/// One write to the disk, in `INSTALL_STEPS` order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Step {
    /// Remove the boot entry of the version in the other slot.
    RemoveOldBoot,
    /// Mark the other slot as holding nothing, and give its partitions UUIDs no boot file looks for.
    EmptySlot,
    /// Write the system image, and read it back from the disk.
    WriteSlot,
    /// Write its hash tree, and read it back from the disk.
    WriteHash,
    /// Check every block of the system against the tree and the boot file's root hash.
    VerifySlot,
    /// Check the new system agrees about who owns files on the data disk.
    CheckOwners,
    /// Give the hash tree the UUID and name the new boot file looks for.
    NameHash,
    /// Give the system partition its UUID, then its version's name, which only now it fully is.
    NameSlot,
    /// Put the boot file where the loader does not look: applying is a separate decision.
    StageBoot,
}

/// How an install runs. Changing this order is a class A change: the model below must still pass.
pub const INSTALL_STEPS: [Step; 9] = [
    Step::RemoveOldBoot,
    Step::EmptySlot,
    Step::WriteSlot,
    Step::WriteHash,
    Step::VerifySlot,
    Step::CheckOwners,
    Step::NameHash,
    Step::NameSlot,
    Step::StageBoot,
];

/// Starts a new version gets before the machine goes back by itself.
pub const TRIES: u32 = 3;

#[cfg(test)]
mod tests {
    use super::{INSTALL_STEPS, Step, TRIES};

    /// A slot in the model: what its two partitions hold, which version's UUIDs they carry, and its name.
    #[derive(Debug, Clone, PartialEq, Eq)]
    struct Slot {
        label: Option<u32>,
        data: Option<u32>,
        hash: Option<u32>,
        data_uuid: Option<u32>,
        hash_uuid: Option<u32>,
    }

    impl Slot {
        /// True if both partitions hold version `v` and carry the UUIDs its boot file looks for.
        fn is_whole(&self, v: u32) -> bool {
            [self.data, self.hash, self.data_uuid, self.hash_uuid] == [Some(v); 4]
        }
    }

    /// A boot entry in the model. `tries` is `None` once a version has proved good.
    #[derive(Debug, Clone, PartialEq, Eq)]
    struct Entry {
        version: u32,
        tries: Option<u32>,
    }

    /// The parts of the disk an update touches: slot 0 runs version `current`.
    #[derive(Debug, Clone)]
    struct Disk {
        slots: [Slot; 2],
        entries: Vec<Entry>,
        staged: Option<u32>,
    }

    /// A machine running version 2 with version 1 in the other partition.
    fn machine() -> Disk {
        let slot = |v| Slot {
            label: Some(v),
            data: Some(v),
            hash: Some(v),
            data_uuid: Some(v),
            hash_uuid: Some(v),
        };
        let entry = |version| Entry {
            version,
            tries: None,
        };
        Disk {
            slots: [slot(2), slot(1)],
            entries: vec![entry(2), entry(1)],
            staged: None,
        }
    }

    impl Disk {
        /// One step of installing `new` to slot 1.
        fn apply(&mut self, step: Step, new: u32) {
            let old = self.slots[1].label;
            let slot = &mut self.slots[1];
            match step {
                Step::RemoveOldBoot => self.entries.retain(|e| Some(e.version) != old),
                Step::EmptySlot => {
                    (slot.label, slot.data_uuid, slot.hash_uuid) = (None, None, None);
                }
                Step::WriteSlot => slot.data = Some(new),
                Step::WriteHash => slot.hash = Some(new),
                Step::VerifySlot | Step::CheckOwners => {}
                Step::NameHash => slot.hash_uuid = Some(new),
                Step::NameSlot => (slot.data_uuid, slot.label) = (Some(new), Some(new)),
                Step::StageBoot => self.staged = Some(new),
            }
        }

        /// The invariant: every entry the loader can see finds a whole system of its own version, and
        /// every slot named after a version holds all of it.
        fn every_entry_is_whole(&self) -> bool {
            let entries = self
                .entries
                .iter()
                .all(|e| self.slots.iter().any(|s| s.is_whole(e.version)));
            let names = self
                .slots
                .iter()
                .all(|s| s.label.is_none_or(|v| s.is_whole(v)));
            entries && names
        }

        /// What the loader picks: anything with tries left before anything without, newest first.
        fn loader_choice(&self) -> Option<&Entry> {
            self.entries
                .iter()
                .max_by_key(|e| (e.tries != Some(0), e.version))
        }
    }

    /// Property: a power cut after any number of steps leaves a machine that boots what it ran.
    #[test]
    fn a_power_cut_at_any_install_step_boots_the_running_version() {
        for steps in 0..=INSTALL_STEPS.len() {
            let mut disk = machine();
            for step in INSTALL_STEPS.iter().take(steps) {
                disk.apply(*step, 3);
                assert!(disk.every_entry_is_whole(), "{step:?}");
            }
            assert_eq!(disk.loader_choice().map(|e| e.version), Some(2), "{steps}");
        }
    }

    /// The model must catch a wrong order, or the test above proves nothing: emptying a slot its entry
    /// still names, writing over a slot that still carries its name, or naming it before its tree is there.
    #[test]
    fn the_model_refuses_an_order_that_could_strand_the_machine() {
        let wrong: [&[Step]; 3] = [
            &[Step::EmptySlot],
            &[Step::RemoveOldBoot, Step::WriteSlot],
            &[
                Step::RemoveOldBoot,
                Step::EmptySlot,
                Step::WriteSlot,
                Step::NameSlot,
            ],
        ];
        for steps in wrong {
            let mut disk = machine();
            for step in steps {
                disk.apply(*step, 3);
            }
            assert!(!disk.every_entry_is_whole(), "{steps:?}");
        }
    }

    /// A staged boot file changes nothing about the next start, so applying stays a person's decision.
    #[test]
    fn an_installed_update_does_not_boot_until_applied() {
        let mut disk = machine();
        for step in INSTALL_STEPS {
            disk.apply(step, 3);
        }
        assert_eq!(disk.staged, Some(3));
        assert_eq!(disk.loader_choice().map(|e| e.version), Some(2));
    }

    /// A new version that never proves good runs out of tries, and the old one boots by itself.
    #[test]
    fn a_version_that_keeps_failing_gives_way_to_the_old_one() {
        let mut disk = machine();
        for step in INSTALL_STEPS {
            disk.apply(step, 3);
        }
        disk.entries.push(Entry {
            version: 3,
            tries: Some(TRIES),
        });
        let mut starts = 0;
        while disk.loader_choice().is_some_and(|e| e.version == 3) {
            starts += 1;
            for entry in &mut disk.entries {
                if entry.version == 3 {
                    entry.tries = entry.tries.map(|left| left.saturating_sub(1));
                }
            }
            assert!(starts <= TRIES, "tries must be bounded");
        }
        assert_eq!(starts, TRIES);
        assert_eq!(disk.loader_choice().map(|e| e.version), Some(2));
    }
}
