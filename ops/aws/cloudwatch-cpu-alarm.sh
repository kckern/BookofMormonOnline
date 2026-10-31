#!/bin/sh
# (Re)create the prod sustained-CPU alarm. The t3a.medium runs in `unlimited` credit
# mode, so a CPU spin never throttles — it just keeps the site slow and bills surplus
# credits. On 2026-10-30 a week at 100% CPU (stuck `docker logs` readers spinning
# dockerd) went unnoticed because no alarm covered CPU. AWS/EC2 CPUUtilization is
# published natively (no agent), so this works even when the box's own metrics
# publisher is starved.
#
# The instance role can PutMetricData but NOT PutMetricAlarm: run from a workstation
# with CloudWatch admin creds. Idempotent. No identifiers hardcoded (public repo).
#     BOM_INSTANCE_ID=i-xxxxxxxx ops/aws/cloudwatch-cpu-alarm.sh
set -eu

REGION="${AWS_REGION:-us-west-2}"
INSTANCE_ID="${BOM_INSTANCE_ID:?set BOM_INSTANCE_ID to the prod EC2 instance id}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
SNS_TOPIC="${BOM_ALERTS_SNS_ARN:-arn:aws:sns:${REGION}:${ACCOUNT}:${BOM_ALERTS_TOPIC:-bom-production-alerts}}"

# 6 of 6 five-minute datapoints >= 90% = 30 min sustained; crawler bursts are shorter.
aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "bom-production-cpu-sustained" \
  --alarm-description "Prod EC2 CPU >=90% for 30 min. Unlimited-credit mode never throttles, so this means slow pages plus surplus-credit charges. Check: dockerd CPU, orphaned 'docker logs' CLIs, crawler SSR." \
  --namespace "AWS/EC2" \
  --metric-name "CPUUtilization" \
  --dimensions "Name=InstanceId,Value=$INSTANCE_ID" \
  --statistic "Average" \
  --period 300 \
  --threshold 90 \
  --comparison-operator "GreaterThanOrEqualToThreshold" \
  --evaluation-periods 6 \
  --datapoints-to-alarm 6 \
  --treat-missing-data "notBreaching" \
  --alarm-actions "$SNS_TOPIC" \
  --ok-actions "$SNS_TOPIC"

printf 'updated alarm bom-production-cpu-sustained: CPUUtilization>=90%% x6/5min -> %s\n' "$SNS_TOPIC"

# Credit headroom. In unlimited mode, surplus credits are billed once the balance exceeds
# what the instance earns in 24 h (288 for a t3a.medium). Warn at 260 so there is time to
# act (kill a runaway, tighten crawler limits) before any charge. Steady load under the 20%
# baseline makes this balance fall; a rise means sustained load above baseline.
aws cloudwatch put-metric-alarm \
  --region "$REGION" \
  --alarm-name "bom-production-cpu-surplus-credits" \
  --alarm-description "Surplus CPU credits >=260 (billing starts above 288 = 24 h of earned credits). Sustained load is above the 20% baseline: find what is eating CPU before it is billed." \
  --namespace "AWS/EC2" \
  --metric-name "CPUSurplusCreditBalance" \
  --dimensions "Name=InstanceId,Value=$INSTANCE_ID" \
  --statistic "Maximum" \
  --period 300 \
  --threshold 260 \
  --comparison-operator "GreaterThanOrEqualToThreshold" \
  --evaluation-periods 2 \
  --datapoints-to-alarm 2 \
  --treat-missing-data "notBreaching" \
  --alarm-actions "$SNS_TOPIC" \
  --ok-actions "$SNS_TOPIC"

printf 'updated alarm bom-production-cpu-surplus-credits: CPUSurplusCreditBalance>=260 x2/5min -> %s\n' "$SNS_TOPIC"
