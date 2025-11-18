import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export class ConductorAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ECR Repository
    const repository = new ecr.Repository(this, 'ConductorAppRepository', {
      repositoryName: 'conductor-app',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // VPC
    const vpc = new ec2.Vpc(this, 'ConductorAppVpc', {
      maxAzs: 2,
      natGateways: 0, // Use public subnets only to save costs
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'ConductorAppCluster', {
      clusterName: 'conductor-app-cluster',
      vpc,
    });

    // Security Group
    const securityGroup = new ec2.SecurityGroup(this, 'ConductorAppSecurityGroup', {
      vpc,
      description: 'Security group for Conductor App',
      allowAllOutbound: true,
    });

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3001),
      'Allow HTTP traffic on port 3001'
    );

    // CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'ConductorAppLogGroup', {
      logGroupName: '/ecs/conductor-app',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Application Load Balancer
    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ConductorAppALB', {
      vpc,
      internetFacing: true,
      securityGroup,
    });

    const listener = loadBalancer.addListener('ConductorAppListener', {
      port: 80,
      open: true,
    });

    // ECS Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ConductorAppTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    const container = taskDefinition.addContainer('ConductorAppContainer', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'conductor-app',
        logGroup,
      }),
      portMappings: [{
        containerPort: 3001,
        protocol: ecs.Protocol.TCP,
      }],
    });

    // ECS Service
    const service = new ecs.FargateService(this, 'ConductorAppService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      securityGroups: [securityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'ConductorAppTargetGroup', {
      port: 3001,
      vpc,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheckPath: '/',
    });

    targetGroup.addTarget(service);
    listener.addTargetGroups('ConductorAppTargetGroup', {
      targetGroups: [targetGroup],
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApplicationURL', {
      value: `http://${loadBalancer.loadBalancerDnsName}`,
      description: 'Public URL for the Conductor App',
    });

    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: repository.repositoryUri,
      exportName: 'ConductorAppRepositoryUri',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      exportName: 'ConductorAppClusterName',
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      exportName: 'ConductorAppVpcId',
    });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      value: securityGroup.securityGroupId,
      exportName: 'ConductorAppSecurityGroupId',
    });

    new cdk.CfnOutput(this, 'PublicSubnets', {
      value: vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
      exportName: 'ConductorAppPublicSubnets',
    });
  }
}
