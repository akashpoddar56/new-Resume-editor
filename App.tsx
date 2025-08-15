import React, { useState, useCallback } from 'react';
import { ResumeData, TextChunk } from './types';
import { parseResumeFromChunks } from './services/geminiService';
import InteractiveResume from './components/InteractiveResume';
import JobAlignment from './components/JobAlignment';
import LeftSidebar from './components/LeftSidebar';

const extractTextChunksFromPdf = async (file: File): Promise<{ chunks: TextChunk[], pageDetails: { width: number, height: number }[] }> => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = async (event) => {
            if (!event.target?.result) {
                return reject(new Error("Failed to read file."));
            }
            try {
                const pdfData = new Uint8Array(event.target.result as ArrayBuffer);
                const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
                const numPages = pdf.numPages;
                let allChunks: TextChunk[] = [];
                let allPageDetails = [];

                for (let i = 1; i <= numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1 });
                    allPageDetails.push({ width: viewport.width, height: viewport.height });

                    const textContent = await page.getTextContent();
                    const pageChunks = textContent.items.map((item: any) => {
                        const tx = item.transform;
                        // Position from transform matrix: [scaleX, skewY, skewX, scaleY, x, y]
                        const x = tx[4];
                        const y = viewport.height - tx[5] - tx[3]; // Y is often from bottom in PDF, convert to top-left
                        return {
                            text: item.str,
                            boundingBox: {
                                x: x,
                                y: y,
                                width: item.width,
                                height: item.height,
                            }
                        };
                    });
                    allChunks.push(...pageChunks);
                }
                resolve({ chunks: allChunks, pageDetails: allPageDetails });
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};


export default function App() {
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageDetails, setPageDetails] = useState<{ width: number, height: number }[]>([]);
  
  const [activeRightSidebar, setActiveRightSidebar] = useState<'alignment' | null>(null);

  const handleParseResume = useCallback(async () => {
    if (!selectedFile) {
      setError("No resume to parse. Please upload a PDF.");
      return;
    }
    
    setIsParsing(true);
    setError(null);
    setResumeData(null);
    setPageDetails([]);

    try {
      // Step 1: Extract text chunks with coordinates from the PDF using pdf.js
      const { chunks, pageDetails } = await extractTextChunksFromPdf(selectedFile);
      setPageDetails(pageDetails);
      
      // Step 2: Pass chunks to Gemini for semantic structuring
      const parsedData = await parseResumeFromChunks(chunks);
      setResumeData(parsedData);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during processing.');
    } finally {
      setIsParsing(false);
    }
  }, [selectedFile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        setError('Please upload a PDF file.');
        return;
    }
    
    setSelectedFile(file);
    setError(null);
    setResumeData(null);
  };

  const toggleRightSidebar = (sidebar: 'alignment') => {
    setActiveRightSidebar(prev => (prev === sidebar ? null : sidebar));
  };


  return (
    <div className="flex h-screen">
      <LeftSidebar activeTab={activeRightSidebar} toggleSidebar={toggleRightSidebar} />
      <main className="flex-1 flex flex-col">
          <InteractiveResume 
            resumeData={resumeData} 
            setResumeData={setResumeData}
            handleFileChange={handleFileChange}
            handleParseResume={handleParseResume}
            isParsing={isParsing}
            error={error}
            selectedFile={selectedFile}
            pageDetails={pageDetails}
            />
      </main>
      <aside className={`transition-all duration-300 ease-in-out bg-white shadow-lg flex-col no-print ${activeRightSidebar ? 'w-80' : 'w-0'}`}>
        {activeRightSidebar === 'alignment' && resumeData && (
          <JobAlignment resumeData={resumeData} onClose={() => setActiveRightSidebar(null)} />
        )}
      </aside>
    </div>
  );
}