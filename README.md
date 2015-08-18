

# Captricity AWS S3 & Lambda Uploader

This is a reference project for integrating Amazon Web Services S3 to Captricity using Lambda. The project:

* Shows a sample AWS Lambda node.js file `CaptricityUploader.js`
* Provides instructions on deploying this file with AWS Lambda

## Deployment
1 Configure awscli locally

    mkvirtualenv aws_cli
    workon aws_cli
    pip install awscli
    aws configure

[More Detailed Instructions](http://docs.aws.amazon.com/lambda/latest/dg/walkthrough-custom-events-deploy.html)

2 Install [node.js and npm](https://docs.npmjs.com/getting-started/installing-node)

3 Change directory to captricity_uploader

    cd captricity_uploader;

4 Install node dependencies

    npm install async request

5 Update `CaptricityUploader.js` with your Captricity API Token

6 Create a zip of the package for AWSLambda

    zip -r CaptricityUploader.zip captricity_uploader/

7 In the AWS IAM console create an AWS Lambda role with AWSLambdaExexcute policy and save the arn

For the following commands, replacing \<info needed\> boxes with your information

8 Upload your lambda function

    aws lambda create-function \
    --region <your Lambda region> \
    --function-name CaptricityUploader \
    --zip-file fileb://CaptricityUploader.zip \
    --role <your Lambda arn> \
    --handler CaptricityUploader.handler \
    --runtime nodejs \
    --timeout 20 \
    --memory-size 1024

9 Locally invoke your AWS Lambda function

Upload an image file to your S3 bucket and replace the \<need info\> values in `test_input.txt`

Run to test:

    aws lambda invoke \
    --invocation-type Event \
    --function-name CaptricityUploader \
    --region <your Lambda region> \
    --payload file://test_input.txt \

10 Update your AWS permissions so that s3 can invoke CaptricityUploader

    aws lambda add-permission \
    --function-name CaptricityUploader \
    --region <your Lambda region> \
    --statement-id <a unique id> \
    --action "lambda:InvokeFunction" \
    --principal s3.amazonaws.com \
    --source-arn <your Lambda arn> \
    --source-account <your 12 digit aws account id>

11 In your S3 bucket properties add CaptricityUploader to the `Events` for ObjectCreated (All)

## Updating the deployed code

1 Create a new zip for deployment

2 Run an update command

    aws lambda update-function-code \
    --region <your Lambda region> \
    --function-name CaptricityUploader \
    --zip-file fileb://CaptricityUploader.zip

## Run locally

    npm install lambda-local aws-sdk

Then run:

    lambda-local -l CaptricityUploader.js -h handler -e test_input.js -t 20

