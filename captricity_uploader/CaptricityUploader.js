// dependencies
var async = require('async');
var request = require('request');
var AWS = require('aws-sdk');
var util = require('util');
var fs = require('fs');

// get reference to S3 client
var s3 = new AWS.S3();

// Insert Captricity API Token
var auth_headers = {
    'User-Agent': 'CaptricityLambdaUploader',
    'Captricity-API-Token': ''
};

exports.handler = function (event, context) {
    // Read options from the event.
    console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));
    var srcBucket = event.Records[0].s3.bucket.name;
    // Object key may have spaces or unicode non-ASCII characters.
    var srcKey =
        decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

    var typeMatch = srcKey.match(/\.([^.]*)$/);
    if (!typeMatch) {
        console.error('unable to infer image type for key ' + srcKey);
        return;
    }
    var imageType = typeMatch[1];
    if (imageType != "jpg" && imageType != "png" && imageType != "pdf" && imageType != "tif") {
        console.log('skipping non-image ' + srcKey);
        return;
    }
    var batchId = null;

    async.waterfall([ // get the Batches with status=setup
        function getBatches(next) {
            request({
                    url: 'https://shreddr.captricity.com/api/v1/batch/?status=setup',
                    headers: auth_headers,
                    method: "GET",
                    json: true
                },
                function (error, response, body) {
                    next(null, body);
                });
        },
        function useExistingOrCreateNewBatch(batches, next) {
            if (batches.length > 0) { // if there is a setup batch, use that one
                next(null, batches[0]);
            } else { // else create a new batch to use
                var dateAndTime = new Date().toISOString();
                request({
                        url: 'https://shreddr.captricity.com/api/v1/batch/',
                        headers: auth_headers,
                        method: "POST",
                        form: {name: 'AWSLambdaBatch ' + dateAndTime},
                        json: true
                    },
                    function (error, response, body) {
                        next(null, body);
                });
            }
        },
        function download(batch, next) {
            batchId = batch.id;
            // Download the image from S3
            s3.getObject({
                    Bucket: srcBucket,
                    Key: srcKey
                },
                next);
        },
        function uploadImageToBatch(response, next) {

            console.log("Uploading image " + srcKey + " to batch " + batchId);

            var url = 'https://shreddr.captricity.com/api/v1/batch/' + batchId + '/batch-file/';

            // write the s3 object into a temp file
            var file = fs.createWriteStream("/tmp/" + srcKey);
            file.write(response.Body, function () {

                // when it's done writing, open it back up for upload
                var readStream = fs.createReadStream("/tmp/" + srcKey);
                readStream.on('open', function (fd) {

                    // upload the image to the BatchFile API
                    request.post({
                            url: url,
                            headers: auth_headers,
                            formData: {uploaded_file: readStream},
                            json: true
                        },
                        function (error, response, body) {
                            if (error) {
                                next(error);
                            } else {
                                if (body.hasOwnProperty('errors')) {
                                    console.log(body);
                                    next(body.errors, null)
                                }
                                next(null, body);
                            }
                        });
                })
            });
        }],
        function (err, body) {
            if (err) {
                console.error(
                    'Unable to upload ' + srcBucket + '/' + srcKey +
                    ' due to an error: ' + err.BatchFileForm.uploaded_file
                );
            } else {
                console.log(
                    'Successfully uploaded ' + srcBucket + '/' + srcKey +
                    ' to batch ' + batchId + ' and batch file ' + body.id
                );
                context.done();
            }
            // clean up the temp img file
            fs.unlink('/tmp/' + srcKey);
        }
    );
};