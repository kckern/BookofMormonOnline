var axios = require('axios');
var FormData = require('form-data');
var fs = require('fs');

const token = `eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.eyJzdWIiOiIxMjQ4NjEiLCJzaWQiOjMwNjk2OSwic2VjcmV0IjoiLTQzODYxMDY3OTA1NzQzODIwNTgiLCJleHAiOjE5NjM5Njk2MzQuODg5NDI5fQ.03VPd5UJDZ7fbtoJUSP4o_m-64NqWko6uXQJAIORe2__XsAVTNr52ORsDkumP4MtFgtdZzv4Dt3-FfWBEFmXAA`;
const file = "/Users/kckern/Desktop/map.jpg";

var form = new FormData();
form.append('file', fs.createReadStream(file));

const options = {
    method: 'POST',
    url: 'https://postoplan.com/oapi/v1/media/upload',
    headers: {
        'api-js-client': '1',
        cookie: `user_jwt=${token}`,
        ...form.getHeaders()
    }
};

axios.post(options.url, form, options).then(function (response) {
    console.log(response.data);
}).catch(function (error) {
    console.error(error);
});
