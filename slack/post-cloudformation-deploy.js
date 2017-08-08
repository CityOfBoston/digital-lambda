'use strict';

const fs = require('fs');
const path = require('path');

const postMessage = require('./slack-helpers').postMessage;

// The status of the resource, which can be one of the following status codes:
// CREATE_COMPLETE | CREATE_FAILED | CREATE_IN_PROGRESS | DELETE_COMPLETE |
// DELETE_FAILED | DELETE_IN_PROGRESS | DELETE_SKIPPED | UPDATE_COMPLETE |
// UPDATE_FAILED | UPDATE_IN_PROGRESS.

const STATUS_MESSAGES = {
  CREATE_IN_PROGRESS: 'Starting create…',
  CREATE_COMPLETE: 'Create successful!',
  CREATE_FAILED: 'Failure creating resource',

  UPDATE_IN_PROGRESS: 'Starting update…',
  UPDATE_COMPLETE: 'Update successful!',
  UPDATE_FAILED: 'Failure updating resource',
  UPDATE_ROLLBACK_IN_PROGRESS: 'Starting rollback…',
  UPDATE_ROLLBACK_COMPLETE: 'Rollback complete.',

  DELETE_IN_PROGRESS: 'Starting delete…',
  DELETE_COMPLETE: 'Delete successful!',
  DELETE_FAILED: 'Failure deleting resource',
};

const STATUS_COLORS = {
  CREATE_IN_PROGRESS: 'warning',
  CREATE_COMPLETE: 'good',
  CREATE_FAILED: 'danger',

  UPDATE_IN_PROGRESS: 'warning',
  UPDATE_COMPLETE: 'good',
  UPDATE_FAILED: 'danger',
  UPDATE_ROLLBACK_IN_PROGRESS: 'warning',
  UPDATE_ROLLBACK_IN_COMPLETE: 'good',

  DELETE_IN_PROGRESS: 'warning',
  DELETE_COMPLETE: 'good',
  DELETE_FAILED: 'danger',
};

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

function makeStackUrl(stackArn) {
  return `https://console.aws.amazon.com/cloudformation/home?region=${process
    .env.AWS_REGION}#/stack/detail?stackId=${encodeURIComponent(stackArn)}`;
}

function parseCloudFormationMessage(message) {
  // matches e.g. LogicalResourceId='DigitalApps-311Indexer-DeployPipeline-17SDBA13ADM41'
  // has to be multiline due to embedded JSON
  const re = /^([^=]*)='([^']*)'$/gm;
  const out = {};

  let match;
  while ((match = re.exec(message)) !== null) {
    out[match[1]] = match[2];
  }

  return out;
}

function processEvent(event, callback) {
  const snsRecord = event.Records[0].Sns;
  const message = parseCloudFormationMessage(snsRecord.Message);

  console.info('Parsed message', message);

  const stackUrl = makeStackUrl(message.StackId);

  const aboutOurStack = message.LogicalResourceId === message.StackName;
  const isFailure = message.ResourceStatus.endsWith('_FAILED');
  const textExists = STATUS_MESSAGES[message.ResourceStatus];

  const shouldDisplayMessage = textExists && (aboutOurStack || isFailure);

  if (!shouldDisplayMessage) {
    console.info(
      `Skipping ${message.ResourceStatus} message for LogicalResourceId ${message.LogicalResourceId}`
    );
    callback(null);
    return;
  }

  console.info(
    `Posting ${message.ResourceStatus} message for LogicalResourceId ${message.LogicalResourceId}`
  );

  const slackMessage = {
    // text: `<${stackUrl}|${message.StackName}>: ${message.ResourceStatus}`,
    attachments: [
      {
        color: STATUS_COLORS[message.ResourceStatus] || '#ccc',
        title: `<${stackUrl}|${message.StackName}>: ${STATUS_MESSAGES[
          message.ResourceStatus
        ]}`,
        text:
          message.ResourceStatus === 'UPDATE_IN_PROGRESS'
            ? ''
            : message.ResourceStatusReason,
        footer: 'CloudFormation',
        footer_icon:
          'https://www.shareicon.net/data/2015/08/28/92219_copy_512x512.png',
        ts: Math.floor(+new Date(message.Timestamp) / 1000),
      },
    ],
  };

  postMessage(config.DEPLOY_SLACK_WEBHOOK_URL, slackMessage, response => {
    if (response.statusCode < 400) {
      console.info('Message posted successfully');
      callback(null);
    } else if (response.statusCode < 500) {
      console.error(
        `Error posting message to Slack API: ${response.statusCode} - ${response.statusMessage}`
      );
      callback(null); // Don't retry because the error is due to a problem with the request
    } else {
      // Let Lambda retry
      callback(
        `Server error when processing message: ${response.statusCode} - ${response.statusMessage}`
      );
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
