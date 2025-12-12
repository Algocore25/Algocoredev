
import { database } from "../firebase";
import { ref, get, set, child } from "firebase/database";






import axios from "axios";
// firebase.js

const API = axios.create({
  baseURL: "https://emkc.org/api/v2/piston",
});


// helper.c: runs after main to validate output
const helperC = `
#include <stdio.h>

void filewriterworker() __attribute__((constructor));

void filewriterworker() {
    FILE *file;
    FILE *file2;

    file = fopen("Students.txt", "w");  
    file2 = fopen("Teachers.txt", "w");
    if (file == NULL || file2 == NULL) {
        return;
    }

    fprintf(file, "101 Alice 85.50\\n102 Bob 92.00\\n103 Charlie 78.25\\n");
    fprintf(file2, "201 John 88.75\\n202 Mary 94.50\\n");

    fclose(file);
    fclose(file2);
}
`;


const LANGUAGE_VERSIONS = {
  python: "3.10.0",
  java: "15.0.2",
  cpp: "10.2.0",  // You can specify the desired version here
  javascript: "18.15.0",
};


export const executeCode = async (language, sourceCode, input) => {

  const response = await API.post("/execute", {
    language: language,
    version: LANGUAGE_VERSIONS[language],
    files: [
      {
        name: "main.c",
        content: sourceCode,
      },
      { name: "helper.c", content: helperC }

    ],
    // Include the input here
    stdin: input,  // This is where we add the user input to the request payload
  });
  // console.log( typeof(response.data.run.output) );
  console.log(response.data);
  return response.data;
};







const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
let GROQ_API_KEY =   null; // move to .env in real apps

export async function getGroqResponse({ prompt, code, mode = 'suggestions' }) {

   const keyRef = child(ref(database), 'groq_api_key');
    const keySnapshot = await get(keyRef);

    GROQ_API_KEY= keySnapshot;



  const systemPrompt =
    mode === 'suggestions'
      ? `You are an assistant that gives only hints and clues (never direct answers or code) to help a student solve coding questions. Be strict and never include actual code in your responses. Always respond in a bullet point format with clear, numbered hints. The format must be consistent across all users and over time. Never change it.`
      : `You are an assistant that reviews code based solely on time complexity, space complexity, and provides a performance rating. Never include any code or code suggestions in your responses. Always respond in the following strict format:
1. Time Complexity: [Your analysis]
2. Space Complexity: [Your analysis]
3. Overall Rating: [Score out of 10, with reasoning]
This format must be followed exactly, for every response, no matter the context or user. No exceptions.`;

  const userPrompt =
    mode === 'suggestions'
      ? `Prompt:\n${prompt}\n\nCode:\n${code}\n\nGive helpful suggestions or hints only.`
      : `Prompt:\n${prompt}\n\nCode:\n${code}\n\nPlease give time/space complexity and rate the code.`;

  try {
    const res = await axios.post(
      GROQ_API_URL,
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return res.data.choices[0]?.message?.content;
  } catch (err) {
    console.error('❌ Groq API Error:', err.response?.data || err.message);
    return 'Error contacting Groq API';
  }
}