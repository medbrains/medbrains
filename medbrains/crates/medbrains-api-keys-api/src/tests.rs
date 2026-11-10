use super::service_username;
use uuid::Uuid;

#[test]
fn service_usernames_satisfy_the_username_constraint() {
    let id = Uuid::from_u128(0x1234_5678_9abc_def0_1234_5678_9abc_def0);
    for name in [
        "Lab Integration",
        "  Billing  Sync  ",
        "X-Ray/PACS bridge",
        "日本語",
        "!!!",
        "Print bridge for the ward three Zebra printers",
        "Lab bridge  -  chemistry wing",
    ] {
        let username = service_username(name, id);
        assert!(
            username
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'),
            "`{username}` (from `{name}`) breaks chk_users_username_pattern",
        );
        assert!(
            (3..=30).contains(&username.len()),
            "`{username}` breaks chk_users_username_length",
        );
        assert!(!username.contains("__"), "`{username}`");
        assert!(
            username.starts_with("svc_"),
            "{username} is not marked as a service account"
        );
    }
}
