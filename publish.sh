#!/bin/bash
rm index.zip
cd lambda
zip -r ../index.zip index.js node_modules/alexa-sdk node_modules/i18next node_modules/i18next-sprintf-postprocessor
cd ..
aws lambda update-function-code --function-name SimpleButton1 --zip-file fileb://index.zip
