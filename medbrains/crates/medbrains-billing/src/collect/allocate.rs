//! Spreading a collection's tenders over the bills in scope.
//!
//! Money belongs to the hospital, so nothing is apportioned between
//! departments: tenders fill the oldest bill first, then the next. A payment
//! row is one tender on one bill, so the day close still sees each mode.

use rust_decimal::Decimal;

/// `amount` of tender `tender` lands on bill `bill`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Slice {
    pub bill: usize,
    pub tender: usize,
    pub amount: Decimal,
}

/// Fill `balances` (oldest first) from `tenders` in order.
///
/// A bill at or below zero (paid, or in credit) takes nothing and is passed
/// over; without that a negative balance never reaches zero and the loop
/// never ends, whatever the caller's SQL filtered.
///
/// # Errors
/// What the tenders exceed the balances by, when they do.
pub fn allocate(balances: &[Decimal], tenders: &[Decimal]) -> Result<Vec<Slice>, Decimal> {
    let mut left: Vec<Decimal> = balances.to_vec();
    let mut slices = Vec::new();
    let mut bill = 0;
    for (tender, amount) in tenders.iter().enumerate() {
        let mut due = *amount;
        while due > Decimal::ZERO {
            let Some(room) = left.get_mut(bill) else {
                let excess: Decimal = due + tenders.iter().skip(tender + 1).sum::<Decimal>();
                return Err(excess);
            };
            let take = due.min(*room);
            if take > Decimal::ZERO {
                slices.push(Slice {
                    bill,
                    tender,
                    amount: take,
                });
                *room -= take;
                due -= take;
            }
            if *room <= Decimal::ZERO {
                bill += 1;
            }
        }
    }
    Ok(slices)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(n: i64) -> Decimal {
        Decimal::from(n)
    }

    #[test]
    fn a_split_tender_fills_the_oldest_bill_first() {
        let got = allocate(&[d(300), d(500)], &[d(400), d(400)]).expect("fits");
        assert_eq!(
            got,
            vec![
                Slice {
                    bill: 0,
                    tender: 0,
                    amount: d(300)
                },
                Slice {
                    bill: 1,
                    tender: 0,
                    amount: d(100)
                },
                Slice {
                    bill: 1,
                    tender: 1,
                    amount: d(400)
                },
            ]
        );
    }

    #[test]
    fn a_part_payment_leaves_the_rest_due_and_too_much_is_refused() {
        assert_eq!(
            allocate(&[d(300), d(500)], &[d(100)]),
            Ok(vec![Slice {
                bill: 0,
                tender: 0,
                amount: d(100)
            }])
        );
        assert_eq!(allocate(&[d(300)], &[d(200), d(150)]), Err(d(50)));
    }

    #[test]
    fn a_bill_in_credit_is_passed_over_instead_of_looping_forever() {
        let (send, recv) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let _ = send.send(allocate(&[d(-50), d(100)], &[d(80)]));
        });
        let got = recv
            .recv_timeout(std::time::Duration::from_secs(2))
            .expect("allocate returned instead of looping");
        assert_eq!(
            got,
            Ok(vec![Slice {
                bill: 1,
                tender: 0,
                amount: d(80)
            }])
        );
    }
}
