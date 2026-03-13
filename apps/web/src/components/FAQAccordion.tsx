
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
  className?: string;
}

const FAQAccordion: React.FC<FAQAccordionProps> = ({ items, className = '' }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const toggleAccordion = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {items.map((item, index) => (
        <div 
          key={index} 
          className={cn(
            "border border-border rounded-lg overflow-hidden transition-all duration-300",
            expandedIndex === index ? "bg-card shadow-sm" : "bg-background"
          )}
        >
          <button
            className="flex justify-between items-center w-full text-left px-6 py-4"
            onClick={() => toggleAccordion(index)}
            aria-expanded={expandedIndex === index}
          >
            <span className="font-medium text-lg">{item.question}</span>
            <ChevronDown 
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform duration-300",
                expandedIndex === index ? "transform rotate-180" : ""
              )} 
            />
          </button>
          <div 
            className={cn(
              "overflow-hidden transition-all duration-300",
              expandedIndex === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="p-6 pt-0 prose prose-sm dark:prose-invert max-w-none">
              <p>{item.answer}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FAQAccordion;
