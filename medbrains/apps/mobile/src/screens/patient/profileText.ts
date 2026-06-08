type MobileProfileTextValues = Record<string, string | number | boolean>;

const MOBILE_PROFILE_MESSAGES: Record<string, string> = {
  "profile.account.changePassword": "Change Password",
  "profile.account.notifications": "Notifications",
  "profile.account.privacySettings": "Privacy Settings",
  "profile.account.section": "Account",
  "profile.action.cancel": "Cancel",
  "profile.action.edit": "Edit",
  "profile.action.save": "Save",
  "profile.action.signOut": "Sign Out",
  "profile.contact.address": "Address",
  "profile.contact.email": "Email",
  "profile.contact.phone": "Phone",
  "profile.contact.secondaryPhone": "Secondary Phone",
  "profile.contact.section": "Contact Information",
  "profile.dialog.signOutMessage": "Are you sure you want to sign out?",
  "profile.dialog.signOutTitle": "Sign Out",
  "profile.errors.invalidEmail": "Enter a valid email address",
  "profile.errors.invalidPhone": "Enter a valid phone number",
  "profile.fallback.notProvided": "Not provided",
  "profile.fallback.notSpecified": "Not specified",
  "profile.fallback.user": "User",
  "profile.family.father": "Father",
  "profile.family.guardian": "Guardian",
  "profile.family.guardianWithRelation": "{{name}} ({{relation}})",
  "profile.family.section": "Guardian / Family",
  "profile.medical.allergies": "Allergies",
  "profile.medical.bloodGroup": "Blood Group",
  "profile.medical.dateOfBirth": "Date of Birth",
  "profile.medical.noKnownAllergies": "No known allergies",
  "profile.medical.section": "Medical Information",
  "profile.medical.viewAllergies": "View allergies",
  "profile.snackbar.updateFailed": "Failed to update profile",
  "profile.snackbar.updated": "Profile updated successfully",
  "profile.version": "MedBrains v{{version}}",
};

function interpolate(template: string, values?: MobileProfileTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function mobileProfileText(key: string, values?: MobileProfileTextValues): string {
  const template = MOBILE_PROFILE_MESSAGES[key];

  return template ? interpolate(template, values) : key;
}
