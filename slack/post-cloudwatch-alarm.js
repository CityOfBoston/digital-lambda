'use strict';

const fs = require('fs');
const path = require('path');

const postMessage = require('./slack-helpers').postMessage;

const STATE_COLORS = {
  ALARM: 'danger',
  OK: 'good',
  INSUFFICIENT_DATA: 'warning',
};

let config;

/*
{
  "AlarmName": "DigitalApps-311Indexer near memory limit",
  "AlarmDescription": "Average memory usage for this service is high",
  "AWSAccountId": "166088413922",
  "NewStateValue": "ALARM",
  "NewStateReason": "Threshold Crossed: 5 datapoints were greater than the threshold (10.0). The most recent datapoints which crossed the threshold: [27.5 (08/08/17 20:09:00), 27.5 (08/08/17 20:08:00), 27.5 (08/08/17 20:07:00), 27.5 (08/08/17 20:06:00), 27.5 (08/08/17 20:05:00)].",
  "StateChangeTime": "2017-08-08T20:11:21.564+0000",
  "Region": "US East (N. Virginia)",
  "OldStateValue": "OK",
  "Trigger": {
    "MetricName": "MemoryUtilization",
    "Namespace": "AWS/ECS",
    "StatisticType": "Statistic",
    "Statistic": "AVERAGE",
    "Unit": null,
    "Dimensions": [
      {
        "name": "ClusterName",
        "value": "DigitalAppsCluster"
      },
      {
        "name": "ServiceName",
        "value": "DigitalApps-311Indexer"
      }
    ],
    "Period": 60,
    "EvaluationPeriods": 5,
    "ComparisonOperator": "GreaterThanThreshold",
    "Threshold": 10,
    "TreatMissingData": "",
    "EvaluateLowSampleCountPercentile": ""
  }
}
*/

function makeAlarmUrl(alarmName) {
  return `https://console.aws.amazon.com/cloudwatch/home?region=${process.env
    .AWS_REGION}#s=Alarms&alarm=${encodeURIComponent(alarmName)}`;
}

function parseCloudWatchMessage(message) {
  return JSON.parse(message);
}

function processEvent(event, callback) {
  const snsRecord = event.Records[0].Sns;
  const message = parseCloudWatchMessage(snsRecord.Message);
  console.info('Parsed message', message);

  const alarmUrl = makeAlarmUrl(message.AlarmName);

  const slackMessage = {
    attachments: [
      {
        color: STATE_COLORS[message.NewStateValue],
        title: `<${alarmUrl}|${message.AlarmName}> is ${message.NewStateValue}`,
        text:
          message.NewStateValue === 'ALARM'
            ? `${message.AlarmDescription}\n\n${message.NewStateReason}`
            : '',
        footer: 'CloudWatch',
        footer_icon:
          'https://s3.amazonaws.com/cloudwatch-console-static-content-s3/1.0/images/favicon.ico',
        ts: Math.floor(+new Date(message.StateChangeTime) / 1000),
      },
    ],
  };

  postMessage(config.ALERTS_SLACK_WEBHOOK_URL, slackMessage, response => {
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
