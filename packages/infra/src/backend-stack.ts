// biome-ignore-all lint/correctness/noUnusedInstantiation: CDK registers constructs on their parent scope.
import { fileURLToPath } from "node:url";
import {
	CfnOutput,
	CfnParameter,
	CustomResource,
	Duration,
	IgnoreMode,
	RemovalPolicy,
	Stack,
	type StackProps,
} from "aws-cdk-lib";
import { CfnStage, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
	AmazonLinuxCpuType,
	CfnEIP,
	CfnInternetGateway,
	CfnNatGateway,
	CfnRoute,
	CfnVPCGatewayAttachment,
	Instance,
	InstanceType,
	IpAddresses,
	MachineImage,
	Peer,
	Port,
	PublicSubnet,
	SecurityGroup,
	SubnetType,
	Vpc,
} from "aws-cdk-lib/aws-ec2";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
	Architecture,
	DockerImageCode,
	DockerImageFunction,
} from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Provider } from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";

const DB_NAME = "sl_ai_admin";
const APP_DB_USER = "sl_ai_app";
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const dockerFile = "apps/server/Dockerfile";

export class BackendStack extends Stack {
	constructor(scope: Construct, id: string, props: StackProps) {
		super(scope, id, props);

		const webOrigin = new CfnParameter(this, "WebOrigin", {
			allowedPattern: "https://[a-zA-Z0-9.-]+",
			description:
				"Public HTTPS origin of the Cloudflare Worker, without a trailing slash",
		}).valueAsString;

		const databaseHost = new CfnParameter(this, "DatabaseHost", {
			allowedPattern: "[a-zA-Z0-9.-]+\\.rds\\.amazonaws\\.com",
			description:
				"Aurora Express endpoint from the database connectivity panel",
		}).valueAsString;
		const databaseResourceId = new CfnParameter(this, "DatabaseResourceId", {
			allowedPattern: "cluster-[A-Za-z0-9]+",
			description:
				"Aurora DbClusterResourceId, not the cluster identifier or ARN",
		}).valueAsString;
		const databaseAdminUser = new CfnParameter(this, "DatabaseAdminUser", {
			allowedPattern: "[a-z][a-z0-9_]{0,62}",
			default: "postgres",
		}).valueAsString;
		const connectPolicy = (username: string) =>
			new PolicyStatement({
				actions: ["rds-db:connect"],
				resources: [
					`arn:${this.partition}:rds-db:${this.region}:${this.account}:dbuser:${databaseResourceId}/${username}`,
				],
			});
		const vpc = new Vpc(this, "Vpc", {
			createInternetGateway: false,
			ipAddresses: IpAddresses.cidr("10.42.0.0/16"),
			maxAzs: 2,
			natGateways: 0,
			subnetConfiguration: [
				{
					cidrMask: 24,
					name: "Application",
					subnetType: SubnetType.PRIVATE_WITH_EGRESS,
				},
			],
		});
		const [firstAz] = vpc.availabilityZones;
		if (!firstAz) {
			throw new Error("The VPC requires at least two availability zones");
		}
		const publicSubnet = new PublicSubnet(this, "EgressSubnet", {
			availabilityZone: firstAz,
			cidrBlock: "10.42.254.0/24",
			mapPublicIpOnLaunch: false,
			vpcId: vpc.vpcId,
		});
		const internetGateway = new CfnInternetGateway(this, "InternetGateway");
		const attachment = new CfnVPCGatewayAttachment(
			this,
			"AttachInternetGateway",
			{
				internetGatewayId: internetGateway.ref,
				vpcId: vpc.vpcId,
			}
		);
		publicSubnet.addDefaultInternetRoute(internetGateway.ref, attachment);
		const eip = new CfnEIP(this, "NatAddress", { domain: "vpc" });
		const nat = new CfnNatGateway(this, "Nat", {
			allocationId: eip.attrAllocationId,
			subnetId: publicSubnet.subnetId,
		});
		nat.node.addDependency(publicSubnet.internetConnectivityEstablished);
		const applicationEgressRoutes = vpc.privateSubnets.map(
			(subnet, index) =>
				new CfnRoute(this, `ApplicationEgress${index}`, {
					destinationCidrBlock: "0.0.0.0/0",
					natGatewayId: nat.ref,
					routeTableId: subnet.routeTable.routeTableId,
				})
		);

		const lambdaSecurity = new SecurityGroup(this, "LambdaSecurity", {
			allowAllOutbound: false,
			vpc,
		});
		lambdaSecurity.addEgressRule(
			Peer.anyIpv4(),
			Port.tcp(443),
			"GitHub API over HTTPS"
		);
		lambdaSecurity.addEgressRule(
			Peer.anyIpv4(),
			Port.tcp(5432),
			"Aurora Express TLS gateway"
		);
		const bastionSecurity = new SecurityGroup(this, "BastionSecurity", {
			allowAllOutbound: false,
			vpc,
		});
		bastionSecurity.addEgressRule(
			Peer.anyIpv4(),
			Port.tcp(443),
			"Systems Manager over HTTPS"
		);
		bastionSecurity.addEgressRule(
			Peer.anyIpv4(),
			Port.tcp(5432),
			"Aurora Express TLS gateway"
		);
		const privateSubnets = { subnetType: SubnetType.PRIVATE_WITH_EGRESS };
		const bastion = new Instance(this, "DatabaseBastion", {
			instanceType: new InstanceType("t4g.micro"),
			machineImage: MachineImage.latestAmazonLinux2023({
				cpuType: AmazonLinuxCpuType.ARM_64,
			}),
			requireImdsv2: true,
			securityGroup: bastionSecurity,
			ssmSessionPermissions: true,
			vpc,
			vpcSubnets: privateSubnets,
		});
		bastion.addToRolePolicy(connectPolicy(databaseAdminUser));
		const authSecret = new Secret(this, "AuthSecret", {
			generateSecretString: {
				excludePunctuation: true,
				generateStringKey: "secret",
				passwordLength: 64,
				secretStringTemplate: "{}",
			},
			removalPolicy: RemovalPolicy.RETAIN,
		});
		const image = new DockerImageAsset(this, "ServerImage", {
			directory: repositoryRoot,
			exclude: [
				".*",
				"**/.*",
				"!.dockerignore",
				"!apps/server/.env.schema",
				"!packages/db/.env.schema",
				"**/node_modules",
				"**/dist",
				"**/*.tsbuildinfo",
				"**/prisma/generated",
				"apps/web/**",
				"!apps/web/package.json",
				"apps/native/**",
				"!apps/native/package.json",
				"apps/fumadocs/**",
				"!apps/fumadocs/package.json",
				"docs",
				"specs",
				"aws任务",
				"scripts",
				"packages/infra/**",
				"!packages/infra/package.json",
			],
			file: dockerFile,
			ignoreMode: IgnoreMode.DOCKER,
			platform: Platform.LINUX_AMD64,
		});
		const databaseEnv = {
			DB_AUTH_MODE: "iam",
			DB_HOST: databaseHost,
			DB_NAME,
			NODE_ENV: "production",
		};
		const lambdaVpc = {
			securityGroups: [lambdaSecurity],
			vpc,
			vpcSubnets: privateSubnets,
		};
		const migrationFunction = new DockerImageFunction(this, "MigrateDatabase", {
			...lambdaVpc,
			architecture: Architecture.X86_64,
			code: DockerImageCode.fromEcr(image.repository, {
				cmd: ["apps/server/dist/migrate.handler"],
				tagOrDigest: image.imageTag,
			}),
			environment: {
				...databaseEnv,
				DB_USER: databaseAdminUser,
			},
			logGroup: new LogGroup(this, "MigrationLogs", {
				retention: RetentionDays.ONE_MONTH,
			}),
			memorySize: 1024,
			timeout: Duration.minutes(3),
		});
		migrationFunction.addToRolePolicy(connectPolicy(databaseAdminUser));
		const migrations = new Provider(this, "MigrationProvider", {
			onEventHandler: migrationFunction,
		});
		const schema = new CustomResource(this, "DatabaseSchema", {
			properties: {
				DatabaseHost: databaseHost,
				DatabaseResourceId: databaseResourceId,
				Release: image.assetHash,
			},
			resourceType: "Custom::PrismaMigrations",
			serviceToken: migrations.serviceToken,
		});
		// The migration connects through NAT on its first invocation. Explicitly
		// wait for the manually managed routes, not only the Lambda ENIs.
		schema.node.addDependency(...applicationEgressRoutes);
		const apiFunction = new DockerImageFunction(this, "ApiFunction", {
			...lambdaVpc,
			architecture: Architecture.X86_64,
			code: DockerImageCode.fromEcr(image.repository, {
				tagOrDigest: image.imageTag,
			}),
			environment: {
				...databaseEnv,
				BETTER_AUTH_SECRET: authSecret
					.secretValueFromJson("secret")
					.unsafeUnwrap(),
				BETTER_AUTH_URL: webOrigin,
				CORS_ORIGIN: webOrigin,
				DB_USER: APP_DB_USER,
			},
			logGroup: new LogGroup(this, "ApiLogs", {
				retention: RetentionDays.ONE_MONTH,
			}),
			memorySize: 1024,
			// Leave query time after IAM authentication and finish before the
			// HTTP integration's default 29-second deadline.
			timeout: Duration.seconds(28),
		});
		apiFunction.addToRolePolicy(connectPolicy(APP_DB_USER));
		apiFunction.node.addDependency(schema);

		const api = new HttpApi(this, "HttpApi");
		const integration = new HttpLambdaIntegration("Hono", apiFunction);
		api.addRoutes({ integration, methods: [HttpMethod.GET], path: "/" });
		for (const path of ["/api/auth/{proxy+}", "/trpc/{proxy+}"]) {
			api.addRoutes({
				integration,
				methods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.OPTIONS],
				path,
			});
		}
		const stage = api.defaultStage?.node.defaultChild;
		if (stage instanceof CfnStage) {
			stage.defaultRouteSettings = {
				throttlingBurstLimit: 40,
				throttlingRateLimit: 20,
			};
		}

		new CfnOutput(this, "ApiOrigin", { value: api.apiEndpoint });
		new CfnOutput(this, "BastionInstanceId", { value: bastion.instanceId });
		new CfnOutput(this, "DatabaseEndpoint", {
			value: databaseHost,
		});
		new CfnOutput(this, "DatabaseName", { value: DB_NAME });
		new CfnOutput(this, "ExpressDatabaseResourceId", {
			value: databaseResourceId,
		});
	}
}
