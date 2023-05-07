// Import required packages
const { Configuration, OpenAIApi } = require("openai");
const dotenv = require("dotenv");
const fs = require("fs");
const slugify = require("slugify");
// @todo: use langchain: this will be a game changer

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
// Load the API key from the .env file
dotenv.config();

const openai = new OpenAIApi(configuration);

// Load properties from the settings.json file
let properties = JSON.parse(fs.readFileSync("settings.json", "utf-8"));

const defaultProps = {
    type: "Course",
    task: "Blog Article Writing",
    tone: "Passionate and Urgent",
    length: "Medium",
    domain: "Next.js",
    topic: "Getting started with Next.js: A beginner's guide",
    lang: "English",
    skill: "Intermediate",
    numArticles: 3
  };

  properties = { ...defaultProps, ...properties };

const usedSubjects = new Set();

async function readSubjectsFromFiles() {
  const directory = "content/posts";
  const files = fs.readdirSync(directory);

  files.forEach((file) => {
    if (file.endsWith(".mdx")) {
      const content = fs.readFileSync(`${directory}/${file}`, "utf-8");
      const descriptionMatch = content.match(/^description:\s*(.+)$/m);

      if (descriptionMatch) {
        usedSubjects.add(descriptionMatch[1]);
      }
    }
  });
}

async function generateCoverImageUrl(keyword, accessKey) {
    const response = await fetch(`https://api.unsplash.com/photos/random?query=${keyword}&client_id=${accessKey}`);
    const data = await response.json();
    return data.urls.regular;
  }

async function generateTitle(domain) {
  const prompt = `Generate a blog article title for the domain: ${domain}. Don't use the following characters: ":;{}[]()<>\/"`;
  const response = await openai.createCompletion({
    model: "text-davinci-003",
    max_tokens: 64,
    prompt,
    temperature: 0.8
  });

  return response.data.choices[0].text.trim();
}

async function generateSubject(domain) {
  const prompt = `Generate a blog article subject for the domain: ${domain}. Avoid these subjects: ${Array.from(usedSubjects).join(", ")}. Don't use the following characters :;{}[]()<>\"'`;
  const response = await openai.createCompletion({
    model: "text-davinci-003",
    max_tokens: 512,
    prompt,
    temperature: 0.7
  });

  return response.data.choices[0].text.trim();
}

async function generateUniqueSubject(domain) {
  let subject;
  do {
    subject = await generateSubject(domain);
  } while (usedSubjects.has(subject));
  usedSubjects.add(subject);
  return subject;
}

async function generateArticle(properties) {

  let promptParts = [
    properties.type,
    properties.task,
    properties.tone,
    properties.length,
    `on ${properties.domain}`,
    `with the topic ${properties.topic}`,
    `writing in ${properties.lang}`,
    `to an audience with ${properties.skill} skill level`,
    `Provide code examples where applicable`,
    `include official references to ${properties.topic} with a link if applicable`,
    `include a cover image from ${properties.imgUrl} as a centered cover image`,
    `use markdown syntax`
  ];

  const filteredPromptParts = promptParts.filter((part) => part.trim() !== "");
  const prompt = "Write a " + filteredPromptParts.join(", ") + ".";
  const response = await openai.createCompletion({
    model: "text-davinci-003",
    max_tokens: 2048,
    prompt,
    temperature: 0.7
  });

  return response.data.choices[0].text.trim();
}

async function saveArticle(title, subject, content) {
  const slug = slugify(title, { lower: true, strict: true });
  const fileName = `content/posts/${slug}.mdx`;

  const currentDate = new Date().toISOString().slice(0, 10);

  const articleContent = `---
title: ${title}
date: "${currentDate}"
description: ${subject}
---
${content}`;

  fs.writeFileSync(fileName, articleContent);
  console.log(`Saved article: ${fileName}`);
}

(async () => {
  await readSubjectsFromFiles();

  const numArticles = parseInt(properties.numArticles);

  for (let i = 0; i < numArticles; i++) {
    const domain = properties.domain;
    const title = await generateTitle(domain);
    console.log("Generated Title:", title);

    const subject = await generateUniqueSubject(domain);
    console.log("Generated Unique Subject:", subject);
    properties.topic = subject;
    const imgUrl = await generateCoverImageUrl(subject, process.env.UNSPLASH_ACCESS_KEY);
    properties.imgUrl = imgUrl;
    const article = await generateArticle(properties);

    saveArticle(title, subject, article);
  }
})();