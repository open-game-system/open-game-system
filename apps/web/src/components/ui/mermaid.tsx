import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidProps {
  chart: string;
  className?: string;
}

export const Mermaid: React.FC<MermaidProps> = ({ chart, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };
    
    // Initial check
    checkDarkMode();
    
    // Watch for changes to dark mode
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkDarkMode();
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    
    return () => {
      observer.disconnect();
    };
  }, []);
  
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDarkMode ? 'dark' : 'neutral',
      securityLevel: 'loose',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 14,
      themeVariables: {
        primaryColor: '#8b5cf6',
        primaryTextColor: isDarkMode ? '#ffffff' : '#f8fafc',
        primaryBorderColor: '#6b7280',
        lineColor: isDarkMode ? '#a1a1aa' : '#6b7280',
        secondaryColor: isDarkMode ? '#3f3f46' : '#f1f5f9',
        tertiaryColor: isDarkMode ? '#27272a' : '#f8fafc',
        mainBkg: isDarkMode ? '#1e1e2e' : '#ffffff',
        nodeBorder: isDarkMode ? '#4b5563' : '#6b7280',
        clusterBkg: isDarkMode ? '#27272a' : '#f8fafc',
        clusterBorder: isDarkMode ? '#4b5563' : '#6b7280',
        background: isDarkMode ? '#27272a' : '#ffffff',
      }
    });
    
    try {
      const renderChart = async () => {
        if (ref.current) {
          ref.current.innerHTML = chart;
          try {
            const { svg } = await mermaid.render('mermaid-svg', chart);
            setSvgContent(svg);
            setError(null);
          } catch (err) {
            console.error('Mermaid rendering error:', err);
            setError('Failed to render diagram');
          }
        }
      };
      
      renderChart();
    } catch (err) {
      console.error('Mermaid initialization error:', err);
      setError('Failed to initialize diagram');
    }
  }, [chart, isDarkMode]);
  
  if (error) {
    return (
      <div className="p-4 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-md">
        {error}
        <pre className="mt-2 text-xs overflow-auto bg-card p-2 rounded border border-border">
          {chart}
        </pre>
      </div>
    );
  }
  
  return (
    <div className={`mermaid-diagram rounded-md border border-border ${className}`}>
      <div className="responsive-diagram overflow-auto w-full">
        <div 
          className="mermaid min-w-[768px] md:min-w-0 w-full"
          ref={ref} 
          dangerouslySetInnerHTML={svgContent ? { __html: svgContent } : undefined} 
        />
      </div>
    </div>
  );
}; 