import axios from 'axios';
import smartquotes from 'smartquotes';
import 'dotenv/config';

interface GPTMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface GPTResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

async function GPT4(messages: GPTMessage[]): Promise<string | false> {
  console.log("GPT4");
  try {
    const data = {
      model: "gpt-4",
      messages
    };

    const config = {
      method: 'post' as const,
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
        const output = response?.data?.choices?.[0]?.message?.content || false;
        return output;
      })
      .catch(function (error) {
        console.error(error.message);
        console.error(error.response?.data?.error);
        return false;
      });
  } catch (e: any) {
    console.error(e.message);
    return false;
  }
}

async function GPT35Turbo(messages: GPTMessage[]): Promise<string | false> {
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
      method: 'post' as const,
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
  } catch (error: any) {
    console.error(error.message);
    return false;
  }
}

const askGPT = async (
  instructions: string, 
  input: string | GPTMessage[], 
  model: string = "gpt-4", 
  attempt: number = 1
): Promise<string | false> => {
  
  if (!input) return false;
    
  if (attempt > 1) console.log(`Attempt ${attempt}...`);
  if (attempt > 4) {
    console.log("Failed to get answers from GPT");
    process.exit();
    return false;
  }

  let messages: GPTMessage[] = [
    { role: "system", content: instructions }
  ];

  if (Array.isArray(input)) {
    messages = [...messages, ...input];
  } else {
    messages.push({ role: "user", content: input });
  }

  const gptPromise = (model === "gpt-4") ? GPT4(messages) : GPT35Turbo(messages);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("GPT request timed out"));
    }, 120000);
  });

  let response: string | false;
  try {
    response = await Promise.race([gptPromise, timeoutPromise]);
  } catch (err) {
    console.error(err);
    return askGPT(instructions, input, model, attempt + 1);
  }

  if (!response) return askGPT(instructions, input, model, attempt + 1);
  return smartquotes(response);
};

export { GPT4, askGPT };
export default { GPT4, askGPT };
