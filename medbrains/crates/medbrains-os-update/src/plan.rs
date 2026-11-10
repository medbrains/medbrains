//! The order of an update's writes, kept apart so the order itself can be tested. A boot entry may
//! exist only while its partition is complete and carries its version: that is what makes a power cut
//! at any step harmless, and `tests` checks it at every step.

/// One write to the disk, in `INSTALL_STEPS` order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Step {
    /// Remove the boot entry of the version in the other partition.
    RemoveOldBoot,
    /// Mark the other partition as holding nothing.
    EmptySlot,
    /// Write the system image, and read it back from the disk.
    WriteSlot,
    /// Give the new system this machine's identity, and check it agrees about who owns files.
    AdoptIdentity,
    /// Name the partition after the new version, which only now it fully is.
    LabelSlot,
    /// Put the boot file where the loader does not look: applying is a separate decision.
    StageBoot,
}

/// How an install runs. Changing this order is a class A change: the model below must still pass.
pub const INSTALL_STEPS: [Step; 6] = [
    Step::RemoveOldBoot,
    Step::EmptySlot,
    Step::WriteSlot,
    Step::AdoptIdentity,
    Step::LabelSlot,
    Step::StageBoot,
];

/// Starts a new version gets before the machine goes back by itself.
pub const TRIES: u32 = 3;

#[cfg(test)]
mod tests {
    use super::{INSTALL_STEPS, Step, TRIES};

    /// A system partition in the model.
    #[derive(Debug, Clone, PartialEq, Eq)]
    struct Slot {
        label: Option<u32>,
        complete: Option<u32>,
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
            complete: Some(v),
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
            match step {
                Step::RemoveOldBoot => self.entries.retain(|e| Some(e.version) != old),
                Step::EmptySlot => self.slots[1].label = None,
                Step::WriteSlot => self.slots[1].complete = Some(new),
                Step::AdoptIdentity => {}
                Step::LabelSlot => self.slots[1].label = Some(new),
                Step::StageBoot => self.staged = Some(new),
            }
        }

        /// The invariant: every entry the loader can see boots a whole system of its own version.
        fn every_entry_is_whole(&self) -> bool {
            self.entries.iter().all(|e| {
                self.slots
                    .iter()
                    .any(|s| s.label == Some(e.version) && s.complete == Some(e.version))
            })
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

    /// The model must catch a wrong order, or the test above proves nothing.
    #[test]
    fn the_model_refuses_an_order_that_could_strand_the_machine() {
        let mut disk = machine();
        disk.apply(Step::EmptySlot, 3);
        assert!(!disk.every_entry_is_whole());
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
