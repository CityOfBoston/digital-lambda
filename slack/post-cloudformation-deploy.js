'use strict'

const fs = require('fs');
const path = require('path');

const postMessage = require('./slack-helpers').postMessage;

let config;

function processEvent(event, callback) {
  const snsRecord = event.Records[0].Sns;
  const subject = snsRecord.Subject;

  const slackMessage = {
    channel: config.DEPLOY_SLACK_CHANNEL,
    text: `${subject}`,
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
  if (!config) {
    fs.readFile(path.resolve(__dirname, 'config.json'), (err, data) => {
      if (err) {
        throw err;
      }

      config = JSON.parse(data);
      console.log("LOADED CONFIG", config);

      processEvent(event, callback);
    });
  } else {
    processEvent(event, callback);
  }
};
