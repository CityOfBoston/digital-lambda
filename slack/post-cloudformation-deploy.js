'use strict'

const fs = require('fs');
const path = require('path');

const postMessage = require('./slack-helpers').postMessage;

let config;

/*
Message:

StackId='arn:aws:cloudformation:us-east-1:166088413922:stack/DigitalAppsLambda-Deploy/fe44f990-792a-11e7-9b6a-50fae984a035'
Timestamp='2017-08-08T17:36:34.381Z'
EventId='CloudFormationDeployFunction-UPDATE_COMPLETE-2017-08-08T17:36:34.381Z'
LogicalResourceId='CloudFormationDeployFunction'
Namespace='166088413922'
PhysicalResourceId='DigitalAppsLambda-CloudFormationDeployFunction'
ResourceProperties='
{
    "Role": "arn:aws:iam::166088413922:role/DigitalAppsLambda-LambdaExecutionRole-1LQY2ILD5B37G",
    "FunctionName": "DigitalAppsLambda-CloudFormationDeployFunction",
    "Runtime": "nodejs6.10",
    "Description": "Function to notify Slack when a CloudFormation deploy completes",
    "Handler": "post-cloudformation-deploy.handler",
    "Code": {
        "S3Bucket": "digitalappslambda-packagedlambdafunctionsbucket-108kab9jtcsbx",
        "S3Key": "554cbb5eef69abc1301389ea11feeced"
    },
    "Tags": [
        {
            "Value": "SAM",
            "Key": "lambda:createdBy"
        }
    ]
}

'
ResourceStatus='UPDATE_COMPLETE'
ResourceStatusReason=''
ResourceType='AWS::Lambda::Function'
StackName='DigitalAppsLambda-Deploy'
ClientRequestToken='null'
*/


function parseCloudFormationMessage(message) {
  console.log("MESSAGE", message);

  // matches e.g. LogicalResourceId='DigitalApps-311Indexer-DeployPipeline-17SDBA13ADM41'
  // has to be multiline due to embedded JSON 
  const re = /^([^=]*)='([^']*)'$/gm;
  const out = {};

  let match;
  while ((match = re.exec(message)) !== null) {
    out[match[1]] = out[match[2]];
  }

  console.log("MATCHES", out)

  return out;
}

function processEvent(event, callback) {
  const snsRecord = event.Records[0].Sns;
  const subject = snsRecord.Subject;

  const message = parseCloudFormationMessage(snsRecord.Message);

  if (message.StackName !== message.LogicalResourceId) {
    console.info('Skipping message for LogicalResourceId ' + message.LogicalResourceId);
    callback(null);
  }

  const slackMessage = {
    channel: config.DEPLOY_SLACK_CHANNEL,
    text: `${message.StackName}: ${message.ResourceStatus}`,
  };

  postMessage(config.DEPLOY_SLACK_WEBHOOK_URL, slackMessage, (response) => {
    if (response.statusCode < 400) {
      console.info('Message posted successfully');
      callback(null);
    } else if (response.statusCode < 500) {
      console.error(`Error posting message to Slack API: ${response.statusCode} - ${response.statusMessage}`);
      callback(null);  // Don't retry because the error is due to a problem with the request
    } else {
      // Let Lambda retry
      callback(`Server error when processing message: ${response.statusCode} - ${response.statusMessage}`);
    }
  });
}

exports.handler = (event, context, callback) => {
  // config might be still populated from a previous run, so we only load from disk if necessary
  if (!config) {
    fs.readFile(path.resolve(__dirname, 'config.json'), (err, data) => {
      if (err) {
        throw err;
      }

      config = JSON.parse(data);

      processEvent(event, callback);
    });
  } else {
    processEvent(event, callback);
  }
};
