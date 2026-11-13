import assert from "node:assert/strict";
import { test } from "node:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { BackendStack } from "./backend-stack";
import { RunnerStack } from "./runner-stack";

const env = { account: "347076820926", region: "ap-southeast-2" };

test("Express database is referenced, never recreated as an unsupported VPC cluster", () => {
	const template = Template.fromStack(
		new BackendStack(new App(), "BackendTest", { env })
	);
	template.resourceCountIs("AWS::RDS::DBCluster", 0);
	template.resourceCountIs("AWS::RDS::DBInstance", 0);
	template.resourceCountIs("AWS::RDS::DBSubnetGroup", 0);
	template.resourceCountIs("AWS::EC2::NatGateway", 1);
	template.hasResource("Custom::PrismaMigrations", {
		DependsOn: Match.arrayWith(["ApplicationEgress0", "ApplicationEgress1"]),
	});
	template.hasResourceProperties("AWS::Lambda::Function", {
		Environment: {
			Variables: Match.objectLike({
				DB_AUTH_MODE: "iam",
				DB_USER: "sl_ai_app",
			}),
		},
		VpcConfig: Match.objectLike({ SubnetIds: Match.anyValue() }),
	});
	const json = JSON.stringify(template.toJSON());
	assert.equal(json.includes('"DB_PASSWORD"'), false);
	assert.equal(json.includes('"APP_DB_PASSWORD"'), false);
	assert.ok(json.includes("rds-db:connect"));
	assert.ok(json.includes("/sl_ai_app"));
});

test("privileged deployment runner requires the trusted actor and workflow filters", () => {
	const template = Template.fromStack(
		new RunnerStack(new App(), "RunnerTest", { env })
	);
	template.hasResourceProperties("AWS::CodeBuild::Project", {
		ConcurrentBuildLimit: 1,
		Source: Match.objectLike({
			Auth: Match.objectLike({ Type: "CODECONNECTIONS" }),
		}),
		Triggers: {
			FilterGroups: [
				[
					{ Pattern: "WORKFLOW_JOB_QUEUED", Type: "EVENT" },
					{ Pattern: "^Verify and deploy$", Type: "WORKFLOW_NAME" },
					Match.objectLike({ Type: "ACTOR_ACCOUNT_ID" }),
				],
			],
			Webhook: true,
		},
	});
});
