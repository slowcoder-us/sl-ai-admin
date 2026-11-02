import z from "zod";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;
export const PASSWORD_MIN_LENGTH = 8;
export const PLACEHOLDER_EMAIL_DOMAIN = "users.sl-ai-admin.local";

export const AUTH_MESSAGES = {
	invalidCredentials: "用户名或密码错误",
	passwordMismatch: "两次输入的密码不一致",
	passwordRequired: "请输入密码",
	passwordTooShort: `密码至少 ${PASSWORD_MIN_LENGTH} 位`,
	signInFailed: "登录失败，请稍后重试",
	signUpFailed: "注册失败，请稍后重试",
	usernameInvalid: `用户名格式不正确（${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} 位字母、数字或下划线）`,
	usernameRequired: "请输入用户名",
	usernameTaken: "用户名已被注册",
} as const;

const HTTP_BAD_REQUEST = 400;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;

export function isValidUsername(username: string): boolean {
	return (
		username.length >= USERNAME_MIN_LENGTH &&
		username.length <= USERNAME_MAX_LENGTH &&
		USERNAME_PATTERN.test(username)
	);
}

export const signInSchema = z.object({
	password: z.string().min(1, AUTH_MESSAGES.passwordRequired),
	username: z.string().trim().min(1, AUTH_MESSAGES.usernameRequired),
});

export const signUpSchema = z
	.object({
		confirmPassword: z.string(),
		password: z
			.string()
			.min(PASSWORD_MIN_LENGTH, AUTH_MESSAGES.passwordTooShort),
		username: z
			.string()
			.trim()
			.refine(isValidUsername, AUTH_MESSAGES.usernameInvalid),
	})
	.refine((value) => value.password === value.confirmPassword, {
		message: AUTH_MESSAGES.passwordMismatch,
		path: ["confirmPassword"],
	});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;

/** Better Auth requires an email; accounts here are username-only, so derive an undeliverable one. */
export function toPlaceholderEmail(username: string): string {
	return `${username.trim().toLowerCase()}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

const USERNAME_TAKEN_CODES = new Set([
	"USERNAME_IS_ALREADY_TAKEN",
	"USER_ALREADY_EXISTS",
	"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
]);
const USERNAME_INVALID_CODES = new Set([
	"INVALID_USERNAME",
	"USERNAME_TOO_SHORT",
	"USERNAME_TOO_LONG",
]);

export function getSignUpErrorMessage(code: string | undefined): string {
	if (code && USERNAME_TAKEN_CODES.has(code)) {
		return AUTH_MESSAGES.usernameTaken;
	}
	if (code && USERNAME_INVALID_CODES.has(code)) {
		return AUTH_MESSAGES.usernameInvalid;
	}
	if (code === "PASSWORD_TOO_SHORT") {
		return AUTH_MESSAGES.passwordTooShort;
	}
	return AUTH_MESSAGES.signUpFailed;
}

/** Any client-side rejection is reported the same way so the response never reveals which field was wrong. */
export function getSignInErrorMessage(status: number | undefined): string {
	const isClientError =
		status !== undefined &&
		status >= HTTP_BAD_REQUEST &&
		status < HTTP_SERVER_ERROR &&
		status !== HTTP_TOO_MANY_REQUESTS;
	return isClientError
		? AUTH_MESSAGES.invalidCredentials
		: AUTH_MESSAGES.signInFailed;
}
