
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, CheckCircle, Clock, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function MarkdownContent({ title, content }) {
  // Add safety check for content
  if (!content || typeof content !== 'string') {
    return (
      <Card className="glassmorphism border-0 shadow-lg mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <BookOpen className="w-6 h-6 text-blue-600" />
            {title || "Content"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-gray-500">
            <Info className="w-5 h-5" />
            <p>No text content available for this section.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Parser function with safety checks
  const parseContentIntoSections = (markdownContent) => {
    // Safety check
    if (!markdownContent || typeof markdownContent !== 'string') {
      return [];
    }

    const lines = markdownContent.split('\n');
    const sections = [];
    let currentSection = { title: '', content: '', subsections: [] };
    let inSubsection = false;
    let currentSubsection = { title: '', content: '' };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ') && !line.startsWith('### ')) {
        if (currentSection.title || currentSection.content) {
          if (inSubsection && currentSubsection.title) {
            currentSection.subsections.push({ ...currentSubsection });
          }
          sections.push({ ...currentSection });
        }
        currentSection = { title: line.replace('## ', ''), content: '', subsections: [] };
        inSubsection = false;
        currentSubsection = { title: '', content: '' };
      } else if (line.startsWith('### ')) {
        if (inSubsection && currentSubsection.title) {
          currentSection.subsections.push({ ...currentSubsection });
        }
        currentSubsection = { title: line.replace('### ', ''), content: '' };
        inSubsection = true;
      } else {
        if (inSubsection) {
          currentSubsection.content += line + '\n';
        } else {
          currentSection.content += line + '\n';
        }
      }
    }
    if (inSubsection && currentSubsection.title) {
      currentSection.subsections.push(currentSubsection);
    }
    if (currentSection.title || currentSection.content) {
      sections.push(currentSection);
    }
    return sections.filter(s => s.title.trim()).map(s => ({
      ...s,
      content: s.content.trim(),
      subsections: s.subsections.filter(sub => sub.title.trim()).map(sub => ({
        ...sub,
        content: sub.content.trim()
      }))
    }));
  };

  const sections = parseContentIntoSections(content);
  const totalSections = sections.length;
  
  // State to track which accordions are open and which have been read
  const [openSections, setOpenSections] = useState(["section-0"]); // Start with the first section open
  const [readSections, setReadSections] = useState(new Set([0])); // Mark first section as read initially

  const handleOpenChange = (value) => {
    setOpenSections(value);
    
    // Mark newly opened sections as read
    const newReadSections = new Set(readSections);
    value.forEach(sectionId => {
      const index = parseInt(sectionId.split('-')[1]);
      newReadSections.add(index);
    });
    setReadSections(newReadSections);
  };
  
  const progress = totalSections > 0 ? (readSections.size / totalSections) * 100 : 0;

  // If no sections found, show simple markdown
  if (sections.length === 0) {
    return (
      <Card className="glassmorphism border-0 shadow-lg mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <BookOpen className="w-6 h-6 text-blue-600" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glassmorphism border-0 shadow-lg mb-8">
      <CardHeader className="border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <BookOpen className="w-6 h-6 text-blue-600" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">
              {Math.ceil(totalSections * 1.5)} min read
            </span>
          </div>
        </div>
        
        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              Read {readSections.size} of {totalSections} sections
            </span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {Math.round(progress)}% Complete
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-6">
        <Accordion 
          type="multiple" 
          value={openSections}
          onValueChange={handleOpenChange}
          className="space-y-4"
        >
          {sections.map((section, index) => (
            <AccordionItem 
              key={`section-${index}`}
              value={`section-${index}`}
              className="border rounded-lg overflow-hidden shadow-sm"
            >
              <AccordionTrigger className="px-4 py-3 hover:bg-gray-50 [&[data-state=open]]:bg-blue-50 text-left">
                <div className="flex items-center gap-3">
                  {readSections.has(index) && (
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  )}
                  <span className="font-semibold text-gray-900">{section.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 py-3 bg-white border-t">
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {/* Main section content */}
                    {section.content && (
                      <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700">
                        <ReactMarkdown>{section.content}</ReactMarkdown>
                      </div>
                    )}

                    {/* Subsections */}
                    {section.subsections.length > 0 && (
                      <div className="space-y-3 mt-4">
                        {section.subsections.map((subsection, subIndex) => (
                          <div key={subIndex} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <h4 className="font-semibold text-gray-800 mb-2">{subsection.title}</h4>
                            <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-600 prose-p:leading-relaxed prose-strong:text-gray-800">
                              <ReactMarkdown>{subsection.content}</ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
