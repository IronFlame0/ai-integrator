import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,

  h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-3">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-bold mb-1 mt-2">{children}</h3>,

  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,

  a: ({ href, children }) => {
    const safe = href && /^https?:\/\//i.test(href) ? href : "#";
    return (
      <a href={safe} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">
        {children}
      </a>
    );
  },

  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-600 mb-2">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="border-gray-300 my-3" />,

  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="text-sm border-collapse w-full">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-200">{children}</thead>,
  th: ({ children }) => <th className="border border-gray-300 px-2 py-1 font-semibold text-left">{children}</th>,
  td: ({ children }) => <td className="border border-gray-300 px-2 py-1">{children}</td>,

  code: ({ className, children, ...props }) => {
    const language = className?.replace("language-", "") ?? "";
    return (
      <code className="bg-gray-200 text-gray-800 rounded px-1 py-0.5 text-xs font-mono" {...props}>
        {children}
      </code>
    );
  },

  pre: ({ children, node }) => {
    const codeNode = (node as any)?.children?.[0];
    const codeClass: string = codeNode?.properties?.className?.[0] ?? "";
    const language = codeClass.replace("language-", "");

    return (
      <div className="mb-2 rounded-lg overflow-hidden">
        {language && (
          <div className="bg-gray-700 px-3 py-1 text-xs text-gray-300 font-mono">{language}</div>
        )}
        <pre className="bg-gray-800 text-gray-100 px-4 py-3 overflow-x-auto text-xs font-mono leading-relaxed">
          {children}
        </pre>
      </div>
    );
  },
};

type Props = {
  content: string;
};

export default function MarkdownMessage({ content }: Props) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
