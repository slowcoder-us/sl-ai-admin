import { CfnOutput, CfnParameter, Stack, type StackProps } from "aws-cdk-lib";
import { CfnProject } from "aws-cdk-lib/aws-codebuild";
import { PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

export class RunnerStack extends Stack {
	constructor(scope: Construct, id: string, props: StackProps) {
		super(scope, id, props);
		const connectionArn = new CfnParameter(this, "GitHubConnectionArn", {
			allowedPattern:
				"arn:aws:(codeconnections|codestar-connections):[a-z0-9-]+:[0-9]{12}:connection/[a-zA-Z0-9-]+",
			description:
				"Available GitHub App connection authorized only for slowcoder-us/sl-ai-admin",
		}).valueAsString;
		const actorId = new CfnParameter(this, "TrustedGitHubActorId", {
			allowedPattern: "[0-9]+",
			description:
				"Numeric GitHub user ID allowed to start privileged deployment jobs",
		}).valueAsString;
		const role = new Role(this, "RunnerRole", {
			assumedBy: new ServicePrincipal("codebuild.amazonaws.com", {
				conditions: {
					ArnEquals: {
						"aws:SourceArn": `arn:${this.partition}:codebuild:${this.region}:${this.account}:project/sl-ai-admin-deploy`,
					},
					StringEquals: { "aws:SourceAccount": this.account },
				},
			}),
		});
		role.addToPolicy(
			new PolicyStatement({
				actions: ["sts:AssumeRole"],
				resources: [
					"deploy",
					"file-publishing",
					"image-publishing",
					"lookup",
				].map(
					(kind) =>
						`arn:${this.partition}:iam::${this.account}:role/cdk-hnb659fds-${kind}-role-${this.account}-${this.region}`
				),
			})
		);
		role.addToPolicy(
			new PolicyStatement({
				actions: [
					"codeconnections:GetConnection",
					"codeconnections:GetConnectionToken",
				],
				resources: [connectionArn],
			})
		);
		role.addToPolicy(
			new PolicyStatement({
				actions: ["codeconnections:UseConnection"],
				conditions: {
					StringEquals: {
						"codeconnections:FullRepositoryId": "slowcoder-us/sl-ai-admin",
					},
				},
				resources: [connectionArn],
			})
		);
		const logs = new LogGroup(this, "RunnerLogs", {
			retention: RetentionDays.TWO_WEEKS,
		});
		const grant = logs.grantWrite(role);
		const project = new CfnProject(this, "Runner", {
			artifacts: { type: "NO_ARTIFACTS" },
			concurrentBuildLimit: 1,
			environment: {
				computeType: "BUILD_GENERAL1_SMALL",
				image: "aws/codebuild/standard:7.0",
				privilegedMode: true,
				type: "LINUX_CONTAINER",
			},
			logsConfig: {
				cloudWatchLogs: { groupName: logs.logGroupName, status: "ENABLED" },
			},
			name: "sl-ai-admin-deploy",
			queuedTimeoutInMinutes: 30,
			serviceRole: role.roleArn,
			source: {
				auth: { resource: connectionArn, type: "CODECONNECTIONS" },
				location: "https://github.com/slowcoder-us/sl-ai-admin.git",
				type: "GITHUB",
			},
			timeoutInMinutes: 60,
			triggers: {
				filterGroups: [
					[
						{ pattern: "WORKFLOW_JOB_QUEUED", type: "EVENT" },
						{ pattern: "^Verify and deploy$", type: "WORKFLOW_NAME" },
						{ pattern: `^${actorId}$`, type: "ACTOR_ACCOUNT_ID" },
					],
				],
				webhook: true,
			},
		});
		project.node.addDependency(role);
		grant.applyBefore(project);
		// biome-ignore lint/correctness/noUnusedInstantiation: CDK registers the output.
		new CfnOutput(this, "RunnerProject", { value: project.ref });
	}
}
