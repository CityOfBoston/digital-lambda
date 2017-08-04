const postMessage = require('./slack-helpers').postMessage;

const hookUrl = process.env.SLACK_WEBHOOK_URL;
const channel = process.env.SLACK_CHANNEL;

function processEvent(event, callback) {
  const snsRecord = event.Records[0].Sns;
  const subject = snsRecord.Subject;

  const slackMessage = {
    channel: channel,
    text: `${subject}`,
  };

  postMessage(hookUrl, slackMessage, (response) => {
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
  processEvent(event, callback);
};
