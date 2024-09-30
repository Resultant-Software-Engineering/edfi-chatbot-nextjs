import React from 'react';
import { marked } from 'marked';
import Image from 'next/image';

marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: false,
  smartLists: true,
  smartypants: true,
});

const splitText = (text) => {
  const result = [];
  const lines = text.split('\n');
  let isErrored = false;
  let inCodeBlock = false;
  let codeBlockLines = [];

  lines.forEach(line => {
    try{
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          inCodeBlock = false;
          codeBlockLines.push(line);
          result.push(codeBlockLines.join('\n'));
          codeBlockLines = [];
        } else {
          // Start of code block
          inCodeBlock = true;
          codeBlockLines.push(line);
        }
      } else if (inCodeBlock) {
        // Inside code block
        codeBlockLines.push(line);
      } else {
        // Regular line
        if (line.trim().length > 0) {
          result.push(line);
        }
      }
    }
    catch(e){
      isErrored = true;
      console.error(e);
    }
  });

  if (inCodeBlock) {
    result.push(codeBlockLines.join('\n'));
  }

  return result;
};

const Message = ({ message, isUser }) => {
  let containerClass = isUser ? "bg-blue-50" : "bg-gray-50";

  if (Array.isArray(message)) {
    message = message.join("");
  }
  
  if(isErrored){
    message = "An error has occurred while parsing your request";
  }

  if (!message || message === "") {
    return null;
  }

  return (
    <div
      className={`flex gap-x-4 rounded-md ${containerClass} py-5 px-5 mb-12 items-center`}
    >
      {isUser ? (
        <span className="sm:text-xl rounded p-2 text-base h-4 flex items-center mt-1" title="user">
          You:
        </span>
      ) : (
        <span className="text-xl sm:text-2xl" title="AI">
          <Image src="/tech-doc.png" width="75" height="75" alt="Tech Doc"/>
        </span>
      )}

      <div className="flex flex-col text-sm sm:text-base flex-1 gap-y-4 mt-1">
        {splitText(message).map((part, index) => {
          const isCodeBlock = part.startsWith('```') && part.endsWith('```');
          const content = marked(part);

          return (
            <div
              key={index}
              className={`min-w-0 ${isCodeBlock ? 'code-block' : 'text-block'}`}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Message;
