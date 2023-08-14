import axios  from 'axios';

//FB - BoMOnline - 182180
//TW - BoMOnline - 182181
//IG - BoMOnline - 1260047

//FB - KRBoM - 
//TW - KRBoM - 
//IG - KRBoM - 



export const schedulePost = async(timeToSend,bodyText)=>{
   

var data = {
    post: {
        //  id:2169370,
        body: bodyText,
        networks: [
            {
                id: 182180
            },
            {
                id: 182181
            }
        ],
        category_id: 8326,
        sent_time: timeToSend,
        attachments: [
           //{ id: 1260079 }
        ],
        timezone: {
            id: "Asia/Seoul",
            offset: 32400
        },
        user: {
            id: 124861
        },
        short_link: false
    },
    publish: true
}

const cookie = "eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.eyJzdWIiOiIxMjQ4NjEiLCJzaWQiOjMwNjk2OSwic2VjcmV0IjoiLTQzODYxMDY3OTA1NzQzODIwNTgiLCJleHAiOjE5NjM5Njk2MzQuODg5NDI5fQ.03VPd5UJDZ7fbtoJUSP4o_m-64NqWko6uXQJAIORe2__XsAVTNr52ORsDkumP4MtFgtdZzv4Dt3-FfWBEFmXAA";



var config = {
    method: 'post',
    url: 'https://postoplan.com/oapi/v1/130136/posts/publish',
    headers: {
        'api-js-client': '1',
        'cookie': `user_jwt=${cookie}`
    },
    data: data
};

return axios(config)
    .then(function (response) {
      //  console.log(response.data);
        return response.data;
    })
    .catch(function (error) {
        console.log(error);
        return false;
    });
 
}