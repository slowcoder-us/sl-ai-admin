import { App } from "aws-cdk-lib";

import { BackendStack } from "./backend-stack";

const app = new App();
// biome-ignore lint/correctness/noUnusedInstantiation: CDK registers stacks on their parent app.
new BackendStack(app, "SlAiAdminBackend", {
	env: {
		account: process.env.CDK_DEFAULT_ACCOUNT,
		region: process.env.CDK_DEFAULT_REGION,
	},
});
