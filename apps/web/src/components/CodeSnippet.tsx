import React, { useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coldarkDark, coldarkCold } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

interface CodeSnippetProps {
  code: string;
  language?: string;
  title?: string;
  className?: string;
}

const CodeSnippet: React.FC<CodeSnippetProps> = ({ 
  code, 
  language = 'javascript', 
  title,
  className = '' 
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect color mode
  useEffect(() => {
    // Initial check
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);

    // Listen for changes
    const observer = new MutationObserver((mutations) => {
      for(const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          setIsDarkMode(isDark);
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn("rounded-lg overflow-hidden shadow-md", className)}>
      {title && (
        <div className="bg-secondary px-4 py-2 text-sm font-medium border-b border-border flex items-center justify-between">
          <span>{title}</span>
        </div>
      )}
      <div className="bg-card overflow-hidden">
        <SyntaxHighlighter
          language={language}
          style={isDarkMode ? coldarkDark : coldarkCold}
          customStyle={{
            margin: 0,
            padding: '16px',
            background: 'transparent',
            fontSize: '0.9rem',
          }}
          wrapLongLines={false}
          showLineNumbers={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default CodeSnippet;
