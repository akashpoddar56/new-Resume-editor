import React, { useState, useCallback } from 'react';
import { ResumeData, AlignmentResult, TextChunk } from '../types';
import { alignWithJobDescription } from '../services/geminiService';

interface JobAlignmentProps {
    resumeData: ResumeData;
    onClose: () => void;
}

// Helper to convert the rich ResumeData object to a plain string for analysis
const resumeDataToText = (data: ResumeData): string => {
    let text = '';
    const add = (field: TextChunk | null | string) => {
        if (field && typeof field === 'object' && field.text) text += field.text + '\n';
        else if (typeof field === 'string') text += field + '\n';
    };

    add(data.fullName);
    add(data.summary);
    add('Contact:');
    add(data.contact.email);
    add(data.contact.phone);
    add(data.contact.linkedin);
    
    text += '\nExperience:\n';
    data.experience.forEach(exp => {
        add(exp.title);
        add(exp.company);
        add(exp.dates);
        exp.responsibilities.forEach(add);
        text += '\n';
    });

    text += '\nEducation:\n';
    data.education.forEach(edu => {
        add(edu.institution);
        add(edu.degree);
        add(edu.dates);
        edu.details.forEach(add);
        text += '\n';
    });
    
    text += '\nSkills:\n';
    data.skills.forEach(skillCat => {
        add(skillCat.categoryTitle);
        skillCat.skills.forEach(add);
    });

    return text;
};


const JobAlignment: React.FC<JobAlignmentProps> = ({ resumeData, onClose }) => {
    const [jobDescription, setJobDescription] = useState('');
    const [alignmentResult, setAlignmentResult] = useState<AlignmentResult | null>(null);
    const [isAligning, setIsAligning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAlign = useCallback(async () => {
        if (!jobDescription.trim()) {
            setError('Please paste a job description first.');
            return;
        }
        setIsAligning(true);
        setError(null);
        setAlignmentResult(null);
        try {
            const resumeText = resumeDataToText(resumeData);
            const result = await alignWithJobDescription(resumeText, jobDescription);
            setAlignmentResult(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsAligning(false);
        }
    }, [resumeData, jobDescription]);
    
    const getSuggestionIcon = (type: string) => {
        switch (type) {
            case 'improve': return 'check_circle';
            case 'add': return 'add_circle';
            case 'missing': return 'error';
            default: return 'info';
        }
    };

     const getSuggestionColor = (type: string) => {
        switch (type) {
            case 'improve': return 'text-green-500';
            case 'add': return 'text-yellow-500';
            case 'missing': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    return (
        <div className="p-6 flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-800">Job Alignment</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <span className="material-icons">close</span>
              </button>
            </div>
            <div className="flex-shrink-0">
                <textarea
                    className="w-full h-32 border border-gray-300 rounded-lg resize-none focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2"
                    placeholder="Paste the job description here..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                />
                <button
                    onClick={handleAlign}
                    disabled={isAligning || !jobDescription}
                    className="mt-2 w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center space-x-2 disabled:bg-gray-400"
                >
                    {isAligning ? (
                         <>
                            <span className="material-icons animate-spin text-sm">loop</span>
                            <span>Analyzing...</span>
                        </>
                    ) : (
                        <>
                           <span className="material-icons text-sm">sync_alt</span>
                           <span>Align Resume</span>
                        </>
                    )}
                </button>
            </div>
            {error && <p className="text-sm text-red-500 mt-2 flex-shrink-0">{error}</p>}
            
            <div className="mt-4 flex-1 overflow-y-auto">
                {alignmentResult && (
                    <>
                        <div>
                            <h3 className="font-semibold text-gray-800 mb-2">Alignment Score</h3>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${alignmentResult.alignmentScore}%` }}></div>
                            </div>
                            <p className="text-sm text-gray-600 mt-2">{alignmentResult.alignmentScore}% Match</p>
                            <p className="text-sm text-gray-500 mt-1">Keywords: <span className="font-medium text-gray-700">{alignmentResult.matchedKeywords.length}/{alignmentResult.matchedKeywords.length + alignmentResult.missingKeywords.length}</span> matched</p>
                        </div>

                        <div className="mt-4">
                            <h3 className="font-semibold text-gray-800 mb-2">Suggestions</h3>
                            <ul className="space-y-3 text-sm">
                                {alignmentResult.suggestions.map((suggestion, index) => (
                                    <li key={index} className="flex items-start">
                                        <span className={`material-icons mr-2 ${getSuggestionColor(suggestion.type)}`}>{getSuggestionIcon(suggestion.type)}</span>
                                        <span className="text-gray-700">{suggestion.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default JobAlignment;