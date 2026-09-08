#!/bin/sh
# (Re)create the NPM 5xx-burst alarm requiring TWO consecutive breaching 5-minute
# datapoints instead of one, so a single self-healing blip (a ~2s backend recycle,
# or a one-bucket vulnerability-scanner burst) no longer pages. A genuinely
# sustained problem still fires after ~10 minutes; hard-outage detection is covered
# faster by the APIHealthy / ALB 5xx alarms.
#
# WHY THIS IS A SCRIPT, NOT run-on-the-box: the instance role is scoped to
# cloudwatch:PutMetricData only (ops/aws/bom-host-metrics-policy.json), so it CANNOT
# PutMetricAlarm. Run this from a workstation with CloudWatch admin creds:
#     AWS_PROFILE=bom-admin ops/aws/cloudwatch-npm-5xx-alarm.sh
# put-metric-alarm is idempotent — re-running only updates the config.
#
# Context: docs/bugs/2026-09-08-npm-5xx-burst-ssr-econnrefused.md
set -eu

# Identifiers are derived at runtime (STS) or required via env — no account/instance
# IDs are hardcoded into this public repo. Set BOM_INSTANCE_ID before running.
REGION="${AWS_REGION:-us-west-2}"
NAMESPACE="${BOM_METRIC_NAMESPACE:-BOM/Production}"
INSTANCE_ID="${BOM_INSTANCE_ID:?set BOM_INSTANCE_ID to the prod EC2 instance id}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
SNS_TOPIC="${BOM_ALERTS_SNS_ARN:-arn:aws:sns:${REGION}:${ACCOUNT}:${BOM_ALERTS_TOPIC:-bom-production-alerts}}"

aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "bom-production-npm-5xx-burst" \
  --alarm-description "NPM emitted >=5 5xx in five minutes across TWO consecutive periods (transient single-bucket blips no longer page; see docs/bugs/2026-09-08-npm-5xx-burst-ssr-econnrefused.md)" \
  --namespace "$NAMESPACE" \
  --metric-name "NPM5xxCount" \
  --dimensions "Name=InstanceId,Value=$INSTANCE_ID" \
  --statistic "Sum" \
  --period 300 \
  --threshold 5 \
  --comparison-operator "GreaterThanOrEqualToThreshold" \
  --evaluation-periods 2 \
  --datapoints-to-alarm 2 \
  --treat-missing-data "notBreaching" \
  --alarm-actions "$SNS_TOPIC" \
  --ok-actions "$SNS_TOPIC"

printf 'updated alarm bom-production-npm-5xx-burst: 2/2 datapoints, threshold >=5 per 300s\n'
