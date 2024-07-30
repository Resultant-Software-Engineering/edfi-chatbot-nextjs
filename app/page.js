"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import ChatForm from "./components/ChatForm";
import Message from "./components/Message";
import SlideOver from "./components/SlideOver";
import EmptyState from "./components/EmptyState";
import QueuedSpinner from "./components/QueuedSpinner";
import CallToAction from "./components/CallToAction";
import Dropdown from "./components/Dropdown";
import { Cog6ToothIcon, CodeBracketIcon } from "@heroicons/react/20/solid";
import { useCompletion } from "ai/react";
import { Toaster, toast } from "react-hot-toast";
import { LlamaTemplate, Llama3Template } from "../src/prompt_template";
import Image from 'next/image';

import { countTokens } from "./src/tokenizer.js";
import Link from "next/link";

import { marked } from 'marked';
import highlight from 'highlight.js';
import 'highlight.js/styles/default.css';

const MODELS = [
  {
    id: "meta/meta-llama-3-70b-instruct",
    name: "Meta Llama 3 70B",
    shortened: "70B",
    emoji: "🦙",
    description: "The most accurate, powerful next generation Llama.",
    new: true,
  },
  {
    id: "meta/meta-llama-3-8b-instruct",
    name: "Meta Llama 3 8B",
    shortened: "8B",
    emoji: "🦙",
    description: "The fastest and cheapest Llama.",
    new: true,
  },
  {
    id: "meta/llama-2-70b-chat",
    name: "Meta Llama 2 70B",
    shortened: "70B",
    emoji: "🦙",
    description: "The most accurate, powerful Llama 2",
  },
  {
    id: "meta/llama-2-13b-chat",
    name: "Meta Llama 2 13B",
    shortened: "13B",
    emoji: "🦙",
    description: "Faster and cheaper Llama 2 at the expense of accuracy.",
  },

  {
    id: "meta/llama-2-7b-chat",
    name: "Meta Llama 2 7B",
    shortened: "7B",
    emoji: "🦙",
    description: "The smallest, fastest Llama 2 chat model.",
  },
];

marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: false,
  smartLists: true,
  smartypants: true,
  highlight: function(code, language) {
    return highlight.highlightAuto(code, language).value;
  }
});

const llamaTemplate = LlamaTemplate();
const llama3Template = Llama3Template();

const generatePrompt = (template, systemPrompt, messages) => {
  const chat = messages.map((message) => ({
    role: message.isUser ? "user" : "assistant",
    content: message.text,
  }));

  return template([
    {
      role: "system",
      content: systemPrompt,
    },
    ...chat,
  ]);
};

const metricsReducer = (state, action) => {
  switch (action.type) {
    case "START":
      return { startedAt: new Date() };
    case "FIRST_MESSAGE":
      return { ...state, firstMessageAt: new Date() };
    case "COMPLETE":
      return { ...state, completedAt: new Date() };
    default:
      throw new Error(`Unsupported action type: ${action.type}`);
  }
};

