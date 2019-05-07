# digital-lambda
Lambda functions for the Digital team

These play a small but vital part of our deployment and cluster management. We
don’t do too much active development on them, so there’s not a whole lot going
on in the repo.

Configuration is done by synching the `cob-digital-lambda-config` bucket into
the repo before bundling up the lambda functions.

### slack/post-cloudformation-deploy

Posts to Slack on the status of CloudFormation deployments.

(Deprecated)

### slack/post-cloudwatch-alarm

Posts to Slack when CloudWatch alarms go off or resolve.

### instance-drain

Drains ECS services from EC2 instances before letting them restart. Adapted from
[How to Automate Container Instance Draining in Amazon
ECS](https://aws.amazon.com/blogs/compute/how-to-automate-container-instance-draining-in-amazon-ecs/)
