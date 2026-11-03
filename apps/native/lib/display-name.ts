interface NamedUser {
	displayUsername?: string | null;
	name: string;
	username?: string | null;
}

/** The username as the user typed it at sign-up, falling back to the normalized one (same rule as Web). */
export function getDisplayName(user: NamedUser): string {
	return user.displayUsername || user.username || user.name;
}
