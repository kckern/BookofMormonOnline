
const axios = require('axios');

require('dotenv').config()

async function GPT4(messages) {
  console.log("GPT4")
    try {
        let data = JSON.stringify({
            model: ( "gpt-4" ),
            messages
        });

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://api.openai.com/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            data: data
        };
        return await axios(config)
        .then(function (response) {
          //  console.log(JSON.stringify(response.data));
            let output = response?.data?.choices?.[0]?.message?.content || false;
            return output
        })
        .catch(function (error) {
          console.error(error.message);
          console.error(error.response?.data?.error);
          //  console.log(error, 'error in calling chat completion');
          return false;
        });
    } catch (e) {

    console.error(e.message);
       // console.log(e, ' error in the callChatGTP function')
          return false;
    }
}


async function GPT35Turbo(messages) {
  messages = messages.map((message) => {
    return { ...message, content: message.content?.substring(0, 2048) };
  });
  try {
    const data = {
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
      max_tokens: 896,
      n: 1
    };

    const config = {
      method: 'post',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      data: data
    };

    const response = await axios(config);
    const output = response?.data?.choices?.[0]?.message?.content || false;
    return output;
  } catch (error) {
    console.error(error.message);
    return false;
  }
}



const askGPT = async (instructions, input, model, attempt) => {
    
    model = model || "gpt-4";
    attempt = attempt || 1;
    if (attempt > 1) console.log(`Attempt ${attempt}...`);
    if (attempt > 4) {
      console.log("Failed to get answers from GPT");
      process.exit();
      return false;
    }
  
    let messages = [
      { role: "system", content: instructions }
    ];

    if(Array.isArray(input)) messages = [...messages, ...input];
    else messages.push({role: "user", content: input});
  

    const gptPromise = (model==="gpt-4") ? GPT4(messages) : GPT35Turbo(messages);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("GPT request timed out"));
      }, 120000);
    });
  
    let response;
    try {
      response = await Promise.race([gptPromise, timeoutPromise]);
    } catch (err) {
      console.error(err);
      return askGPT(instructions, input,  model, attempt + 1);
    }
  
    if (!response) return askGPT(instructions, input,  model, attempt + 1);
  
    return response;
  };



module.exports = {GPT4, askGPT};