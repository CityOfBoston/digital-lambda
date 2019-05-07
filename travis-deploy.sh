#!/bin/bash

set -e
set -x

aws s3 sync "s3://${CONFIG_BUCKET_NAME}/" .

pushd slack
zip -v lambda.zip -r *

aws lambda update-function-code \
  --function-name AppsLambdaPipeline-CloudWatchAlarmFunction \
  --zip-file fileb://lambda.zip
popd

pushd instance-drain
pip install -r requirements.txt -t .
zip -v lambda.zip -r *

aws lambda update-function-code \
  --function-name AppsLambdaPipeline-EcsInstanceDrainFunction \
  --zip-file fileb://lambda.zip
popd
