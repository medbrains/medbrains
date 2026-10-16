//! What a hospital needs to run MedBrains, from what it tells us about itself:
//! a server tier, storage for a year of records, backups, and — for cloud
//! placements — what that infrastructure costs a month. Pure arithmetic, so
//! the sign-up page and the vendor console quote the same thing.

use serde::{Deserialize, Serialize};

/// Where the hospital's MedBrains runs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Placement {
    /// On our shared cloud: running in minutes, infrastructure included.
    SharedCloud,
    /// A server of their own in our cloud account.
    DedicatedCloud,
    /// Their own hardware, on their premises.
    OnPrem,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SizingInput {
    pub beds: u32,
    /// Staff who will sign in (not all at once).
    pub staff_users: u32,
    /// Radiology images stored in MedBrains (PACS), the largest storage driver.
    #[serde(default)]
    pub imaging: bool,
    pub placement: Placement,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Sizing {
    pub tier: &'static str,
    pub vcpu: u32,
    pub ram_gb: u32,
    /// Database and documents for the first year.
    pub storage_gb: u32,
    pub backup_gb: u32,
    /// The cloud instance, for cloud placements.
    pub cloud_instance: Option<&'static str>,
    /// Infrastructure cost a month in rupees for a dedicated server; `None`
    /// when it is included (shared cloud) or the hospital's own (on-prem).
    pub infra_monthly_inr: Option<u32>,
    /// The machine to buy, for on-prem.
    pub hardware: Option<String>,
}

/// Inputs beyond these are a typo, not a hospital.
pub const MAX_BEDS: u32 = 5_000;
pub const MAX_STAFF: u32 = 20_000;

/// Share of staff signed in at the busiest hour.
const PEAK_SHARE_PERCENT: u32 = 40;

struct Tier {
    name: &'static str,
    max_concurrent: u32,
    max_beds: u32,
    vcpu: u32,
    ram_gb: u32,
    instance: &'static str,
    /// On-demand, ap-south-1, a month at 730 hours.
    // ponytail: list prices typed in 2026-10; read the AWS price list API when quotes must be exact.
    instance_monthly_inr: u32,
}

const TIERS: &[Tier] = &[
    Tier { name: "small", max_concurrent: 25, max_beds: 50, vcpu: 2, ram_gb: 4,
           instance: "t4g.medium", instance_monthly_inr: 2_050 },
    Tier { name: "medium", max_concurrent: 100, max_beds: 200, vcpu: 4, ram_gb: 16,
           instance: "t4g.xlarge", instance_monthly_inr: 8_200 },
    Tier { name: "large", max_concurrent: 300, max_beds: 500, vcpu: 8, ram_gb: 32,
           instance: "m7g.2xlarge", instance_monthly_inr: 19_900 },
    Tier { name: "xlarge", max_concurrent: u32::MAX, max_beds: u32::MAX, vcpu: 16, ram_gb: 64,
           instance: "m7g.4xlarge", instance_monthly_inr: 39_800 },
];

/// gp3 volume and S3 backup storage, rupees per GB a month.
const DISK_INR_PER_GB: u32 = 8;
const BACKUP_INR_PER_GB: u32 = 2;

fn round_up_to(value: u32, step: u32) -> u32 {
    value.div_ceil(step) * step
}

pub fn recommend(input: &SizingInput) -> Sizing {
    let beds = input.beds.min(MAX_BEDS);
    let staff = input.staff_users.min(MAX_STAFF);
    let concurrent = (staff * PEAK_SHARE_PERCENT).div_ceil(100).max(1);
    // The first tier both the busiest hour and the bed count fit; the last always fits.
    let tier = TIERS
        .iter()
        .find(|t| concurrent <= t.max_concurrent && beds <= t.max_beds)
        .unwrap_or(&TIERS[TIERS.len() - 1]);
    // A year of records: a base, then per bed and per user; imaging dwarfs both.
    let imaging_gb = if input.imaging { beds * 10 } else { 0 };
    let storage_gb = round_up_to(40 + beds + staff / 5 + imaging_gb, 10);
    // Thirty days of point-in-time recovery holds about twice the data.
    let backup_gb = storage_gb * 2;
    let (cloud_instance, infra_monthly_inr, hardware) = match input.placement {
        Placement::SharedCloud => (Some(tier.instance), None, None),
        Placement::DedicatedCloud => (
            Some(tier.instance),
            Some(tier.instance_monthly_inr + storage_gb * DISK_INR_PER_GB + backup_gb * BACKUP_INR_PER_GB),
            None,
        ),
        // Bought once for three years: double the cores and memory for headroom,
        // three years of storage, mirrored.
        Placement::OnPrem => (
            None,
            None,
            Some(format!(
                "{} cores, {} GB RAM, 2 × {} GB SSD (RAID 1), UPS",
                tier.vcpu * 2,
                tier.ram_gb * 2,
                round_up_to(storage_gb * 3, 100)
            )),
        ),
    };
    Sizing {
        tier: tier.name,
        vcpu: tier.vcpu,
        ram_gb: tier.ram_gb,
        storage_gb,
        backup_gb,
        cloud_instance,
        infra_monthly_inr,
        hardware,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn size(beds: u32, staff: u32, imaging: bool, placement: Placement) -> Sizing {
        recommend(&SizingInput { beds, staff_users: staff, imaging, placement })
    }

    #[test]
    fn a_clinic_is_small_and_a_teaching_hospital_is_large() {
        assert_eq!(size(0, 10, false, Placement::SharedCloud).tier, "small");
        assert_eq!(size(150, 200, false, Placement::SharedCloud).tier, "medium");
        assert_eq!(size(450, 700, false, Placement::SharedCloud).tier, "large");
        assert_eq!(size(1200, 2500, true, Placement::SharedCloud).tier, "xlarge");
    }

    #[test]
    fn many_staff_on_few_beds_still_needs_the_bigger_server() {
        // 200 staff → 80 at the busiest hour: past "small" whatever the beds;
        // 300 → 120, past "medium" too.
        assert_eq!(size(20, 200, false, Placement::SharedCloud).tier, "medium");
        assert_eq!(size(20, 300, false, Placement::SharedCloud).tier, "large");
    }

    #[test]
    fn imaging_drives_storage() {
        let plain = size(100, 100, false, Placement::DedicatedCloud);
        let pacs = size(100, 100, true, Placement::DedicatedCloud);
        assert_eq!(plain.storage_gb, 160);
        assert_eq!(pacs.storage_gb, 1160);
        assert!(pacs.infra_monthly_inr > plain.infra_monthly_inr);
    }

    #[test]
    fn only_a_dedicated_server_carries_an_infra_cost() {
        assert_eq!(size(50, 40, false, Placement::SharedCloud).infra_monthly_inr, None);
        assert!(size(50, 40, false, Placement::DedicatedCloud).infra_monthly_inr.is_some());
        let onprem = size(50, 40, false, Placement::OnPrem);
        assert_eq!(onprem.infra_monthly_inr, None);
        assert_eq!(onprem.cloud_instance, None);
        assert_eq!(onprem.hardware.as_deref(), Some("4 cores, 8 GB RAM, 2 × 300 GB SSD (RAID 1), UPS"));
    }

    #[test]
    fn absurd_inputs_are_capped_not_trusted() {
        let huge = size(u32::MAX, u32::MAX, true, Placement::SharedCloud);
        assert_eq!(huge.tier, "xlarge");
        assert!(huge.storage_gb < 100_000);
    }
}