export default function HomePage() {
  const MAX_TOKENS = 8192;
  const bottomRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  //   Llama params
  const [model, setModel] = useState(MODELS[0]); // default to 70B
  const [systemPrompt, setSystemPrompt] = useState(
    "You are the leading expert on ed-fi and the technical confluence documentation. Showcase your deep understanding of the Ed-Fi ODS and API. Do NOT give overly verbose answers unless asked specific questions, and attempt to sound somewhat human in your response. Give a thorough, easy to understand, and in-depth answers to the technical questions. Make sure responses are 846 characters or less."
  );
  const [temp, setTemp] = useState(0.75);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(4096);

  //  Llava params
  const [image, setImage] = useState(null);

  // Salmonn params
  const [audio, setAudio] = useState(null);

  const [metrics, dispatch] = useReducer(metricsReducer, {
    startedAt: null,
    firstMessageAt: null,
    completedAt: null,
  });

  const { complete, completion, setInput, input } = useCompletion({
    api: "/api",
    body: {
      model: model.id,
      systemPrompt: systemPrompt,
      temperature: parseFloat(temp),
      topP: parseFloat(topP),
      maxTokens: parseInt(maxTokens),
      image: image,
      audio: audio,
    },

    onError: (error) => {
      setError(error);
    },
    onResponse: (response) => {
      setStarting(false);
      setError(null);
      dispatch({ type: "FIRST_MESSAGE" });
    },
    onFinish: () => {
      dispatch({ type: "COMPLETE" });
    },
  });

  const handleFileUpload = (file) => {
    if (file) {
      // determine if file is image or audio
      if (
        ["audio/mpeg", "audio/wav", "audio/ogg"].includes(
          file.originalFile.mime
        )
      ) {
        setAudio(file.fileUrl);
        setModel(MODELS[4]);
        toast.success(
          "You uploaded an audio file, so you're now speaking with Salmonn."
        );
      } else if (["image/jpeg", "image/png"].includes(file.originalFile.mime)) {
        setImage(file.fileUrl);
        setModel(MODELS[3]);
        toast.success(
          "You uploaded an image, so you're now speaking with Llava."
        );
      } else {
        toast.error(
          `Sorry, we don't support that file type (${file.originalFile.mime}) yet. Feel free to push a PR to add support for it!`
        );
      }
    }
  };

  const setAndSubmitPrompt = (newPrompt) => {
    handleSubmit(newPrompt);
  };

  const handleSettingsSubmit = async (event) => {
    event.preventDefault();
    setOpen(false);
    setSystemPrompt(event.target.systemPrompt.value);
  };

  const handleSubmit = async (userMessage) => {
    setStarting(true);
    const SNIP = "<!-- snip -->";

    const messageHistory = [...messages];
    if (completion.length > 0) {
      messageHistory.push({
        text: completion,
        isUser: false,
      });
    }
    messageHistory.push({
      text: userMessage,
      isUser: true,
    });

    // Generate initial prompt and calculate tokens
    let prompt = `${generatePrompt(
      model.name.includes("Llama 3") ? llama3Template : llamaTemplate,
      systemPrompt,
      messageHistory
    )}\n`;

    console.log(prompt);

    // Check if we exceed max tokens and truncate the message history if so.
    while (countTokens(prompt) > MAX_TOKENS) {
      if (messageHistory.length < 3) {
        setError(
          "The message you are trying to send is too long. Please try again with a shorter message."
        );

        return;
      }

      // Remove the third message from history, keeping the original exchange.
      //messageHistory.splice(1, 2);

      // Recreate the prompt
      prompt = `${SNIP}\n${generatePrompt(
        llamaTemplate,
        systemPrompt,
        messageHistory
      )}\n`;
    }

    setMessages(messageHistory);

    dispatch({ type: "START" });

    complete(prompt);
  };

  useEffect(() => {
    if (messages?.length > 0 || completion?.length > 0) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
      highlight.highlightAll();
  }, [messages, completion]);

  useEffect(() => {
    // Reapply highlight.js to all code blocks
    document.querySelectorAll('pre code').forEach((block) => {
      highlight.highlightBlock(block);
    });
  }, [messages, completion]);

  return (
    <>
      <nav className="sm:pt-8 pt-4 px-4 sm:px-12 flex items-center justify-between pb-2 gradient-border" style={{position: "sticky", top: "0", backgroundColor: "rgba(255, 255, 255, 0.93)"}}>
      <div>
        <Link href={"https://www.resultant.com"}>
          <Image src="/resultant-logo.png" alt="Resultant Logo" width="150" height="150"/>
        </Link>
      </div>
      <div style={{fontFamily: 'Pacifico', color: '#004987', fontSize: "50px"}}>
        The Ed-Fi Tech Doc
      </div>
      <div className="text-xl pr-3 font-semibold text-blue-500 text-underline">
        <Link href={"https://www.ed-fi.org/"}>
          <Image src="/edfi-logo.png" alt="Ed-Fi Logo" className="inline" width="150" height="150"/>
        </Link>
      </div>
    </nav>

      <Toaster position="top-left" reverseOrder={false} />

      <main className="max-w-5xl pb-5 mx-auto mt-8 sm:px-4">
        <div className="text-center"></div>

        <SlideOver
          open={open}
          setOpen={setOpen}
          systemPrompt={systemPrompt}
          setSystemPrompt={setSystemPrompt}
          handleSubmit={handleSettingsSubmit}
          temp={temp}
          setTemp={setTemp}
          maxTokens={maxTokens}
          setMaxTokens={setMaxTokens}
          topP={topP}
          setTopP={setTopP}
          models={MODELS}
          size={model}
          setSize={setModel}
        />

        <ChatForm
          prompt={input}
          setPrompt={setInput}
          onSubmit={handleSubmit}
          handleFileUpload={handleFileUpload}
          completion={completion}
          metrics={metrics}
        />

        {error && <div>{error}</div>}

        <article className="pb-24">
          <EmptyState setPrompt={setAndSubmitPrompt} setOpen={setOpen} />
          {messages.map((message, index) => (
            <Message
              key={`message-${index}`}
              message={message.text}
              isUser={message.isUser}
            />
          ))}
          <Message message={completion} isUser={false} />

          {starting && <QueuedSpinner />}

          <div ref={bottomRef} />
        </article>
      </main>
    </>
  );
}
