#!/bin/sh
# (Re)create the prod deploy-failure alarm (audit M3). deploy-blue-green.sh emits a
# BOM/Production `DeployFailed` metric via the instance role's PutMetricData: 1 on any
# failure exit, 0 on success. This alarm pages the bom-production-alerts SNS topic when
# a deploy fails — deploys previously failed SILENTLY (a broken build / missing env left
# prod on the old image with no signal).
#
# The instance role can PutMetricData but NOT PutMetricAlarm, so run this from a
# workstation with CloudWatch admin creds. Idempotent. Identifiers are derived (STS) or
# required via env — nothing hardcoded into this public repo.
#     BOM_INSTANCE_ID=i-xxxxxxxx ops/aws/cloudwatch-deploy-failed-alarm.sh
set -eu

REGION="${AWS_REGION:-us-west-2}"
NAMESPACE="${BOM_METRIC_NAMESPACE:-BOM/Production}"
INSTANCE_ID="${BOM_INSTANCE_ID:?set BOM_INSTANCE_ID to the prod EC2 instance id}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
SNS_TOPIC="${BOM_ALERTS_SNS_ARN:-arn:aws:sns:${REGION}:${ACCOUNT}:${BOM_ALERTS_TOPIC:-bom-production-alerts}}"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "bom-production-deploy-failed" \
  --alarm-description "A prod blue-green deploy exited with failure (DeployFailed>=1). Emitted by deploy-blue-green.sh; deploys previously failed silently." \
  --namespace "$NAMESPACE" \
  --metric-name "DeployFailed" \
  --dimensions "Name=InstanceId,Value=$INSTANCE_ID" \
  --statistic "Maximum" \
  --period 300 \
  --threshold 1 \
  --comparison-operator "GreaterThanOrEqualToThreshold" \
  --evaluation-periods 1 \
  --datapoints-to-alarm 1 \
  --treat-missing-data "notBreaching" \
  --alarm-actions "$SNS_TOPIC" \
  --ok-actions "$SNS_TOPIC"

printf 'updated alarm bom-production-deploy-failed: DeployFailed>=1 (Max/300s) -> %s\n' "$SNS_TOPIC"
