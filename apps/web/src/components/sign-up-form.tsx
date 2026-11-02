import {
	getSignUpErrorMessage,
	signUpSchema,
	toPlaceholderEmail,
} from "@sl-ai-admin/auth/credentials";
import { Button } from "@sl-ai-admin/ui/components/button";
import { Input } from "@sl-ai-admin/ui/components/input";
import { Label } from "@sl-ai-admin/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignUpForm({
	onSwitchToSignIn,
}: {
	onSwitchToSignIn: () => void;
}) {
	const router = useRouter();
	const { isPending } = authClient.useSession();

	const form = useForm({
		defaultValues: {
			confirmPassword: "",
			password: "",
			username: "",
		},
		onSubmit: async ({ value }) => {
			const username = value.username.trim();
			await authClient.signUp.email(
				{
					email: toPlaceholderEmail(username),
					name: username,
					password: value.password,
					username,
				},
				{
					onError: (error) => {
						toast.error(getSignUpErrorMessage(error.error.code));
					},
					onSuccess: () => {
						router.push("/dashboard");
						toast.success("注册成功");
					},
				}
			);
		},
		validators: {
			onSubmit: signUpSchema,
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-6 text-center font-bold text-3xl">注册</h1>

			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div>
					<form.Field name="username">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>用户名</Label>
								<Input
									autoComplete="username"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									value={field.state.value}
								/>
								{field.state.meta.errors.map((error) => (
									<p className="text-red-500" key={error?.message}>
										{error?.message}
									</p>
								))}
							</div>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="password">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>密码</Label>
								<Input
									autoComplete="new-password"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									type="password"
									value={field.state.value}
								/>
								{field.state.meta.errors.map((error) => (
									<p className="text-red-500" key={error?.message}>
										{error?.message}
									</p>
								))}
							</div>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="confirmPassword">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>确认密码</Label>
								<Input
									autoComplete="new-password"
									id={field.name}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									type="password"
									value={field.state.value}
								/>
								{field.state.meta.errors.map((error) => (
									<p className="text-red-500" key={error?.message}>
										{error?.message}
									</p>
								))}
							</div>
						)}
					</form.Field>
				</div>

				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ canSubmit, isSubmitting }) => (
						<Button
							className="w-full"
							disabled={!canSubmit || isSubmitting}
							type="submit"
						>
							{isSubmitting ? "注册中…" : "注册"}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<div className="mt-4 text-center">
				<Button
					className="text-indigo-600 hover:text-indigo-800"
					onClick={onSwitchToSignIn}
					variant="link"
				>
					已有账号？去登录
				</Button>
			</div>
		</div>
	);
}
