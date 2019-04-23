#!/bin/bash

set -e
set -x

aws s3 sync "s3://${CONFIG_BUCKET_NAME}/" .

pushd js
zip -v ../js.zip -r *
popd

pushd python
pip install -r requirements.txt -t .
zip -v ../python.zip -r *
popd

aws lambda update-function-code \
  --function-name AppsLambdaPipeline-CloudFormationDeployFunction \
  --zip-file fileb://js.zip

aws lambda update-function-code \
  --function-name AppsLambdaPipeline-CloudWatchAlarmFunction \
  --zip-file fileb://js.zip

aws lambda update-function-code \
  --function-name AppsLambdaPipeline-EcsInstanceDrainFunction \
  --zip-file fileb://python.zip
