#!/bin/bash

# Get AWS configuration from CloudFormation stack
STACK_NAME="conductor-app-infrastructure"
REGION="ap-southeast-2"

echo "Getting AWS configuration from stack: $STACK_NAME"

# Get subnet IDs
SUBNET_1=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet1`].OutputValue' \
  --output text)

SUBNET_2=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet2`].OutputValue' \
  --output text)

# Get security group ID
SECURITY_GROUP=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroup`].OutputValue' \
  --output text)

echo "SUBNET_1=$SUBNET_1"
echo "SUBNET_2=$SUBNET_2" 
echo "SECURITY_GROUP=$SECURITY_GROUP"

# Update the CD pipeline with actual values
sed -i "s/subnet-xxx/$SUBNET_1/g; s/subnet-yyy/$SUBNET_2/g; s/sg-xxx/$SECURITY_GROUP/g" .github/workflows/cd-pipeline.yml

echo "✅ Updated CD pipeline with actual AWS configuration"
