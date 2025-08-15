import React, { useEffect, useRef, useState } from 'react';
import { ResumeData, TextChunk } from '../types';

interface InteractiveResumeProps {
    resumeData: ResumeData | null;
    setResumeData: React.Dispatch<React.SetStateAction<ResumeData | null>>;
    selectedFile: File | null;
    pageDetails: { width: number, height: number }[];
    handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleParseResume: () => void;
    isParsing: boolean;
    error: string | null;
}

const EditableField: React.FC<{
    field: TextChunk;
    scale: number;
    onChange: (newValue: string) => void;
}> = ({ field, scale, onChange }) => {
    const { text, boundingBox } = field;
    const { x, y, width, height } = boundingBox;

    const style = {
        left: `${x * scale}px`,
        top: `${y * scale}px`,
        width: `${width * scale}px`,
        height: `${height * scale}px`,
        fontSize: `${height * scale * 0.8}px`, // Approximate font size
        lineHeight: `${height * scale}px`,
    };

    return (
        <input
            type="text"
            value={text}
            onChange={(e) => onChange(e.target.value)}
            className="absolute bg-blue-100 bg-opacity-20 border border-dashed border-blue-400 p-0 m-0"
            style={style}
        />
    );
};


const InteractiveResume: React.FC<InteractiveResumeProps> = (props) => {
    const { resumeData, setResumeData, selectedFile, pageDetails, handleFileChange, handleParseResume, isParsing, error } = props;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

     useEffect(() => {
        if (!selectedFile || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        const renderPdf = async () => {
            const pdfData = new Uint8Array(await selectedFile.arrayBuffer());
            const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
            const page = await pdf.getPage(1); // Render first page
            
            const containerWidth = containerRef.current?.clientWidth || 800;
            const viewport = page.getViewport({ scale: 1 });
            const calculatedScale = containerWidth / viewport.width;
            setScale(calculatedScale);
            
            const scaledViewport = page.getViewport({ scale: calculatedScale });
            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;

            const renderContext = {
                canvasContext: context,
                viewport: scaledViewport,
            };
            await page.render(renderContext).promise;
        };

        renderPdf();
    }, [selectedFile, resumeData]); // Rerender canvas if file changes or parsing finishes

    const handleFieldChange = (section: keyof ResumeData, value: string, subKey?: string, id?: string, index?: number) => {
        setResumeData(prevData => {
            if (!prevData) return null;
            
            // This is a simplified handler. A real implementation would need deep cloning and more complex logic.
            const newData = JSON.parse(JSON.stringify(prevData));

            if (section === 'fullName' || section === 'summary') {
                if(newData[section]) newData[section].text = value;
            } else if (section === 'contact' && subKey) {
                 if(newData.contact[subKey as keyof typeof newData.contact]) {
                    (newData.contact[subKey as keyof typeof newData.contact] as TextChunk).text = value;
                 }
            } else if ((section === 'experience' || section === 'education') && id && subKey) {
                 const item = newData[section].find((i: any) => i.id === id);
                 if (item) {
                     if(subKey === 'responsibilities' || subKey === 'details') {
                         if(typeof index === 'number') item[subKey][index].text = value;
                     } else {
                        if (item[subKey as keyof typeof item]) {
                            (item[subKey as keyof typeof item] as TextChunk).text = value;
                        }
                     }
                 }
            }
            
            return newData;
        });
    }

    const handleDownload = () => {
        if (!resumeData || !pageDetails.length) return;

        const { jsPDF } = jspdf;
        const doc = new jsPDF({
            unit: 'pt',
            format: [pageDetails[0].width, pageDetails[0].height]
        });

        const addFieldToPdf = (field: TextChunk | null) => {
            if (!field) return;
            const { text, boundingBox } = field;
            // Approximate font size. A more robust solution would be needed for different fonts/styles.
            const fontSize = boundingBox.height * 0.8; 
            doc.setFontSize(fontSize);
            doc.text(text, boundingBox.x, boundingBox.y + boundingBox.height * 0.8); // Adjust Y for baseline
        };
        
        addFieldToPdf(resumeData.fullName);
        addFieldToPdf(resumeData.summary);
        addFieldToPdf(resumeData.contact.email);
        addFieldToPdf(resumeData.contact.phone);
        addFieldToPdf(resumeData.contact.linkedin);

        resumeData.experience.forEach(exp => {
            addFieldToPdf(exp.title);
            addFieldToPdf(exp.company);
            addFieldToPdf(exp.dates);
            exp.responsibilities.forEach(addFieldToPdf);
        });
        
        resumeData.education.forEach(edu => {
            addFieldToPdf(edu.institution);
            addFieldToPdf(edu.degree);
            addFieldToPdf(edu.dates);
            edu.details.forEach(addFieldToPdf);
        });

        resumeData.skills.forEach(skillCat => {
            addFieldToPdf(skillCat.categoryTitle);
            skillCat.skills.forEach(addFieldToPdf);
        });

        doc.save(`${resumeData.fullName?.text || 'resume'}_edited.pdf`);
    };

    return (
        <>
            <header className="bg-white shadow-sm p-4 flex justify-between items-center no-print">
                <h1 className="text-xl font-semibold text-gray-800">AI Resume Editor</h1>
                <button onClick={handleDownload} disabled={!resumeData} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center space-x-2 disabled:bg-gray-400">
                    <span className="material-icons">download</span>
                    <span>Download as PDF</span>
                </button>
            </header>
            <div className="flex-1 p-8 overflow-y-auto bg-gray-200" ref={containerRef}>
                <div className="max-w-4xl mx-auto">
                    {/* Upload Pane */}
                    {!selectedFile && (
                         <div className="w-full bg-white shadow-lg rounded-lg p-6 mb-8 text-center">
                            <h2 className="text-lg font-semibold text-gray-800 mb-1">Upload Your Resume</h2>
                            <p className="text-sm text-gray-600 mb-4">Upload a PDF to begin editing with AI assistance.</p>
                             <label htmlFor="pdf-upload" className="mx-auto relative flex flex-col items-center justify-center w-64 h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                <span className="material-icons text-4xl text-gray-400">cloud_upload</span>
                                <p className="text-sm text-gray-500 mt-1"><span className="font-semibold">Click to upload</span></p>
                                <input id="pdf-upload" type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                            </label>
                        </div>
                    )}

                    {/* Controls & Status */}
                    {selectedFile && !resumeData && (
                        <div className="w-full bg-white shadow-lg rounded-lg p-6 mb-8">
                             <p className="text-sm text-gray-700 mb-4">Selected file: <span className="font-medium">{selectedFile.name}</span></p>
                            <button onClick={handleParseResume} disabled={isParsing} className="flex items-center justify-center bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 space-x-2 disabled:bg-gray-400">
                                {isParsing ? <><span className="material-icons animate-spin">loop</span><span>Parsing...</span></> : <><span className="material-icons">auto_awesome</span><span>Make Editable</span></>}
                            </button>
                             {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}
                        </div>
                    )}
                    
                    {/* Resume View */}
                    <div className="relative mx-auto" style={{ width: canvasRef.current?.width }}>
                        <canvas ref={canvasRef} className="w-full shadow-lg rounded-lg" />
                         {isParsing && <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-lg"><span className="material-icons text-6xl text-indigo-500 animate-spin">loop</span></div>}
                        
                        {resumeData && (
                            <div className="absolute inset-0">
                                {resumeData.fullName && <EditableField field={resumeData.fullName} scale={scale} onChange={v => handleFieldChange('fullName', v)} />}
                                {resumeData.summary && <EditableField field={resumeData.summary} scale={scale} onChange={v => handleFieldChange('summary', v)} />}
                                {resumeData.contact.email && <EditableField field={resumeData.contact.email} scale={scale} onChange={v => handleFieldChange('contact', v, 'email')} />}
                                {resumeData.contact.phone && <EditableField field={resumeData.contact.phone} scale={scale} onChange={v => handleFieldChange('contact', v, 'phone')} />}
                                {resumeData.contact.linkedin && <EditableField field={resumeData.contact.linkedin} scale={scale} onChange={v => handleFieldChange('contact', v, 'linkedin')} />}
                                
                                {resumeData.experience.map(exp => (
                                    <React.Fragment key={exp.id}>
                                        {exp.title && <EditableField field={exp.title} scale={scale} onChange={v => handleFieldChange('experience', v, 'title', exp.id)} />}
                                        {exp.company && <EditableField field={exp.company} scale={scale} onChange={v => handleFieldChange('experience', v, 'company', exp.id)} />}
                                        {exp.dates && <EditableField field={exp.dates} scale={scale} onChange={v => handleFieldChange('experience', v, 'dates', exp.id)} />}
                                        {exp.responsibilities.map((resp, i) => <EditableField key={i} field={resp} scale={scale} onChange={v => handleFieldChange('experience', v, 'responsibilities', exp.id, i)} />)}
                                    </React.Fragment>
                                ))}

                                {resumeData.education.map(edu => (
                                    <React.Fragment key={edu.id}>
                                        {edu.institution && <EditableField field={edu.institution} scale={scale} onChange={v => handleFieldChange('education', v, 'institution', edu.id)} />}
                                        {edu.degree && <EditableField field={edu.degree} scale={scale} onChange={v => handleFieldChange('education', v, 'degree', edu.id)} />}
                                        {edu.dates && <EditableField field={edu.dates} scale={scale} onChange={v => handleFieldChange('education', v, 'dates', edu.id)} />}
                                        {edu.details.map((detail, i) => <EditableField key={i} field={detail} scale={scale} onChange={v => handleFieldChange('education', v, 'details', edu.id, i)} />)}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default InteractiveResume;