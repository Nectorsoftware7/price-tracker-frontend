// One place for what each stored role is called on screen.
//
// There were two of these — the Users table called `admin` "E-commerce Executive" while
// the account menu called it "Admin" — so the same person read as two different things
// depending on where they looked. Whichever wording is right, it has to be one wording.
//
// `viewer` was missing from the table's map entirely and fell through to the raw value,
// which is why it showed lowercase beside two capitalised labels.
export const ROLE_LABELS = {
  admin: "E-commerce Executive",
  superadmin: "Superadmin",
  viewer: "Viewer",
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}
